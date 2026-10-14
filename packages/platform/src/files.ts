import * as fs from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { library, koffi, winError } from './native.js';

export function isLinkOrReparse(path: string): boolean {
  try {
    if (fs.lstatSync(path).isSymbolicLink()) return true;
    if (process.platform === 'win32') {
      const attr = library('kernel32.dll').func('uint32_t GetFileAttributesW(const char16_t *path)')(path);
      return attr !== 0xffffffff && Boolean(attr & 0x400);
    }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  return false;
}
const held = new Set<string>();
export function lock(path: string): () => void {
  const key = process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  if (held.has(key)) throw new Error('Recursive acquisition of a synchronous file lock');
  const release = acquire(path);
  held.add(key);
  let active = true;
  return () => { if (active) { active = false; try { release(); } finally { held.delete(key); } } };
}

export function withLock<T>(path: string, action: () => T): T {
  const release = lock(path);
  try {
    const result = action();
    if (result !== null && typeof result === 'object' && 'then' in result) throw new TypeError('File lock callbacks must be synchronous');
    return result;
  } finally { release(); }
}

function acquire(path: string): () => void {
  fs.mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (isLinkOrReparse(path)) throw new Error('Unsafe lock target');
  if (process.platform === 'win32') {
    const k = library('kernel32.dll');
    const h = k.func('void *CreateFileW(const char16_t *path, uint32_t access, uint32_t share, void *security, uint32_t disposition, uint32_t flags, void *template)')(path, 0xc0000000, 7, null, 4, 0x80, null);
    if (!h || koffi.address(h) === 0xffffffffffffffffn) throw winError('CreateFileW');
    const close = () => { k.func('bool CloseHandle(void *handle)')(h); };
    // Same byte-range namespace as Python's msvcrt.locking, including empty files.
    if (!k.func('bool LockFileEx(void *handle, uint32_t flags, uint32_t reserved, uint32_t low, uint32_t high, _Inout_ void *overlapped)')(h, 2, 0, 1, 0, Buffer.alloc(32))) {
      const error = winError('LockFileEx'); close(); throw error;
    }
    return close;
  }
  const fd = fs.openSync(path, fs.constants.O_CREAT | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
  try {
    fs.fchmodSync(fd, 0o600);
    const flock = library(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6').func('int flock(int fd, int op)');
    if (flock(fd, 2)) throw new Error('flock failed');
    return () => fs.closeSync(fd);
  } catch (error) { fs.closeSync(fd); throw error; }
}
export function retryWindows(operation: () => void, windows = process.platform === 'win32', sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)): void {
  for (const delay of [10, 20, 40, 80, 160, null]) {
    try { operation(); return; } catch (error) {
      const e = error as NodeJS.ErrnoException & { winerror?: number };
      if (!windows || delay === null || !([5, 32, 33].includes(e.winerror!) || ['EACCES', 'EPERM'].includes(e.code!))) throw error;
      sleep(delay);
    }
  }
}
export function syncDirectory(path: string): boolean | null {
  if (process.platform === 'win32') return null;
  const fd = fs.openSync(dirname(path), 'r');
  try { fs.fsyncSync(fd); return true; }
  catch (e) {
    if (process.platform === 'darwin' && ['EINVAL', 'ENOTSUP', 'EOPNOTSUPP'].includes((e as NodeJS.ErrnoException).code!)) return false;
    throw e;
  } finally { fs.closeSync(fd); }
}
export function atomicWrite(path: string, content: string | Buffer, stage: (name: string) => void = () => {}): boolean | null {
  fs.mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (isLinkOrReparse(path)) throw new Error('Unsafe publication target');
  const temporary = join(dirname(path), `.${basename(path)}.statusline-${randomUUID()}.tmp`);
  let fd: number | undefined = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, content); stage('written');
    fs.fsyncSync(fd); stage('synced'); fs.closeSync(fd); fd = undefined;
    stage('before-replace'); retryWindows(() => fs.renameSync(temporary, path)); stage('replaced');
    return syncDirectory(path);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { retryWindows(() => fs.unlinkSync(temporary)); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  }
}

export function durableUnlink(path: string): void {
  if (isLinkOrReparse(path)) throw new Error('Unsafe deletion target');
  try { retryWindows(() => fs.unlinkSync(path)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  syncDirectory(path);
}
