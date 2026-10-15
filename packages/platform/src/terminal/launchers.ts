import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { which } from '../commands.js';
import { library, nativeApi, winError } from '../native.js';
import type { LaunchSpec } from '../launch.js';
import { RESULT_ENV, DEADLINE_ENV, REQUEST_ENV, NONCE_ENV, DEADLINE_SECONDS, type Request } from './bridge.js';
export interface Launcher {
    kind: 'windows-console' | 'tmux' | 'gnome' | 'macos-terminal';
    executable: string;
    pane?: string;
}
export interface Probe {
    which(name: string): string | null;
    directory(path: string): boolean;
    executable(path: string): boolean;
    run(command: string, args: string[]): {
        code: number | null;
        stdout: string;
    };
    uid(): number;
}
export function probe(env: NodeJS.ProcessEnv): Probe {
    return {
        which: name => which(name, env), directory: path => { try {
            return fs.statSync(path).isDirectory();
        }
        catch {
            return false;
        } },
        executable: path => { try {
            fs.accessSync(path, fs.constants.X_OK);
            return true;
        }
        catch {
            return false;
        } },
        run(command, args) { const result = spawnSync(command, args, { env, timeout: 2000, maxBuffer: 16 * 1024, encoding: 'utf8', windowsHide: true }); return { code: result.error ? null : result.status, stdout: result.stdout ?? '' }; },
        uid: () => process.getuid?.() ?? -1,
    };
}
export function chooseLauncher(env: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform, io = probe(env)): Launcher | null {
    if (platform === 'win32')
        return { kind: 'windows-console', executable: process.execPath };
    const pane = env.TMUX_PANE ?? '', tmux = io.which('tmux');
    if (env.TMUX && /^%\d+$/u.test(pane) && tmux) {
        const result = io.run(tmux, ['display-message', '-p', '-t', pane, '#{pane_id}']);
        if (result.code === 0 && result.stdout.trim() === pane)
            return { kind: 'tmux', executable: tmux, pane };
    }
    if (platform === 'darwin') {
        if (env.SSH_CONNECTION || env.SSH_TTY || !io.executable('/usr/bin/open') || !io.directory('/System/Applications/Utilities/Terminal.app'))
            return null;
        if (io.run('/bin/launchctl', ['print', `gui/${io.uid()}`]).code === 0)
            return { kind: 'macos-terminal', executable: '/usr/bin/open' };
        return null;
    }
    const gnome = env.DISPLAY || env.WAYLAND_DISPLAY ? io.which('gnome-terminal') : null;
    return gnome ? { kind: 'gnome', executable: gnome } : null;
}
export function workingDirectory(value: unknown): string {
    if (typeof value === 'string' && isAbsolute(value)) {
        try {
            if (fs.statSync(value).isDirectory())
                return value;
        }
        catch { /* Use the current user's home. */ }
    }
    return homedir();
}
export const shellQuote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
export function bridgeEnvironment(request: Request, directory: string, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return { ...env, [RESULT_ENV]: join(directory, 'result.json'), [DEADLINE_ENV]: String(DEADLINE_SECONDS), [REQUEST_ENV]: join(directory, 'request.json'), [NONCE_ENV]: request.nonce, CLAUDE_CONFIG_DIR: request.configDir };
}
export function launcherArguments(launcher: Launcher, request: Request, directory: string, env: NodeJS.ProcessEnv): string[] {
    const command = [request.backend.executable, ...request.backend.args, 'configure', '--config-dir', request.configDir];
    const bridge = bridgeEnvironment(request, directory, env);
    const environment = ['PATH', RESULT_ENV, DEADLINE_ENV, REQUEST_ENV, NONCE_ENV, 'CLAUDE_CONFIG_DIR'].filter(key => bridge[key] !== undefined).map(key => `${key}=${bridge[key]}`);
    if (launcher.kind === 'windows-console')
        return command;
    if (launcher.kind === 'gnome')
        return [launcher.executable, '--tab', '--active', '--wait', '--title=Configure Status Line', `--working-directory=${request.cwd}`, '--', ...command];
    if (launcher.kind === 'tmux')
        return [launcher.executable, 'display-popup', '-E', '-T', 'Configure Status Line', '-w', '90%', '-h', '90%', '-d', request.cwd, '-t', launcher.pane!, ['/usr/bin/env', ...environment, ...command].map(shellQuote).join(' ')];
    const script = join(directory, 'terminal.command');
    fs.writeFileSync(script, '#!/bin/sh\ncd ' + shellQuote(request.cwd) + '\nexec ' + ['/usr/bin/env', ...environment, ...command].map(shellQuote).join(' ') + '\n', { mode: 0o700, flag: 'wx' });
    return [launcher.executable, '-a', 'Terminal', script];
}
export interface Running {
    code(): number | null;
    error(): Error | null;
    stop(): void;
    close(): void;
}
export function start(argv: string[], cwd: string, env: NodeJS.ProcessEnv): Running {
    const child = spawn(argv[0]!, argv.slice(1), { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let error: Error | null = null, bytes = 0, detail = '';
    child.once('error', value => { error = value; });
    for (const stream of [child.stdout, child.stderr])
        stream.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (detail.length < 2000)
                detail += chunk.toString('utf8').slice(0, 2000 - detail.length);
            if (bytes > 64 * 1024) {
                error = new Error('Terminal launcher output exceeded 64 KiB');
                child.kill('SIGKILL');
            }
        });
    const signalCode = () => child.signalCode ? 128 + (({ SIGINT: 2, SIGTERM: 15, SIGHUP: 1 } as Partial<Record<NodeJS.Signals, number>>)[child.signalCode] ?? 1) : null;
    return { code: () => child.exitCode ?? signalCode(), error: () => error, stop: () => { if (child.exitCode === null && child.signalCode === null)
            child.kill('SIGTERM'); }, close: () => { if (child.exitCode === null && child.signalCode === null)
            child.kill('SIGKILL'); child.stdout.destroy(); child.stderr.destroy(); } };
}
export function windowsCommand(argv: readonly string[]): string {
    if (argv.some(value => value.includes('\0')))
        throw new Error('NUL in Windows argument');
    return argv.map(value => '"' + value.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\+)$/u, '$1$1') + '"').join(' ');
}
/** CREATE_NEW_CONSOLE binds real console handles and never executes an npm .cmd shim. */
export function startWindows(argv: string[], cwd: string, env: NodeJS.ProcessEnv): Running {
    if (process.platform !== 'win32' || process.arch !== 'x64')
        throw new Error('Windows x64 console required');
    const k = library('kernel32.dll'), line = Buffer.from(windowsCommand(argv) + '\0', 'utf16le');
    const variables = new Map<string, [
        string,
        string
    ]>();
    for (const [key, value] of Object.entries(env))
        if (value !== undefined) {
            if (/[=\0]/u.test(key) || value.includes('\0'))
                throw new Error('Invalid Windows environment');
            variables.set(key.toUpperCase(), [key, value]);
        }
    const block = Buffer.from([...variables].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([, [key, value]]) => `${key}=${value}`).join('\0') + '\0\0', 'utf16le');
    const startup = Buffer.alloc(104);
    startup.writeUInt32LE(104);
    const info = Buffer.alloc(24);
    if (!k.func('bool CreateProcessW(const char16_t *app, void *command, void *processSecurity, void *threadSecurity, bool inherit, uint32_t flags, void *environment, const char16_t *cwd, void *startup, _Out_ void *info)')(argv[0], line, null, null, false, 0x410, block, cwd, startup, info))
        throw winError('CreateProcessW');
    const handle = nativeApi().decode(info, 'void *'), thread = nativeApi().decode(info.subarray(8), 'void *');
    let closed = false;
    const code = () => { if (closed)
        return null; const values = [0]; if (!k.func('bool GetExitCodeProcess(void *handle, _Out_ uint32_t *code)')(handle, values))
        throw winError('GetExitCodeProcess'); return values[0] === 259 ? null : values[0]!; };
    const stop = () => {
        if (closed || code() !== null)
            return;
        if (!k.func('bool TerminateProcess(void *handle, uint32_t exit)')(handle, 1))
            throw winError('TerminateProcess');
        if (k.func('uint32_t WaitForSingleObject(void *handle, uint32_t timeout)')(handle, 5000) !== 0)
            throw new Error('Console child termination could not be confirmed');
    };
    return { code, error: () => null, stop, close: () => { if (!closed) {
            try {
                stop();
            }
            finally {
                k.func('bool CloseHandle(void *handle)')(thread);
                k.func('bool CloseHandle(void *handle)')(handle);
                closed = true;
            }
        } } };
}
