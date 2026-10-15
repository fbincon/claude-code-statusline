import koffi from 'koffi';
const libraries = new Map<string, ReturnType<typeof koffi.load>>();
export function library(name: string) {
  let value = libraries.get(name);
  if (!value) { value = koffi.load(name); libraries.set(name, value); }
  return value;
}
export function int64(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  throw new TypeError('Native integer is not lossless');
}
export function winError(operation: string): Error {
  const code = library('kernel32.dll').func('uint32_t GetLastError()')();
  return Object.assign(new Error(`${operation}: Win32 ${code}`), { winerror: code });
}
export { koffi };
