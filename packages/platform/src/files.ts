import * as fs from 'node:fs';
import { dirname, basename, join, resolve, toNamespacedPath } from 'node:path';
import { randomUUID } from 'node:crypto';
import { library, nativeApi, nativeFunction, winError } from './native.js';

export class FileChangedError extends Error {
  constructor(message = 'file_changed') { super(message); this.name = 'FileChangedError'; }
}

export class FileLockBusyError extends Error {
  constructor() { super('File lock is busy'); this.name = 'FileLockBusyError'; }
}

type FileIdentity = Pick<fs.BigIntStats, 'dev' | 'ino'>;

function windowsHandleIdentity(handle: unknown): FileIdentity {
  // BY_HANDLE_FILE_INFORMATION consists entirely of 32-bit fields.
  const info = Buffer.alloc(52);
  if (!nativeFunction('kernel32.dll', 'bool GetFileInformationByHandle(void *handle, _Out_ void *info)')(handle, info)) throw winError('GetFileInformationByHandle');
  if (info.readUInt32LE(0) & (0x400 | 0x10)) throw new Error('File became a reparse point or directory while checking identity');
  return { dev: BigInt(info.readUInt32LE(28)), ino: BigInt(info.readUInt32LE(44)) << 32n | BigInt(info.readUInt32LE(48)) };
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
    const identity = windowsHandleIdentity(h);
    if (identity.ino !== stat.ino) throw new FileChangedError('File changed while checking identity');
    return identity;
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
  return trackedLock(path, nonBlocking);
}

function trackedLock(path: string, nonBlocking: boolean, readOnly?: FileIdentity): () => void {
  const key = process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  if (held.has(key)) {
    if (readOnly) throw new FileLockBusyError();
    throw new Error('Recursive acquisition of a synchronous file lock');
  }
  const release = acquire(path, nonBlocking, readOnly);
  held.add(key);
  let active = true;
  return () => { if (active) { active = false; try { release(); } finally { held.delete(key); } } };
}

export function withLock<T>(path: string, action: () => T): T {
  const release = lock(path);
  try { return synchronousResult(action()); } finally { release(); }
}

function synchronousResult<T>(result: T): T {
  if (result !== null && typeof result === 'object' && 'then' in result) throw new TypeError('File lock callbacks must be synchronous');
  return result;
}

function acquire(path: string, nonBlocking: boolean, readOnly?: FileIdentity): () => void {
  if (!readOnly) fs.mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (isLinkOrReparse(path)) throw new Error('Unsafe lock target');
  if (process.platform === 'win32') {
    const k = library('kernel32.dll');
    const h = k.func('void *CreateFileW(const char16_t *path, uint32_t access, uint32_t share, void *security, uint32_t disposition, uint32_t flags, void *template)')(
      readOnly ? toNamespacedPath(resolve(path)) : path, readOnly ? 0x80000000 : 0xc0000000, 7, null, readOnly ? 3 : 4, readOnly ? 0x00200080 : 0x80, null);
    if (!h || nativeApi().address(h) === 0xffffffffffffffffn) {
      const error = winError('CreateFileW');
      if (readOnly && (error as { winerror?: number }).winerror === 32) throw new FileLockBusyError();
      throw error;
    }
    const close = () => { k.func('bool CloseHandle(void *handle)')(h); };
    // Same byte-range namespace as Python's msvcrt.locking, including empty files.
    try {
      if (readOnly && !sameFileIdentity(readOnly, windowsHandleIdentity(h))) throw new FileChangedError();
      const flags = (readOnly ? 0 : 2) | (nonBlocking ? 1 : 0);
      if (!k.func('bool LockFileEx(void *handle, uint32_t flags, uint32_t reserved, uint32_t low, uint32_t high, _Inout_ void *overlapped)')(h, flags, 0, 1, 0, Buffer.alloc(32))) {
        const error = winError('LockFileEx');
        if (readOnly && (error as { winerror?: number }).winerror === 33) throw new FileLockBusyError();
        throw error;
      }
      return close;
    } catch (error) { close(); throw error; }
  }
  const flags = readOnly ? fs.constants.O_RDONLY | fs.constants.O_NONBLOCK : fs.constants.O_CREAT | fs.constants.O_RDWR;
  const fd = fs.openSync(path, flags | fs.constants.O_NOFOLLOW, 0o600);
  try {
    if (readOnly) {
      const opened = fs.fstatSync(fd, { bigint: true });
      if (!opened.isFile() || !sameFileIdentity(readOnly, opened)) throw new FileChangedError();
    } else fs.fchmodSync(fd, 0o600);
    const flock = nativeFunction(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6', 'int flock(int fd, int op)');
    if (flock(fd, (readOnly ? 1 : 2) | (nonBlocking ? 4 : 0))) {
      const api = nativeApi();
      if (readOnly && api.errno() === api.os.errno.EWOULDBLOCK) throw new FileLockBusyError();
      throw new Error('flock failed');
    }
    return () => fs.closeSync(fd);
  } catch (error) { fs.closeSync(fd); throw error; }
}

function existingLockIdentity(path: string): FileIdentity | null {
  const stat = fs.lstatSync(path, { bigint: true, throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isFile() || isLinkOrReparse(path)) throw new Error('Unsafe lock target');
  return fileIdentity(path, stat);
}

function sharedLockIfPresent(path: string): (() => void) | null {
  for (const delay of [0, 5, 15]) {
    if (delay) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
    const identity = existingLockIdentity(path);
    if (!identity) return null;
    try {
      const release = trackedLock(path, true, identity);
      return () => {
        try {
          const current = existingLockIdentity(path);
          if (!current || !sameFileIdentity(identity, current)) throw new FileChangedError();
        } finally { release(); }
      };
    } catch (error) { if (!(error instanceof FileLockBusyError)) throw error; }
  }
  throw new FileLockBusyError();
}

/** Writers keep this lock file after publication. On first use a writer may
 * create it during the optimistic read: discard that result and reread under lock. */
export function readWithExistingLock<T>(path: string, read: (locked: boolean) => T): T {
  let release = sharedLockIfPresent(path);
  if (!release) {
    const candidate = synchronousResult(read(false));
    release = sharedLockIfPresent(path);
    if (!release) return candidate;
  }
  try { return synchronousResult(read(true)); } finally { release(); }
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
