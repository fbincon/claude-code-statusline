import { spawnSync } from 'node:child_process';
import { claudeLaunch } from './commands.js';
import type { LaunchSpec } from './launch.js';
import { decodeUtf8 } from './utf8.js';
import { decode } from '@fbincon/statusline-core/json';
export class UnconfirmedOperation extends Error {
    constructor(message: string) { super(message); this.name = 'UnconfirmedOperation'; }
}
/** No shell, bounded output and time, and no retry of uncertain writes. */
export class PluginHost {
    constructor(readonly configDir: string, readonly command: LaunchSpec = claudeLaunch(), readonly execute = spawnSync) { }
    run(args: readonly string[], values?: Record<string, string>, json = false): unknown {
        const env = { ...process.env, CLAUDE_CONFIG_DIR: this.configDir, DISABLE_AUTOUPDATER: '1' };
        delete (env as NodeJS.ProcessEnv).CLAUDECODE;
        const result = this.execute(this.command.executable, [...this.command.args, 'plugin', ...args], { cwd: this.configDir, env, input: values === undefined ? undefined : JSON.stringify(values), timeout: 45000, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024, shell: false, windowsHide: true });
        if (result.error || result.signal || result.status === null)
            throw new UnconfirmedOperation('Official plugin operation could not be confirmed: ' + args.slice(0, 2).join(' '));
        if (result.status !== 0)
            throw new Error('Official plugin operation refused: ' + decodeUtf8(result.stderr?.length ? result.stderr : result.stdout ?? Buffer.alloc(0)).replace(/[\x00-\x1f\x7f]/gu, ' ').slice(0, 500));
        if (json) {
            try {
                return decode(decodeUtf8(result.stdout));
            }
            catch {
                throw new UnconfirmedOperation('Official plugin operation returned invalid JSON');
            }
        }
        return undefined;
    }
    listing(): [
        Record<string, unknown>[],
        Record<string, unknown>[]
    ] {
        const markets = this.run(['marketplace', 'list', '--json'], undefined, true), plugins = this.run(['list', '--json'], undefined, true);
        for (const value of [markets, plugins])
            if (!Array.isArray(value) || value.some(row => row === null || typeof row !== 'object' || Array.isArray(row)))
                throw new Error('Unexpected official plugin inventory');
        return [markets as Record<string, unknown>[], plugins as Record<string, unknown>[]];
    }
}
