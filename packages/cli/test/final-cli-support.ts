import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { main } from '../src/main.js';
import type { CliEnvironment } from '../src/main.js';
import { assert, join, repo } from './final-support.js';
import { traceScript } from './trace-script.js';
export async function invoke(args: string[], environment: CliEnvironment) {
    let stdout = '', stderr = '';
    const status = await main(args, { ...environment, stdout: text => { stdout += text; }, stderr: text => { stderr += text; } });
    return { status, stdout, stderr };
}
export function subprocess(root: string, args: string[], input: string | Buffer = '') {
    const result = spawnSync(process.execPath, [join(repo, 'packages/cli/dist/src/entry.js'), ...args], {
        input, encoding: 'utf8', timeout: 20000,
        env: { ...process.env, CLAUDE_CONFIG_DIR: root, CLAUDE_STATUSLINE_RUNTIME_DIR: join(root, 'runtime'), DISABLE_AUTOUPDATER: '1' },
    });
    assert.ifError(result.error);
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
export function traced(root: string, args: string[], input: string) {
    const url = pathToFileURL(join(repo, 'packages/cli/dist/src/main.js')).href;
    const script = traceScript(url, args, input);
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 20000, env: { ...process.env, CLAUDE_CONFIG_DIR: root } });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const trace = JSON.parse(result.stderr) as {
        status: number;
        modules: string[];
    };
    assert.equal(trace.status, 0);
    return { stdout: result.stdout, modules: trace.modules };
}
