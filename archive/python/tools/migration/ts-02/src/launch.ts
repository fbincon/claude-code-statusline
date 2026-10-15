import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { atomicWrite, lock } from './files.js';

export interface LaunchSpec { executable: string; args: string[] }
export function binding(options: { backendExecutable: string; backendArgs?: string[] }, override?: string): LaunchSpec {
  if (override) return { executable: override, args: [] };
  if (!options.backendExecutable || /[\0\r\n]/.test(options.backendExecutable) ||
    (options.backendArgs !== undefined && (!Array.isArray(options.backendArgs) || options.backendArgs.some(s => typeof s !== 'string' || s.includes('\0'))))) throw new Error('Invalid binding');
  return { executable: options.backendExecutable, args: [...(options.backendArgs ?? [])] };
}
export function nodeBinding(entry: string): LaunchSpec {
  if (!isAbsolute(entry)) throw new Error('Entry must be absolute');
  return { executable: process.execPath, args: [entry] };
}
export async function run(spec: LaunchSpec, args: string[], stdin = '', timeoutMs = 5000, env = process.env) {
  return await new Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }>((resolve, reject) => {
    const child = spawn(spec.executable, [...spec.args, ...args], { shell: false, env, windowsHide: true, stdio: 'pipe' });
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.stdout.setEncoding('utf8').on('data', s => { stdout += s; });
    child.stderr.setEncoding('utf8').on('data', s => { stderr += s; });
    child.once('close', code => { clearTimeout(timer); resolve({ stdout, stderr, code, timedOut }); });
    child.stdin.on('error', () => {}).end(stdin);
  });
}
// Transaction prototype on an explicitly supplied fixture. No live installation.
export function rebindFixture(path: string, previous: LaunchSpec, next: LaunchSpec, fail = false): void {
  const release = lock(path + '.lock');
  try {
    const original = readFileSync(path);
    const settings = JSON.parse(original.toString()) as Record<string, unknown>;
    if (settings.owner !== 'ts02-fixture' || JSON.stringify(settings.binding) !== JSON.stringify(previous)) throw new Error('Ownership conflict');
    if (existsSync(path + '.backup')) throw new Error('Backup already exists');
    atomicWrite(path + '.backup', original);
    try {
      atomicWrite(path, JSON.stringify({ ...settings, binding: next }));
      if (fail) throw new Error('Injected interruption');
    } catch (error) { atomicWrite(path, original); throw error; }
  } finally { release(); }
}
