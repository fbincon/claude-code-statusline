import type koffi from 'koffi';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let api: typeof koffi | undefined;
export function nativeApi(): typeof koffi { return api ??= require('koffi') as typeof koffi; }
const libraries = new Map<string, ReturnType<typeof koffi.load>>();
export function library(name: string) {
  let value = libraries.get(name);
  if (!value) { value = nativeApi().load(name); libraries.set(name, value); }
  return value;
}
const functions = new Map<string, ReturnType<ReturnType<typeof koffi.load>['func']>>();
/** Cache bindings, never clock samples, process observations or API failures. */
export function nativeFunction(name: string, signature: string) {
  const key = name + '\0' + signature;
  let value = functions.get(key);
  if (!value) { value = library(name).func(signature); functions.set(key, value); }
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
