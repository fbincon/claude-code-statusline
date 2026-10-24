import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { PACKAGE_NAME } from '@fbincon/statusline-core/release';
import { PACKAGE_COMPATIBILITY } from '@fbincon/statusline-core/management/compatibility';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { Npm, globalPackageRoot, globalPackageBin, productIdentity, type NpmLayout, type RegistryPackage } from '@fbincon/statusline-platform/npm';
import { managementOptions, managementRequest } from '../src/management/arguments.js';
import { manage, mutationAuthorized, type ManagementEnvironment } from '../src/management/service.js';
import { pendingPath, readInstallation, readOperation, operationPath, saveOperation, startOperation } from '../src/management/store.js';
import { processToken } from '@fbincon/statusline-platform/processes';
import { configurationBytes, configurationCompatibility } from '../src/management/configuration.js';
function product(prefix: string, version: string) {
    const root = globalPackageRoot(prefix);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(join(root, 'package.json'), JSON.stringify({ name: PACKAGE_NAME, version, bin: { 'claude-statusline': 'bin/claude-statusline.js' }, statuslineCompatibility: PACKAGE_COMPATIBILITY }));
    const files: Record<string, string> = {};
    for (const path of ['bin/claude-statusline.js', 'node_modules/@fbincon/statusline-cli/dist/src/entry.js', 'node_modules/@fbincon/statusline-core/dist/src/release.js']) {
        const absolute = join(root, path);
        fs.mkdirSync(dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, version);
        files[path] = createHash('sha256').update(version).digest('hex');
    }
    fs.writeFileSync(join(root, 'candidate.json'), JSON.stringify({ name: PACKAGE_NAME, version, application_version: version, files }));
    return productIdentity(root, prefix)!;
}
function fixture(t: TestContext) {
    const temporary = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'package management 中文 ')));
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
    const prefix = join(temporary, 'prefix'), configDir = join(temporary, 'config'), origin = globalPackageRoot(join(temporary, 'cache'));
    product(prefix, '3.8.0');
    const bytes = Buffer.from('verified archive'), integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
    const layout: NpmLayout = { prefix, root: globalPackageRoot(prefix), bin: globalPackageBin(prefix), cache: join(temporary, 'cache'), registry: 'https://registry.npmjs.org/', npmVersion: '11.19.0' };
    const npm = new Npm({}, undefined, 'test-npm');
    let output = '', replacements = 0, metadata = 0;
    npm.layout = async () => layout;
    npm.verify = async () => { };
    npm.nodeCompatible = async () => true;
    npm.metadata = async (selector) => { metadata++; return { version: selector === 'latest' ? '3.9.0' : selector, registry: layout.registry, integrity, nodeEngine: '>=22', compatibility: PACKAGE_COMPATIBILITY, legacy: false }; };
    npm.download = async (target, directory) => { fs.mkdirSync(directory, { recursive: true }); const path = join(directory, 'package.tgz'); fs.writeFileSync(path, bytes); return path; };
    npm.installArchive = async (_archive, where) => {
        if (where === prefix)
            replacements++;
        product(where, '3.9.0');
    };
    npm.validateStaged = async (where, target) => { const found = productIdentity(globalPackageRoot(where), where)!; assert.equal(found.version, target.version); return { ...found, integrity: target.integrity, registry: target.registry }; };
    const options: ManagementEnvironment = { origin, environment: {}, tty: true, npm, stdout: s => output += s, stderr: s => output += s, confirm: async () => true };
    const args = (command = 'update', extra: string[] = []) => [command, '--prefix', prefix, '--config-dir', configDir, ...extra];
    const write = (name: string, value: unknown) => { fs.mkdirSync(dirname(join(configDir, name)), { recursive: true, mode: 0o700 }); fs.writeFileSync(join(configDir, name), JSON.stringify(value), { mode: 0o600 }); };
    const state = () => ({ output, replacements, metadata });
    const clear = () => { output = ''; };
    return { temporary, prefix, configDir, layout, npm, options, args, write, state, clear };
}
test('script mutations require exact version, prefix and yes; help and legacy recovery stay separate', () => {
    for (const args of [['update', '--yes'], ['rollback', '--prefix', '/p', '--yes'], ['recover', '--package', '--yes'], ['update', '--version', 'latest'], ['update', '--version', '3.8.0', '--channel', 'latest'], ['rollback', '--channel', 'beta'], ['recover', '--package', '--restore-config', 'pkg-' + 'a'.repeat(36)]])
        assert.throws(() => mutationAuthorized(managementOptions(args), false));
    mutationAuthorized(managementOptions(['update', '--version', '3.8.0', '--prefix', '/p', '--yes']), false);
    mutationAuthorized(managementOptions(['update', '--check', '--json']), false);
    assert(managementRequest(['--language', 'ja', 'recover', '--package']));
    assert(!managementRequest(['recover', '--dry-run']));
    assert(!managementRequest(['update', '--help']));
});
test('check, preview, refusal and unknown prerelease channels never mutate installation or configuration', async (t) => {
    const f = fixture(t);
    assert.equal(await manage(f.args('update', ['--check', '--json']), f.options), 0, f.state().output);
    assert.equal(JSON.parse(f.state().output).artifact_verified, false);
    f.clear();
    assert.equal(await manage(f.args('update', ['--dry-run', '--json']), f.options), 0, f.state().output);
    f.clear();
    assert.equal(await manage(f.args(), { ...f.options, confirm: async () => false }), 0, f.state().output);
    assert.equal(f.state().replacements, 0);
    assert(!fs.existsSync(f.configDir));
    assert(!fs.existsSync(pendingPath(f.prefix)));
    product(f.prefix, '3.9.0-beta.1');
    f.clear();
    assert.equal(await manage(f.args('update', ['--check']), f.options), 2);
    assert.match(f.state().output, /channel/);
});
test('verified update preserves configuration and records original identity, snapshots and history', async (t) => {
    const f = fixture(t);
    f.write('claude-statusline.json', defaultDisplay());
    f.write('settings.json', { env: { KEEP: 'yes' } });
    const before = configurationBytes(f.configDir);
    assert.equal(await manage(f.args(), f.options), 0, f.state().output);
    assert.deepEqual(configurationBytes(f.configDir), before);
    assert.equal(f.state().replacements, 1);
    const history = readInstallation(f.configDir, f.prefix)!;
    assert.equal(history.current.version, '3.9.0');
    assert.equal(history.previous?.version, '3.8.0');
    assert(!fs.existsSync(pendingPath(f.prefix)));
    const operation = readOperation(f.configDir, f.prefix, history.transaction);
    assert.equal(operation.stage, 'complete');
    assert(operation.snapshot);
    assert.deepEqual(operation.results, { package: true, integration: true });
});
test('unknown npm result is reconciled from disk without a second replacement', async (t) => {
    const f = fixture(t), install = f.npm.installArchive.bind(f.npm);
    let failed = false;
    f.npm.installArchive = async (archive, prefix) => {
        await install(archive, prefix);
        if (prefix === f.prefix && !failed) {
            failed = true;
            throw new PackageError('timeout');
        }
    };
    assert.equal(await manage(f.args(), f.options), 2);
    assert.equal(productIdentity(f.layout.root)?.version, '3.9.0');
    assert.equal(readOperation(f.configDir, f.prefix).stage, 'uncertain');
    f.clear();
    assert.equal(await manage(f.args(), f.options), 2);
    assert.equal(f.state().replacements, 1);
    f.clear();
    assert.equal(await manage(f.args('recover', ['--package', '--version', '3.9.0', '--yes']), f.options), 0, f.state().output);
    assert.equal(f.state().replacements, 1);
    assert(!fs.existsSync(pendingPath(f.prefix)));
});
test('post-install integration failure remains incomplete and recovery preserves explicit disabled settings', async (t) => {
    const f = fixture(t), entry = productIdentity(f.layout.root)!.entry;
    f.write('statusline_runtime/installation.json', { owner: 'claude-code-statusline', schema_version: 1, backend_version: '3.8.0', launch: { executable: process.execPath, args: [entry] } });
    f.write('claude-statusline-native.json', { schema_version: 1, native_editor: false });
    let failure = true;
    f.options.host = () => [2, 1, 258];
    f.options.integrate = async (_root, _identity, _config, _host, _hashes, _workspace, dry) => {
        if (!dry && failure)
            throw new PackageError('integration_failed');
    };
    assert.equal(await manage(f.args(), f.options), 2);
    const pending = readOperation(f.configDir, f.prefix);
    assert.equal(pending.results?.package, true);
    assert.equal(pending.results?.integration, false);
    failure = false;
    f.clear();
    assert.equal(await manage(f.args('recover', ['--package', '--version', '3.9.0', '--yes']), f.options), 0, f.state().output);
    assert.equal(JSON.parse(fs.readFileSync(join(f.configDir, 'claude-statusline-native.json'), 'utf8')).native_editor, false);
    assert.equal(f.state().replacements, 1);
});
test('concurrent configuration changes block integration, then explicit recovery accepts the newly reviewed revision', async (t) => {
    const f = fixture(t);
    f.write('claude-statusline.json', defaultDisplay());
    f.options.checkpoint = (stage) => {
        if (stage === 'package_verified')
            f.write('claude-statusline.json', { ...defaultDisplay(), use_colors: false });
    };
    assert.equal(await manage(f.args(), f.options), 2);
    assert.match(f.state().output, /changed after review/);
    f.options.checkpoint = undefined;
    f.clear();
    assert.equal(await manage(f.args('recover', ['--package', '--version', '3.9.0', '--yes']), f.options), 0, f.state().output);
    assert.equal(JSON.parse(fs.readFileSync(join(f.configDir, 'claude-statusline.json'), 'utf8')).use_colors, false);
});
test('configuration restoration is separate, revision checked and never restores execution grants or opt-outs', async (t) => {
    const f = fixture(t);
    f.write('claude-statusline.json', defaultDisplay());
    f.write('claude-statusline-native.json', { schema_version: 1, native_editor: true });
    assert.equal(await manage(f.args(), f.options), 0, f.state().output);
    const id = readInstallation(f.configDir, f.prefix)!.transaction;
    f.write('claude-statusline.json', { ...defaultDisplay(), schema_version: 14 });
    f.write('claude-statusline-native.json', { schema_version: 1, native_editor: false });
    f.write('settings.json', { env: { NEW: 'preserved' } });
    f.clear();
    const args = f.args('recover', ['--restore-config', id]);
    assert.equal(await manage(args, { ...f.options, confirm: async () => { f.write('claude-statusline.json', { ...defaultDisplay(), use_colors: false }); return true; } }), 2);
    assert.equal(JSON.parse(fs.readFileSync(join(f.configDir, 'claude-statusline.json'), 'utf8')).use_colors, false);
    f.clear();
    assert.equal(await manage(args, f.options), 0, f.state().output);
    assert.deepEqual(JSON.parse(fs.readFileSync(join(f.configDir, 'claude-statusline.json'), 'utf8')), defaultDisplay());
    assert.equal(JSON.parse(fs.readFileSync(join(f.configDir, 'claude-statusline-native.json'), 'utf8')).native_editor, false);
    assert.deepEqual(JSON.parse(fs.readFileSync(join(f.configDir, 'settings.json'), 'utf8')), { env: { NEW: 'preserved' } });
    const transaction = readOperation(f.configDir, f.prefix, id);
    fs.unlinkSync(join(dirname(operationPath(transaction)), 'snapshot', 'claude-statusline.json'));
    f.clear();
    assert.equal(await manage(args, f.options), 2);
    assert.match(f.state().output, /snapshot/);
});
test('nested profile schemas, corrupt sources and unknown configuration formats fail before replacement', async (t) => {
    const f = fixture(t);
    f.write('claude-statusline-profiles.json', { version: 1, profiles: [{ id: 'profile', name: 'Future', display: { ...defaultDisplay(), schema_version: 14 } }], bindings: [] });
    assert.deepEqual(configurationCompatibility(configurationBytes(f.configDir), PACKAGE_COMPATIBILITY), ['claude-statusline-profiles.json']);
    assert.equal(await manage(f.args(), f.options), 2);
    assert.equal(f.state().replacements, 0);
    assert(!fs.existsSync(pendingPath(f.prefix)));
});
test('a surviving executor blocks recovery after its transaction owner exits', async (t) => {
    const f = fixture(t);
    f.options.checkpoint = stage => {
        if (stage === 'package_verified')
            throw new PackageError('interrupted');
    };
    assert.equal(await manage(f.args(), f.options), 130);
    const operation = readOperation(f.configDir, f.prefix);
    operation.executors = [{ pid: process.pid, token: processToken(process.pid)! }];
    saveOperation(operation);
    f.options.checkpoint = undefined;
    f.clear();
    assert.equal(await manage(f.args('recover', ['--package', '--version', '3.9.0', '--yes']), f.options), 2);
    assert.equal(f.state().replacements, 1);
    operation.executors = [];
    saveOperation(operation);
    f.clear();
    assert.equal(await manage(f.args('recover', ['--package', '--version', '3.9.0', '--yes']), f.options), 0, f.state().output);
});
test('the prefix lock serializes package changes across distinct configuration directories', async (t) => {
    const f = fixture(t);
    let other: number | undefined;
    const install = f.npm.installArchive.bind(f.npm);
    f.npm.installArchive = async (archive, prefix) => {
        if (prefix === f.prefix) {
            const args = f.args();
            args[args.indexOf('--config-dir') + 1] = join(f.temporary, 'other-config');
            other = await manage(args, { ...f.options, checkpoint: undefined });
        }
        await install(archive, prefix);
    };
    assert.equal(await manage(f.args(), f.options), 0, f.state().output);
    assert.equal(other, 2);
    assert.equal(f.state().replacements, 1);
});
test('an interrupted first install can repair its partial package without inventing a configuration backup', async (t) => {
    const f = fixture(t);
    fs.rmSync(f.layout.root, { recursive: true });
    fs.mkdirSync(f.layout.root, { recursive: true });
    fs.writeFileSync(join(f.layout.root, 'package.json'), JSON.stringify({ name: PACKAGE_NAME, version: '3.9.0' }));
    const operation = startOperation(f.configDir, f.prefix, '3.9.0', f.layout.registry, null);
    operation.stage = 'installing';
    saveOperation(operation);
    assert.equal(await manage(f.args('recover', ['--package', '--version', '3.9.0', '--yes']), f.options), 0, f.state().output);
    assert.equal(productIdentity(f.layout.root)?.version, '3.9.0');
    assert.equal(f.state().replacements, 1);
    assert(!fs.existsSync(join(f.configDir, 'claude-statusline.json')));
    assert.match(f.state().output, /Configuration snapshot: —/);
});
test('default rollback selects the previous successful artifact while retaining current compatible display choices', async (t) => {
    const f = fixture(t);
    f.write('claude-statusline.json', defaultDisplay());
    assert.equal(await manage(f.args(), f.options), 0, f.state().output);
    f.write('claude-statusline.json', { ...defaultDisplay(), use_colors: false });
    f.npm.installArchive = async (_archive, prefix) => { product(prefix, '3.8.0'); };
    f.clear();
    assert.equal(await manage(f.args('rollback'), f.options), 0, f.state().output);
    assert.equal(productIdentity(f.layout.root)?.version, '3.8.0');
    assert.equal(JSON.parse(fs.readFileSync(join(f.configDir, 'claude-statusline.json'), 'utf8')).use_colors, false);
    assert.equal(readInstallation(f.configDir, f.prefix)?.previous?.version, '3.9.0');
});
test('explicit configuration restoration remains available without npm', async (t) => {
    const f = fixture(t);
    f.write('claude-statusline.json', defaultDisplay());
    assert.equal(await manage(f.args(), f.options), 0, f.state().output);
    const id = readInstallation(f.configDir, f.prefix)!.transaction;
    f.write('claude-statusline.json', { ...defaultDisplay(), use_colors: false });
    f.npm.layout = async () => { throw new Error('npm unavailable'); };
    f.clear();
    assert.equal(await manage(f.args('recover', ['--restore-config', id]), f.options), 0, f.state().output);
    assert.equal(JSON.parse(fs.readFileSync(join(f.configDir, 'claude-statusline.json'), 'utf8')).use_colors, true);
});
test('the original CLI and bootstrap imports leave native package modules unloaded before replacement', async () => {
    const { spawnSync } = await import('node:child_process');
    const program = `import {createRequire} from 'node:module';await import(${JSON.stringify(new URL('../src/main.js', import.meta.url).href)});await import(${JSON.stringify(new URL('../src/management/bootstrap.js', import.meta.url).href)});const keys=Object.keys(createRequire(import.meta.url).cache);if(keys.some(k=>k.endsWith('.node')))throw new Error('Native module loaded before independent runner');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
});
test('independent execution preserves relative prefix/config paths and treats a blank config override as unset', async (t) => {
    const f = fixture(t), { managementPaths } = await import('../src/management/bootstrap.js');
    const prepared = managementPaths(['update', '--prefix', './global', '--config-dir=./claude'], { CLAUDE_CONFIG_DIR: './environment-config', KEEP: 'literal' }, f.temporary);
    assert.deepEqual(prepared.args, ['update', '--prefix', join(f.temporary, 'global'), '--config-dir=' + join(f.temporary, 'claude')]);
    assert.equal(prepared.environment.CLAUDE_CONFIG_DIR, join(f.temporary, 'environment-config'));
    assert.equal(prepared.environment.KEEP, 'literal');
    assert.equal(managementPaths(['update'], { CLAUDE_CONFIG_DIR: '   ' }, f.temporary).environment.CLAUDE_CONFIG_DIR, undefined);
});
