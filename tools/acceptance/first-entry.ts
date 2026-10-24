import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { npmEntry } from '../build/files.js';
import type { installCandidate } from './install.js';
type Input = Pick<ReturnType<typeof installCandidate>, 'temporary' | 'node' | 'root' | 'env'> & {
    artifact: string;
    npm: string;
};
export async function installedFirstEntry(installed: ReturnType<typeof installCandidate>): Promise<number> {
    const input: Input = { temporary: installed.temporary, node: installed.node, root: installed.root, env: installed.env, artifact: installed.packed.tarball, npm: npmEntry() };
    const program = `import {firstEntryChild} from ${JSON.stringify(import.meta.url)};console.log(JSON.stringify(await firstEntryChild(JSON.parse(process.argv[1]))));`;
    const result = spawnSync(installed.node, ['--input-type=module', '-e', program, JSON.stringify(input)], { encoding: 'utf8', timeout: 180000, windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const receipt = JSON.parse(result.stdout);
    fs.rmSync(receipt.cacheRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    const restarted = spawnSync(installed.node, [receipt.entry, '--version'], { env: installed.env, encoding: 'utf8', timeout: 10000 });
    assert.equal(restarted.status, 0, restarted.stderr);
    assert.equal(restarted.stdout.trim(), 'claude-statusline ' + receipt.version);
    return 4;
}
export async function firstEntryChild(input: Input): Promise<{
    cacheRoot: string;
    entry: string;
    version: string;
}> {
    const cacheRoot = join(input.temporary, 'first-entry-cache'), origin = join(cacheRoot, '_npx', 'fixture', 'node_modules/@fbincon/claude-code-statusline');
    fs.cpSync(input.root, origin, { recursive: true });
    const modules = join(origin, 'node_modules/@fbincon');
    const load = (name: string, path: string) => import(pathToFileURL(join(modules, 'statusline-' + name, 'dist/src', path + '.js')).href);
    const [{ firstEntry }, { Npm }, { VERSION }] = await Promise.all([load('cli', 'management/first-entry'), load('platform', 'npm'), load('core', 'release')]);
    const manifest = JSON.parse(fs.readFileSync(join(origin, 'package.json'), 'utf8')), bytes = fs.readFileSync(input.artifact);
    let registry = '';
    const server = createServer((request, response) => {
        if (request.url === '/package.tgz') {
            response.setHeader('content-type', 'application/octet-stream');
            response.end(bytes);
            return;
        }
        if (decodeURIComponent(request.url ?? '').replace(/\/$/u, '') !== '/@fbincon/claude-code-statusline') {
            response.statusCode = 404;
            response.end('{}');
            return;
        }
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ name: manifest.name, 'dist-tags': { latest: VERSION }, versions: { [VERSION]: { ...manifest, dist: { tarball: registry + 'package.tgz', integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') } } } }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    registry = 'http://127.0.0.1:' + (server.address() as {
        port: number;
    }).port + '/';
    try {
        const configDir = join(input.temporary, 'first-entry-config'), prefix = join(input.temporary, 'global prefix 中文'), empty = join(input.temporary, 'empty-npmrc');
        fs.writeFileSync(empty, '');
        const env = { ...input.env, npm_execpath: input.npm, npm_config_registry: registry, npm_config_userconfig: empty, npm_config_globalconfig: empty, npm_config_cache: cacheRoot };
        const npm = new Npm(env, undefined, input.npm), args = ['--prefix', prefix];
        let review = '', handoff = 0, entry = '';
        const options = { configDir, language: 'en', tty: true, origin, npm, stdout: (s: string) => review += s, stderr: (s: string) => review += s, confirm: async () => true,
            handoff: async (identity: any) => {
                handoff++;
                entry = identity.entry;
                assert(!entry.includes('_npx'));
                const result = spawnSync(input.node, [entry, 'install', '--config-dir', configDir, '--no-native-editor', '--no-experimental-slash-tui', '--no-native-timing', '--no-live-metrics'], { env, encoding: 'utf8', timeout: 30000 });
                assert.equal(result.status, 0, result.stdout + result.stderr);
                const binding = JSON.parse(fs.readFileSync(join(configDir, 'statusline_runtime/installation.json'), 'utf8'));
                assert.equal(binding.launch.args[0], entry);
                const rendered = spawnSync(input.node, [entry, 'render'], { env: { ...env, CLAUDE_CONFIG_DIR: configDir }, input: JSON.stringify({ model: { display_name: 'Durable entry' } }), encoding: 'utf8', timeout: 10000 });
                assert.equal(rendered.status, 0);
                assert(rendered.stdout.includes('Durable entry'));
                return 0;
            } };
        assert.equal(await firstEntry(args, { ...options, confirm: async () => false }), 0, review);
        assert(!fs.existsSync(prefix));
        assert(!fs.existsSync(configDir));
        assert.equal(await firstEntry(args, options), 0, review);
        assert.equal(handoff, 1);
        const settings = fs.readFileSync(join(configDir, 'settings.json'));
        assert.equal(await firstEntry(args, options), 0, review);
        assert.equal(handoff, 2);
        assert.deepEqual(fs.readFileSync(join(configDir, 'settings.json')), settings);
        return { cacheRoot, entry, version: VERSION };
    }
    finally {
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
}
