import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
export function isolatedHostEnvironment(environment: NodeJS.ProcessEnv, directory: string): NodeJS.ProcessEnv {
    const result = Object.fromEntries(Object.entries(environment).filter(([key]) => !/^(ANTHROPIC_|AWS_|GOOGLE_|CLAUDE_|CLAUDECODE)/u.test(key)));
    return { ...result, CLAUDE_CONFIG_DIR: directory, DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', ANTHROPIC_API_KEY: 'statusline-types-synthetic', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9' };
}
export function prepareModTypes(plugin: string, executable = 'claude'): string {
    const host = claudeLaunch(executable), env = isolatedHostEnvironment(process.env, '');
    const result = spawnSync(host.executable, [...host.args, '--version'], { encoding: 'utf8', timeout: 10000, env });
    const version = result.stdout?.match(/\d+\.\d+\.\d+/u)?.[0];
    if (result.status !== 0 || !version)
        throw new Error('Cannot determine exact Claude host version');
    const path = join(resolve(plugin), '.claude-plugin/types/claude-code/index.d.ts');
    fs.rmSync(path, { force: true });
    const directory = fs.mkdtempSync(join(tmpdir(), 'statusline-mod-types-'));
    try {
        spawnSync(host.executable, [...host.args, '-p', '/plugin-types', '--plugin-dir', resolve(plugin), '--max-budget-usd', '0.000001', '--no-session-persistence', '--setting-sources', ''], {
            cwd: directory, env: isolatedHostEnvironment(process.env, directory), encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
        });
        if (!fs.existsSync(path))
            throw new Error(`Claude Code ${version} did not emit exact-build declarations`);
        if (fs.readFileSync(path, 'utf8').split(/\r?\n/u)[0] !== `// Written by Claude Code ${version}.`)
            throw new Error('Declaration header does not match actual host');
        return version;
    }
    finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { plugin: { type: 'string', default: 'mods/statusline-native' }, claude: { type: 'string', default: 'claude' } } });
    console.log(JSON.stringify({ host: prepareModTypes(values.plugin!, values.claude), plugin: values.plugin }));
}
