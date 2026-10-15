import { readFileSync } from 'node:fs';
import { library, int64, nativeApi, nativeFunction } from './native.js';
import type { TypeObject } from 'koffi';

import type { Sample } from '@fbincon/statusline-core/timing/sample';
let readPosix: ((id: number, out: { sec: number; nsec: number }) => number) | undefined;
let timespec: TypeObject | undefined;
function posixTime(id: number): bigint {
  if (!readPosix) {
    const api = nativeApi();
    timespec ??= api.struct('StatuslineTimespec', { sec: 'int64_t', nsec: 'int64_t' });
    readPosix = library(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6').func('clock_gettime', 'int', ['int', api.out(api.pointer(timespec))]);
  }
  const out = { sec: 0, nsec: 0 };
  if (readPosix(id, out)) throw new Error('clock_gettime');
  return int64(out.sec) * 1_000_000_000n + int64(out.nsec);
}
let readTimebase: ((out: { numer: number; denom: number }) => number) | undefined;
let timebaseType: TypeObject | undefined;
function timebase(out: { numer: number; denom: number }): number {
  if (!readTimebase) {
    const api = nativeApi();
    timebaseType ??= api.struct('StatuslineTimebase', { numer: 'uint32_t', denom: 'uint32_t' });
    readTimebase = library('/usr/lib/libSystem.B.dylib').func('mach_timebase_info', 'int', [api.out(api.pointer(timebaseType))]);
  }
  return readTimebase(out);
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
    const kernel = (signature: string) => nativeFunction('kernel32.dll', signature);
    const wall = Buffer.alloc(8);
    kernel('void GetSystemTimePreciseAsFileTime(_Out_ void *time)')(wall);
    const wall_ns = (wall.readBigUInt64LE() - 116444736000000000n) * 100n;
    try {
      const boot_ns = int64(kernel('uint64_t GetTickCount64()')()) * 1_000_000n;
      const env = Buffer.alloc(32), size = [0];
      const status = nativeFunction('ntdll.dll', 'int32_t NtQuerySystemInformation(uint32_t cls, _Out_ void *data, uint32_t size, _Out_ uint32_t *length)')(90, env, env.length, size);
      if (status < 0 || size[0] !== env.length || boot_ns > wall_ns) throw new Error('boot identity');
      // WDK KUSER_SHARED_DATA.BootId: OS-loader boot sequence at user-page
      // offset 0x2c4 (x64 / ARM64, including x64 emulation). Read only our own
      // process via the checked API; an inaccessible page degrades safely.
      const sequence = Buffer.alloc(4), count = [0];
      const current = kernel('void *GetCurrentProcess()')();
      if (!kernel('int32_t ReadProcessMemory(void *process, uintptr_t base, _Out_ void *buffer, size_t size, _Out_ size_t *count)')(
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
      const lib = (signature: string) => nativeFunction('/usr/lib/libSystem.B.dylib', signature);
      const tb = { numer: 0, denom: 0 }, uuid = Buffer.alloc(128), len = [128];
      if (timebase(tb) || tb.numer <= 0 || tb.denom <= 0) throw new Error('timebase');
      if (lib('int sysctlbyname(const char *name, _Out_ void *oldp, _Inout_ size_t *len, const void *newp, size_t size)')('kern.bootsessionuuid', uuid, len, null, 0)) throw new Error('boot UUID');
      const id = uuid.toString('ascii').split('\0')[0]!.toLowerCase();
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) throw new Error('invalid UUID');
      const ticks = int64(lib('uint64_t mach_continuous_time()')());
      return { wall_ns, boot_ns: ticks * BigInt(tb.numer) / BigInt(tb.denom), boot_id: 'darwin:' + id };
    } catch { return { wall_ns, boot_ns: null, boot_id: null }; }
  }
  return { wall_ns, boot_ns: null, boot_id: null };
}
export function sample(read: () => Sample = nativeSample): Sample {
  try { return read(); } catch { return { wall_ns: BigInt(Date.now()) * 1_000_000n, boot_ns: null, boot_id: null }; }
}
