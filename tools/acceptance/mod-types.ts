import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { startWindows } from '@fbincon/statusline-platform/terminal/launchers';
import { compareVersions } from '@fbincon/statusline-core/management/compatibility';
import { openPty } from '../migration/ts-04/test/pty.js';
export function isolatedHostEnvironment(environment: NodeJS.ProcessEnv, directory: string): NodeJS.ProcessEnv {
    const result = Object.fromEntries(Object.entries(environment).filter(([key]) => !/^(ANTHROPIC_|AWS_|GOOGLE_|CLAUDE_|CLAUDECODE)/u.test(key)));
    return { ...result, CLAUDE_CONFIG_DIR: directory, DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', ANTHROPIC_API_KEY: 'statusline-types-synthetic', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9' };
}
/** Test-only identity comes from the actual executable, never a guessed SDK level. */
export function recordModHost(plugin: string, version: string): void {
    if (!/^\d+\.\d+\.\d+$/u.test(version)) throw new Error('Invalid actual host identity');
    const directory = join(resolve(plugin), '.claude-plugin/types');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(join(directory, 'host-version.ts'), '// Local test metadata; generated from claude --version.\nexport const HOST_VERSION = ' + JSON.stringify(version) + ';\n');
}
/** A declaration file can appear before its compiler settings and tool types. */
export function declarationIdentity(directory: string, version: string): string | null {
    try {
        const config = fs.readFileSync(join(directory, 'tsconfig.json'));
        const options = JSON.parse(config.toString('utf8')).compilerOptions;
        if (!options || typeof options.target !== 'string' || !Array.isArray(options.types) || !options.types.includes('claude-code')) return null;
        const hash = createHash('sha256').update(config);
        for (const name of options.types) {
            if (typeof name !== 'string' || !/^[\w-]+$/u.test(name)) return null;
            const bytes = fs.readFileSync(join(directory, name, 'index.d.ts'));
            if (!bytes.length || name === 'claude-code' && bytes.toString('utf8').split(/\r?\n/u)[0] !== `// Written by Claude Code ${version}.`) return null;
            hash.update(name).update(bytes);
        }
        return hash.digest('hex');
    } catch { return null; }
}
export async function prepareModTypes(plugin: string, executable = 'claude'): Promise<string> {
    const host = claudeLaunch(executable), env = isolatedHostEnvironment(process.env, '');
    const result = spawnSync(host.executable, [...host.args, '--version'], { encoding: 'utf8', timeout: 10000, env });
    const version = result.stdout?.match(/\d+\.\d+\.\d+/u)?.[0];
    if (result.status !== 0 || !version)
        throw new Error('Cannot determine exact Claude host version');
    const types = join(resolve(plugin), '.claude-plugin/types');
    fs.rmSync(types, { recursive: true, force: true });
    recordModHost(plugin, version);
    let previous: string | null = null, stableSince = 0;
    const ready = () => {
        const current = declarationIdentity(types, version);
        if (current !== previous) { previous = current; stableSince = Date.now(); }
        return current !== null && Date.now() - stableSince >= 100;
    };
    const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'statusline-mod-types-')));
    const debug = join(directory, 'host.log');
    let exitCode: number | null = null;
    try {
        if (compareVersions(version, '2.1.310') >= 0) {
            // Current hosts emit declarations only in an interactive --plugin-dir
            // session. Never send a prompt: /plugin-types is no longer a command.
            const projects = Object.fromEntries([directory, directory.replaceAll('\\', '/')].map(path => [path, { hasTrustDialogAccepted: true }]));
            fs.writeFileSync(join(directory, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, theme: 'dark', projects }));
            const args = [...host.args, '--plugin-dir', resolve(plugin), '--debug-file', debug, '--setting-sources', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'];
            const environment = isolatedHostEnvironment(process.env, directory);
            if (process.platform === 'win32') {
                const child = startWindows([host.executable, ...args], directory, environment);
                try {
                    const deadline = Date.now() + 30000;
                    while (!ready() && child.code() === null && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
                    exitCode = child.code();
                } finally { child.close(); }
            } else {
                const child = openPty(directory, 120, 32, environment, 'en', { executable: host.executable, args, cwd: directory });
                try { await child.wait(ready, 30000); }
                finally { await child.close(); }
            }
        } else {
        spawnSync(host.executable, [...host.args, '-p', '/plugin-types', '--plugin-dir', resolve(plugin), '--max-budget-usd', '0.000001', '--no-session-persistence', '--setting-sources', ''], {
            cwd: directory, env: isolatedHostEnvironment(process.env, directory), encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
        });
        }
        if (!declarationIdentity(types, version))
            throw new Error(`Claude Code ${version} did not emit exact-build declarations: ` + JSON.stringify({ exitCode, log: fs.existsSync(debug) ? fs.readFileSync(debug, 'utf8').slice(-8000) : 'No host log emitted' }));
        return version;
    }
    finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { plugin: { type: 'string', default: 'mods/statusline-native' }, claude: { type: 'string', default: 'claude' } } });
    console.log(JSON.stringify({ host: await prepareModTypes(values.plugin!, values.claude), plugin: values.plugin }));
}
