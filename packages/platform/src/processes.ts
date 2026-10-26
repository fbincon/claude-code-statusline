import { readFileSync } from 'node:fs';
import { library } from './native.js';
import { darwinProcess } from './darwin-process.js';

export function processToken(pid: number): string | null {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === 'linux') {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      return stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/)[19] || null;
    }
    if (process.platform === 'darwin') return darwinProcess(pid)?.token ?? null;
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
  if (process.platform === 'darwin') {
    const observed = darwinProcess(pid);
    return observed !== null && observed.token === token && observed.alive;
  }
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
    return false;
  } catch { return false; }
}
