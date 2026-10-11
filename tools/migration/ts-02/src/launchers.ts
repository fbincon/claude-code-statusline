import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { processToken, processMatches } from './clocks.js';
import { library, koffi, winError } from './native.js';
import type { LaunchSpec } from './launch.js';

export const quote = (value: string): string => "'" + value.replace(/'/g, "'\\''") + "'";
export interface Request { nonce: string; parent: number; token: string; expires: number; result: string }
export function prepare(directory: string, executable: LaunchSpec): { path: string; request: Request; command: string[] } {
  const token = processToken(process.pid);
  if (!token) throw new Error('Cannot establish parent identity');
  const nonce = randomUUID();
  const request = { nonce, parent: process.pid, token, expires: Date.now() + 30000, result: join(directory, nonce + '.result') };
  const path = join(directory, nonce + '.request');
  writeFileSync(path, JSON.stringify(request), { flag: 'wx', mode: 0o600 });
  return { path, request, command: [executable.executable, ...executable.args, 'launch-helper', path, nonce] };
}
export function helper(path: string, nonce: string): void {
  const request = JSON.parse(readFileSync(path, 'utf8')) as Request;
  if (request.nonce !== nonce || request.expires < Date.now() || !processMatches(request.parent, request.token)) throw new Error('Expired, revoked or reused launcher identity');
  writeFileSync(request.result, JSON.stringify({ nonce, input_tty: Boolean(process.stdin.isTTY), output_tty: Boolean(process.stdout.isTTY) }), { flag: 'wx', mode: 0o600 });
}
export function launcherArgv(kind: 'tmux' | 'gnome' | 'macos', command: string[], directory: string, socket = ''): string[] {
  if (kind === 'gnome') return ['gnome-terminal', '--wait', '--working-directory=' + directory, '--', ...command];
  if (kind === 'tmux') return ['tmux', '-L', socket, 'new-session', '-d', '-x', '80', '-y', '24', command.map(quote).join(' ')];
  const path = join(directory, 'TS02 中文.command');
  writeFileSync(path, '#!/bin/sh\nexec ' + command.map(quote).join(' ') + '\n', { flag: 'wx', mode: 0o700 });
  return ['/usr/bin/open', '-a', 'Terminal', path];
}

export function windowsConsole(command: string[]): void {
  if (process.platform !== 'win32') throw new Error('Windows only');
  const quoted = command.map(s => '"' + s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"').join(' ');
  const line = Buffer.from(quoted + '\0', 'utf16le');
  const startup = Buffer.alloc(104); startup.writeUInt32LE(104);
  const info = Buffer.alloc(24), k = library('kernel32.dll');
  if (!k.func('bool CreateProcessW(const char16_t *app, void *command, void *processSecurity, void *threadSecurity, bool inherit, uint32_t flags, void *environment, const char16_t *cwd, void *startup, _Out_ void *info)')(
    command[0], line, null, null, false, 0x10, null, null, startup, info)) throw winError('CreateProcessW');
  const processHandle = koffi.decode(info, 'void *');
  const threadHandle = koffi.decode(info.subarray(8), 'void *');
  try {
    const result = k.func('uint32_t WaitForSingleObject(void *handle, uint32_t ms)')(processHandle, 10000);
    if (result !== 0) { k.func('bool TerminateProcess(void *handle, uint32_t exit)')(processHandle, 1); throw new Error('New console timeout'); }
    const code = [0];
    if (!k.func('bool GetExitCodeProcess(void *handle, _Out_ uint32_t *code)')(processHandle, code) || code[0] !== 0) {
      let detail = ''; try { detail = readFileSync(command.at(-1)!, 'utf8'); } catch { /* child could not write its receipt */ }
      throw new Error(`New console exited ${code[0]} ${detail}`);
    }
  } finally { k.func('bool CloseHandle(void *handle)')(threadHandle); k.func('bool CloseHandle(void *handle)')(processHandle); }
}
