import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { VERSION, PACKAGE_NAME } from '@fbincon/statusline-core/release';
import { Npm, productIdentity, type NpmLayout } from '@fbincon/statusline-platform/npm';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { firstEntry, type FirstEntryOptions } from '../src/management/first-entry.js';
import { pendingPath, MANAGEMENT_ROOT } from '../src/management/store.js';
import { main } from '../src/main.js';
function product(root: string, version = VERSION): void {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(join(root, 'package.json'), JSON.stringify({ name: PACKAGE_NAME, version, type: 'module', bin: { 'claude-statusline': 'bin/claude-statusline.js' } }));
    const files: Record<string, string> = {};
    for (const [path, content] of [['bin/claude-statusline.js', '// bootstrap'], ['node_modules/@fbincon/statusline-cli/dist/src/entry.js', `process.stdout.write('claude-statusline ${version}\\n')`], ['node_modules/@fbincon/statusline-core/dist/src/release.js', `export const VERSION='${version}';`]]) {
        const absolute = join(root, path!);
        fs.mkdirSync(dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, content!);
        files[path!] = createHash('sha256').update(content!).digest('hex');
    }
    fs.writeFileSync(join(root, 'candidate.json'), JSON.stringify({ name: PACKAGE_NAME, version, application_version: version, files }));
}
function fixture(t: TestContext) {
    const root = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'first entry 中文 ')));
    t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    const prefix = join(root, 'persistent prefix'), origin = join(root, 'cache', '_npx', 'run', 'node_modules', PACKAGE_NAME), configDir = join(root, 'config');
    product(origin);
    const layout: NpmLayout = { prefix, root: join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules', PACKAGE_NAME), bin: join(prefix, 'bin/claude-statusline'), registry: 'https://registry.npmjs.org/', npmVersion: '11.19.0', cache: join(root, 'cache') };
    let calls = 0, handed = false, output = '';
    const npm = new Npm({}, undefined, 'test-npm');
    npm.layout = async () => layout;
    npm.verify = async (identity) => { assert(productIdentity(identity.root)); };
    npm.install = async (version) => { calls++; product(layout.root, version); };
    const options: FirstEntryOptions = { configDir, language: 'en', stdout: s => output += s, stderr: s => output += s, tty: true, origin, npm, confirm: async () => true,
        handoff: async (identity) => { handed = true; assert.equal(identity.root, fs.realpathSync.native(layout.root)); assert(!identity.entry.includes('_npx')); return 0; } };
    return { root, prefix, origin, configDir, layout, npm, options, args: ['--prefix', prefix], state: () => ({ calls, handed, output }) };
}
test('first entry reviews exact installation, verifies a durable entry and survives npx cache removal', async (t) => {
    const f = fixture(t);
    assert.equal(await firstEntry(f.args, f.options), 0);
    assert.deepEqual({ calls: f.state().calls, handed: f.state().handed }, { calls: 1, handed: true });
    assert(f.state().output.includes(PACKAGE_NAME + '@' + VERSION));
    assert(f.state().output.includes(f.npm.entry));
    assert(f.state().output.includes(join(f.layout.root, 'node_modules/@fbincon/statusline-cli/dist/src/entry.js')));
    assert(f.state().output.includes(f.configDir));
    assert(!fs.existsSync(pendingPath(f.prefix)));
    fs.rmSync(join(f.root, 'cache'), { recursive: true });
    assert.equal(productIdentity(f.layout.root)?.version, VERSION);
    assert(fs.existsSync(join(f.configDir, MANAGEMENT_ROOT, 'installations')));
    assert(!fs.existsSync(join(f.configDir, 'settings.json')));
    assert(!fs.existsSync(join(f.configDir, 'claude-statusline.json')));
});
test('cancellation, non-TTY and dry-run never create installation or configuration', async (t) => {
    const f = fixture(t);
    assert.equal(await firstEntry(f.args, { ...f.options, confirm: async () => false }), 0);
    assert.equal(await firstEntry(f.args, { ...f.options, tty: false }), 2);
    assert.equal(await firstEntry([...f.args, '--dry-run'], { ...f.options, tty: false }), 0);
    assert(!fs.existsSync(f.prefix));
    assert(!fs.existsSync(f.configDir));
    assert.equal(f.state().calls, 0);
    let output = '';
    assert.equal(await main([], { configDir: f.configDir, stdout: s => output += s, stderr: s => output += s }), 2);
    assert.match(output, /interactive/);
    assert(!fs.existsSync(f.configDir));
});
test('matching persistent installs are reused without writing a prefix lock or reinstalling', async (t) => {
    const f = fixture(t);
    product(f.layout.root);
    assert.equal(await firstEntry(f.args, f.options), 0);
    assert.equal(f.state().calls, 0);
    assert(f.state().handed);
    assert(!fs.existsSync(join(f.prefix, '.claude-statusline-install.lock')));
    assert(!fs.existsSync(f.configDir));
});
test('different installed versions and changed package bytes fail before any package mutation', async (t) => {
    const f = fixture(t);
    product(f.layout.root, '3.6.0');
    assert.equal(await firstEntry(f.args, f.options), 2);
    assert.match(f.state().output, /different version/);
    assert.equal(f.state().calls, 0);
    fs.writeFileSync(join(f.layout.root, 'bin/claude-statusline.js'), 'changed');
    assert.equal(await firstEntry(f.args, f.options), 2);
    assert.equal(f.state().calls, 0);
    assert(!fs.existsSync(f.configDir));
});
test('review-to-install conflicts and development entry points cannot mutate the selected prefix', async (t) => {
    const f = fixture(t);
    assert.equal(await firstEntry(f.args, { ...f.options, origin: null }), 2);
    assert.equal(await firstEntry(f.args, { ...f.options, confirm: async () => { product(f.layout.root, '3.6.0'); return true; } }), 2);
    assert.equal(f.state().calls, 0);
    assert.equal(productIdentity(f.layout.root)?.version, '3.6.0');
    assert(!fs.existsSync(f.configDir));
});
test('uncertain npm outcomes are journaled and cannot be retried blindly', async (t) => {
    const f = fixture(t);
    let attempts = 0;
    f.npm.install = async () => { attempts++; product(f.layout.root); throw new PackageError('timeout'); };
    assert.equal(await firstEntry(f.args, f.options), 2);
    assert(fs.existsSync(pendingPath(f.prefix)));
    assert.match(f.state().output, /Last stage: installing/);
    assert(!f.state().handed);
    assert.equal(await firstEntry(f.args, f.options), 2);
    assert.equal(attempts, 1);
    const pending = JSON.parse(fs.readFileSync(pendingPath(f.prefix), 'utf8'));
    const record = JSON.parse(fs.readFileSync(join(f.configDir, MANAGEMENT_ROOT, 'transactions', pending.id, 'operation.json'), 'utf8'));
    assert.equal(record.stage, 'uncertain');
    assert.equal(record.version, VERSION);
});
