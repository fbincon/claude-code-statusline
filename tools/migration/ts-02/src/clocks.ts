import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { library, int64, koffi } from './native.js';

export interface Sample { wall_ns: bigint; boot_ns: bigint | null; boot_id: string | null }
const Timespec = koffi.struct('TS02Timespec', { sec: 'int64_t', nsec: 'int64_t' });
const Timebase = koffi.struct('TS02Timebase', { numer: 'uint32_t', denom: 'uint32_t' });
function posixTime(id: number): bigint {
  const lib = library(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6');
  const out = { sec: 0, nsec: 0 };
  if (lib.func('clock_gettime', 'int', ['int', koffi.out(koffi.pointer(Timespec))])(id, out)) throw new Error('clock_gettime');
  return int64(out.sec) * 1_000_000_000n + int64(out.nsec);
}
function guid(raw: Buffer): string {
  return [raw.readUInt32LE(0).toString(16).padStart(8, '0'), raw.readUInt16LE(4).toString(16).padStart(4, '0'),
    raw.readUInt16LE(6).toString(16).padStart(4, '0'), raw.subarray(8, 10).toString('hex'), raw.subarray(10, 16).toString('hex')].join('-');
}
export function windowsBootId(environment: Buffer, sequence: Buffer): string {
  if (environment.length !== 32 || environment.subarray(0, 16).every(x => x === 0) || sequence.length !== 4 || sequence.readUInt32LE() === 0) {
    throw new Error('Windows boot identity unavailable');
  }
  return `windows:v2:${guid(environment)}:${sequence.readUInt32LE()}`;
}
export function nativeSample(): Sample {
  if (process.platform === 'win32') {
    const kernel = library('kernel32.dll');
    const wall = Buffer.alloc(8);
    kernel.func('void GetSystemTimePreciseAsFileTime(_Out_ void *time)')(wall);
    const wall_ns = (wall.readBigUInt64LE() - 116444736000000000n) * 100n;
    try {
      const boot_ns = int64(kernel.func('uint64_t GetTickCount64()')()) * 1_000_000n;
      const env = Buffer.alloc(32), size = [0];
      const status = library('ntdll.dll').func('int32_t NtQuerySystemInformation(uint32_t cls, _Out_ void *data, uint32_t size, _Out_ uint32_t *length)')(90, env, env.length, size);
      if (status < 0 || size[0] !== env.length || boot_ns > wall_ns) throw new Error('boot identity');
      // WDK KUSER_SHARED_DATA.BootId: OS-loader boot sequence at user-page
      // offset 0x2c4 (x64 / ARM64, including x64 emulation). Read only our own
      // process via the checked API; an inaccessible page degrades safely.
      const sequence = Buffer.alloc(4), count = [0];
      const current = kernel.func('void *GetCurrentProcess()')();
      if (!kernel.func('int32_t ReadProcessMemory(void *process, uintptr_t base, _Out_ void *buffer, size_t size, _Out_ size_t *count)')(
        current, 0x7ffe02c4, sequence, sequence.length, count) || count[0] !== sequence.length) throw new Error('boot sequence');
      return { wall_ns, boot_ns, boot_id: windowsBootId(env, sequence) };
    } catch { return { wall_ns, boot_ns: null, boot_id: null }; }
  }
  const wall_ns = posixTime(0);
  if (process.platform === 'linux') {
    let boot_ns: bigint | null = null, boot_id: string | null = null;
    try { boot_ns = posixTime(7); } catch { /* CLOCK_BOOTTIME unavailable */ }
    try { boot_id = readFileSync('/proc/sys/kernel/random/boot_id', 'ascii').trim() || null; } catch { /* unavailable */ }
    return { wall_ns, boot_ns, boot_id };
  }
  if (process.platform === 'darwin') {
    try {
      const lib = library('/usr/lib/libSystem.B.dylib');
      const tb = { numer: 0, denom: 0 }, uuid = Buffer.alloc(128), len = [128];
      if (lib.func('mach_timebase_info', 'int', [koffi.out(koffi.pointer(Timebase))])(tb) || tb.numer <= 0 || tb.denom <= 0) throw new Error('timebase');
      if (lib.func('int sysctlbyname(const char *name, _Out_ void *oldp, _Inout_ size_t *len, const void *newp, size_t size)')('kern.bootsessionuuid', uuid, len, null, 0)) throw new Error('boot UUID');
      const id = uuid.toString('ascii').split('\0')[0]!.toLowerCase();
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) throw new Error('invalid UUID');
      const ticks = int64(lib.func('uint64_t mach_continuous_time()')());
      return { wall_ns, boot_ns: ticks * BigInt(tb.numer) / BigInt(tb.denom), boot_id: 'darwin:' + id };
    } catch { return { wall_ns, boot_ns: null, boot_id: null }; }
  }
  return { wall_ns, boot_ns: null, boot_id: null };
}
export function sample(read: () => Sample = nativeSample): Sample {
  try { return read(); } catch { return { wall_ns: BigInt(Date.now()) * 1_000_000n, boot_ns: null, boot_id: null }; }
}
function sameBootDomain(start: Sample, end: Sample): boolean {
  // Preserve legacy Windows snapshots while refusing their ambiguous domain.
  return Boolean(start.boot_id && start.boot_id === end.boot_id &&
    (!start.boot_id.startsWith('windows:') || start.boot_id.startsWith('windows:v2:')));
}
export function delta(start: Sample, end: Sample): bigint | null {
  const elapsed = sameBootDomain(start, end) && start.boot_ns !== null && end.boot_ns !== null
    ? end.boot_ns - start.boot_ns : end.wall_ns - start.wall_ns;
  return elapsed >= 0n ? elapsed : null;
}
export function trusted(start: Sample, end: Sample): boolean {
  return Boolean(sameBootDomain(start, end) && start.boot_ns !== null && end.boot_ns !== null && end.boot_ns >= start.boot_ns);
}
export function processToken(pid: number): string | null {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === 'linux') {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      return stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/)[19] || null;
    }
    if (process.platform === 'darwin') return execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(pid)],
      { encoding: 'utf8', timeout: 1000, env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' }, stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
    if (process.platform === 'win32') {
      const k = library('kernel32.dll');
      const handle = k.func('void *OpenProcess(uint32_t access, bool inherit, uint32_t pid)')(0x1000, false, pid);
      if (!handle) return null;
      try {
        const created = Buffer.alloc(8), unused = [Buffer.alloc(8), Buffer.alloc(8), Buffer.alloc(8)];
        if (!k.func('bool GetProcessTimes(void *handle, _Out_ void *created, _Out_ void *exit, _Out_ void *kernel, _Out_ void *user)')(handle, created, ...unused)) return null;
        const utc = Buffer.alloc(16), local = Buffer.alloc(16), filetime = Buffer.alloc(8);
        if (!k.func('bool FileTimeToSystemTime(const void *time, _Out_ void *system)')(created, utc) ||
          !k.func('bool SystemTimeToTzSpecificLocalTimeEx(const void *zone, const void *utc, _Out_ void *local)')(null, utc, local) ||
          !k.func('bool SystemTimeToFileTime(const void *system, _Out_ void *time)')(local, filetime)) return null;
        const value = filetime.readBigUInt64LE() + created.readBigUInt64LE() % 10000n;
        return String(value - value % 10n + 504911232000000000n);
      } finally { k.func('bool CloseHandle(void *handle)')(handle); }
    }
  } catch { /* identity must be unverifiable, never guessed */ }
  return null;
}

// A Windows process object can outlive process exit while another handle is
// open. Creation identity is not a liveness predicate (same in the oracle).
export function processMatches(pid: number, token: string): boolean {
  if (processToken(pid) !== token) return false;
  try {
    if (process.platform === 'win32') {
      const k = library('kernel32.dll');
      const h = k.func('void *OpenProcess(uint32_t access, bool inherit, uint32_t pid)')(0x100000, false, pid);
      if (!h) return false;
      try { return k.func('uint32_t WaitForSingleObject(void *handle, uint32_t ms)')(h, 0) === 258; }
      finally { k.func('bool CloseHandle(void *handle)')(h); }
    }
    if (process.platform === 'linux') {
      const raw = readFileSync(`/proc/${pid}/stat`, 'utf8'); return !['Z', 'X'].includes(raw.slice(raw.lastIndexOf(')') + 2)[0]!);
    }
    return !execFileSync('/bin/ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8', timeout: 1000 }).trim().startsWith('Z');
  } catch { return false; }
}
