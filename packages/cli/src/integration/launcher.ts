import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { prepare, readResult, started, cleanup, LAUNCH_TIMEOUT } from '@fbincon/statusline-platform/terminal/bridge';
import { chooseLauncher, bridgeEnvironment, workingDirectory, launcherArguments, start, startWindows, type Launcher, type Running } from '@fbincon/statusline-platform/terminal/launchers';
import { processMatches } from '@fbincon/statusline-platform/processes';
import { durableUnlink } from '@fbincon/statusline-platform/files';
import { UNAVAILABLE_MESSAGE, type EditorRequest, type EditorResult } from './editor.js';
export interface LauncherEnvironment {
    env?: NodeJS.ProcessEnv;
    choose?: () => Launcher | null;
    run?: typeof start;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    timeoutMs?: number;
}
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export async function stopEditor(identity: {
    pid: number;
    token: string;
} | null, sleep = pause): Promise<void> {
    if (!identity || identity.pid === process.pid || !processMatches(identity.pid, identity.token))
        return;
    try {
        process.kill(identity.pid, 'SIGTERM');
    }
    catch {
        return;
    }
    for (let i = 0; i < 20 && processMatches(identity.pid, identity.token); i++)
        await sleep(50);
    if (processMatches(identity.pid, identity.token)) {
        try {
            process.kill(identity.pid, 'SIGKILL');
        }
        catch { /* Already exited. */ }
    }
}
export async function launchEditor(request: EditorRequest, environment: LauncherEnvironment = {}): Promise<EditorResult> {
    const env = environment.env ?? process.env, launcher = (environment.choose ?? (() => chooseLauncher(env)))();
    if (!launcher)
        return { outcome: 'error', message: UNAVAILABLE_MESSAGE };
    const cwd = workingDirectory(request.cwd), now = environment.now ?? (() => performance.now()), sleep = environment.sleep ?? pause;
    let invocation: ReturnType<typeof prepare> | undefined, running: Running | undefined, identity: {
        pid: number;
        token: string;
    } | null = null;
    try {
        invocation = prepare(request.configDir, request.backend, cwd);
        const argv = launcherArguments(launcher, invocation.request, invocation.directory, env);
        running = (environment.run ?? (launcher.kind === 'windows-console' ? startWindows : start))(argv, cwd, bridgeEnvironment(invocation.request, invocation.directory, env));
        const expires = now() + (environment.timeoutMs ?? LAUNCH_TIMEOUT), startup = now() + 30000;
        for (;;) {
            const error = running.error();
            if (error)
                throw error;
            if (!identity && existsSync(join(invocation.directory, 'started.json')))
                identity = started(invocation.directory, request.configDir, invocation.request.nonce);
            if (identity && existsSync(invocation.result)) {
                const result = readResult(invocation.result, request.configDir), code = running.code();
                if (code !== null && code !== result.exit_code && (launcher.kind !== 'macos-terminal' || code !== 0))
                    throw new Error('Editor result conflicts with launcher exit');
                if (!processMatches(identity.pid, identity.token) && (launcher.kind === 'macos-terminal' || code !== null))
                    return { outcome: result.outcome, message: result.message };
            }
            if (now() >= expires)
                throw new Error('Interactive editor timed out without a confirmed result');
            if (!identity && now() >= startup)
                throw new Error('Interactive terminal did not confirm startup');
            if (!existsSync(invocation.result)) {
                if (launcher.kind !== 'macos-terminal' && running.code() !== null)
                    throw new Error('Interactive editor closed without a confirmed result');
                if (identity && !processMatches(identity.pid, identity.token))
                    throw new Error('Interactive editor ended without a confirmed result');
            }
            await sleep(50);
        }
    }
    catch (error) {
        return { outcome: 'error', message: 'Interactive status line configuration failed: ' + (error instanceof Error ? error.message : String(error)) };
    }
    finally {
        if (invocation) {
            try {
                durableUnlink(invocation.path);
            }
            catch { /* Stop the verified editor even if revocation failed. */ }
        }
        try {
            running?.stop();
        }
        catch { /* Preserve the result and still close native handles. */ }
        await stopEditor(identity, sleep);
        try {
            running?.close();
        }
        catch { /* A failed reap is already an unconfirmed launcher result. */ }
        if (invocation) {
            try {
                cleanup(invocation.directory);
            }
            catch { /* Leave a recoverable private invocation. */ }
        }
    }
}
