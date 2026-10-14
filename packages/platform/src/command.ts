import { spawnSync } from 'node:child_process';
import type { LaunchSpec } from './launch.js';
export interface CommandResult {
    code: number | null;
    stdout: Buffer;
    stderr: Buffer;
}
export interface CommandOptions {
    timeoutMs: number;
    environment?: NodeJS.ProcessEnv;
}
export type CommandRunner = (spec: LaunchSpec, options: CommandOptions) => CommandResult;
export class CommandTimeout extends Error {
}
/** Exact argv, UTF-8 bytes, no shell and no extra console on Windows. */
export const runCommand: CommandRunner = (spec, options) => {
    if (options.timeoutMs <= 0)
        throw new CommandTimeout('Command deadline expired');
    const result = spawnSync(spec.executable, [...spec.args], { timeout: Math.max(1, Math.ceil(options.timeoutMs)),
        env: options.environment ?? process.env, windowsHide: true, maxBuffer: Number.MAX_SAFE_INTEGER, stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.error) {
        if ((result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT')
            throw new CommandTimeout('Command deadline expired');
        throw result.error;
    }
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
};
export function monotonicMilliseconds(): number { return performance.now(); }
