import * as fs from 'node:fs';
import { dirname, basename, join, resolve, toNamespacedPath } from 'node:path';
import { randomUUID } from 'node:crypto';
import { library, nativeApi, nativeFunction, winError } from './native.js';

export class FileChangedError extends Error {
  constructor(message = 'file_changed') { super(message); this.name = 'FileChangedError'; }
}

/** Older Windows libuv reports a 64-bit path volume serial but a 32-bit fd
 * serial. Match the low 32 bits, as current libuv does, without rounding IDs
 * through number. POSIX device identifiers retain all their bits. */
export function sameFileIdentity(left: Pick<fs.BigIntStats, 'dev' | 'ino'>, right: Pick<fs.BigIntStats, 'dev' | 'ino'>, windows = process.platform === 'win32'): boolean {
  return left.ino === right.ino && (windows
    ? BigInt.asUintN(32, left.dev) === BigInt.asUintN(32, right.dev)
    : left.dev === right.dev);
}

/** Node 24.0.0/libuv 1.50 can return dev=0 for Windows path stats. Obtain
 * the volume serial from a no-follow native handle instead of accepting an
 * unknown device. Its file index must still match the preceding lstat. */
export function fileIdentity(path: string, stat: Pick<fs.BigIntStats, 'dev' | 'ino'>): Pick<fs.BigIntStats, 'dev' | 'ino'> {
  if (process.platform !== 'win32') return stat;
  const k = library('kernel32.dll');
  const h = nativeFunction('kernel32.dll', 'void *CreateFileW(const char16_t *path, uint32_t access, uint32_t share, void *security, uint32_t disposition, uint32_t flags, void *template)')(
    toNamespacedPath(resolve(path)), 0x80, 7, null, 3, 0x02200000, null);
  if (!h || nativeApi().address(h) === 0xffffffffffffffffn) throw winError('CreateFileW');
  try {
    // BY_HANDLE_FILE_INFORMATION consists entirely of 32-bit fields.
    const info = Buffer.alloc(52);
    if (!nativeFunction('kernel32.dll', 'bool GetFileInformationByHandle(void *handle, _Out_ void *info)')(h, info)) throw winError('GetFileInformationByHandle');
    const attributes = info.readUInt32LE(0), dev = BigInt(info.readUInt32LE(28));
    const ino = BigInt(info.readUInt32LE(44)) << 32n | BigInt(info.readUInt32LE(48));
    if (attributes & (0x400 | 0x10)) throw new Error('File became a reparse point or directory while checking identity');
    if (ino !== stat.ino) throw new FileChangedError('File changed while checking identity');
    return { dev, ino };
  } finally { k.func('bool CloseHandle(void *handle)')(h); }
}

export function privateDirectory(path: string): void {
  fs.mkdirSync(path, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    try { fs.chmodSync(path, 0o700); } catch { /* Match best-effort legacy permissions. */ }
  }
}

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
export function lock(path: string, nonBlocking = false): () => void {
  const key = process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  if (held.has(key)) throw new Error('Recursive acquisition of a synchronous file lock');
  const release = acquire(path, nonBlocking);
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

function acquire(path: string, nonBlocking: boolean): () => void {
  fs.mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (isLinkOrReparse(path)) throw new Error('Unsafe lock target');
  if (process.platform === 'win32') {
    const k = library('kernel32.dll');
    const h = k.func('void *CreateFileW(const char16_t *path, uint32_t access, uint32_t share, void *security, uint32_t disposition, uint32_t flags, void *template)')(path, 0xc0000000, 7, null, 4, 0x80, null);
    if (!h || nativeApi().address(h) === 0xffffffffffffffffn) throw winError('CreateFileW');
    const close = () => { k.func('bool CloseHandle(void *handle)')(h); };
    // Same byte-range namespace as Python's msvcrt.locking, including empty files.
    if (!k.func('bool LockFileEx(void *handle, uint32_t flags, uint32_t reserved, uint32_t low, uint32_t high, _Inout_ void *overlapped)')(h, nonBlocking ? 3 : 2, 0, 1, 0, Buffer.alloc(32))) {
      const error = winError('LockFileEx'); close(); throw error;
    }
    return close;
  }
  const fd = fs.openSync(path, fs.constants.O_CREAT | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
  try {
    fs.fchmodSync(fd, 0o600);
    const flock = nativeFunction(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6', 'int flock(int fd, int op)');
    if (flock(fd, nonBlocking ? 6 : 2)) throw new Error('flock failed');
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
