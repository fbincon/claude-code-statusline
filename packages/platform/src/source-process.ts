import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { which } from './commands.js';
import { windowsJobScript } from './windows-source-job.js';
import { windowsSourceEnvironment, WINDOWS_RUNTIME_FOLDERS } from './windows-source-environment.js';
export interface SourceProcessOptions {
    executable: string;
    args: readonly string[];
    cwd: string;
    input: string;
    timeoutMs: number;
    signal?: AbortSignal;
    environment?: NodeJS.ProcessEnv;
}
export interface SourceProcessResult {
    code: number | null;
    stdout: string;
    errorKind?: 'authentication' | 'permission' | 'network' | 'rate_limit' | 'no_checks';
    reason: 'completed' | 'exit' | 'missing_program' | 'timeout' | 'cancelled' | 'output_limit' | 'io_error';
}
/** User commands inherit only the OS essentials, never model/forge credentials. */
export function sourceEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const allowed = new Set(['PATH', 'HOME', 'USER', 'LOGNAME', 'USERPROFILE', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', ...(process.platform === 'win32' ? WINDOWS_RUNTIME_FOLDERS : [])]);
    return Object.fromEntries(Object.entries(env).filter(([key]) => allowed.has(key.toUpperCase())));
}
/** Bound the entire tree, both output streams and the final pipe drain. No shell. */
export function runSourceProcess(options: SourceProcessOptions): Promise<SourceProcessResult> {
    if (options.signal?.aborted)
        return Promise.resolve({ code: null, stdout: '', reason: 'cancelled' });
    return new Promise(resolve => {
        const started = performance.now(), windows = process.platform === 'win32', commandEnvironment = { ...(options.environment ?? sourceEnvironment()) };
        let environment = commandEnvironment;
        let executable = options.executable, args = [...options.args];
        if (windows) {
            const found = which(executable);
            if (!found) {
                resolve({ code: null, stdout: '', reason: 'missing_program' });
                return;
            }
            executable = found;
            try { environment = windowsSourceEnvironment(commandEnvironment); }
            catch { resolve({ code: null, stdout: '', reason: 'io_error' }); return; }
            environment.STATUSLINE_SOURCE_LAUNCH = JSON.stringify({ executable, args, cwd: options.cwd, environment: commandEnvironment });
            executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
            args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(windowsJobScript, 'utf16le').toString('base64')];
        }
        const child = spawn(executable, args, { cwd: options.cwd, env: environment, shell: false, detached: !windows, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let reason: SourceProcessResult['reason'] = 'completed', code: number | null = null, bytes = 0, done = false;
        const chunks: Buffer[] = [], errors: Buffer[] = [];
        let drain: ReturnType<typeof setTimeout> | undefined;
        const kill = () => {
            try {
                if (!windows && child.pid)
                    process.kill(-child.pid, 'SIGKILL');
                else
                    child.kill('SIGKILL');
            }
            catch { /* Already exited. */ }
        };
        const finish = () => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            if (drain)
                clearTimeout(drain);
            options.signal?.removeEventListener('abort', cancel);
            child.stdin.destroy();
            child.stdout.destroy();
            child.stderr.destroy();
            const detail = Buffer.concat(errors).toString('utf8');
            const errorKind: SourceProcessResult['errorKind'] = /^no checks reported on the '[^\r\n]*' branch\s*$/u.test(detail) ? 'no_checks' : /rate limit|HTTP 429/iu.test(detail) ? 'rate_limit' : /HTTP 403|forbidden|not accessible|permission denied/iu.test(detail) ? 'permission' : /HTTP 401|auth login|not logged|authentication/iu.test(detail) ? 'authentication' : /timeout|connection|resolve host|network|TLS|dial tcp|\bEOF\b/iu.test(detail) ? 'network' : undefined;
            resolve({ code, stdout: Buffer.concat(chunks).toString('utf8'), ...(errorKind ? { errorKind } : {}), reason: reason === 'completed' && code !== 0 ? 'exit' : reason });
        };
        const stop = (why: SourceProcessResult['reason']) => {
            if (done || reason !== 'completed')
                return;
            reason = why;
            kill();
            drain = setTimeout(finish, 500);
        };
        const cancel = () => stop('cancelled');
        const timer = setTimeout(() => stop('timeout'), Math.max(1, options.timeoutMs - (performance.now() - started)));
        options.signal?.addEventListener('abort', cancel, { once: true });
        const output = (data: Buffer, stdout: boolean) => {
            bytes += data.length;
            if (bytes > 1048576) {
                stop('output_limit');
                return;
            }
            if (stdout)
                chunks.push(data);
            else
                errors.push(data);
        };
        child.stdout.on('data', data => output(data, true));
        child.stderr.on('data', data => output(data, false));
        child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE')
            stop('io_error'); });
        child.once('error', error => { reason = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing_program' : 'io_error'; finish(); });
        child.once('exit', status => {
            code = status;
            kill(); // Also terminate descendants after their parent exits normally.
            if (!done)
                drain = setTimeout(finish, 500);
        });
        child.once('close', finish);
        child.stdin.end(options.input, 'utf8');
    });
}
