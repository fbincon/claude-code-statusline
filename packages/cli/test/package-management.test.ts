import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
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
    const review = JSON.parse(f.state().output);
    assert.equal(review.artifact_verified, false);
    assert.equal(review.config_dir, f.configDir);
    assert.equal(review.npm_entry, f.npm.entry);
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
    f.write('claude-statusline.json', { ...defaultDisplay(), schema_version: PACKAGE_COMPATIBILITY.read.display[1] + 1 });
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
    f.write('claude-statusline-profiles.json', { version: 1, profiles: [{ id: 'profile', name: 'Future', display: { ...defaultDisplay(), schema_version: PACKAGE_COMPATIBILITY.read.display[1] + 1 } }], bindings: [] });
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

// Editor reviews share UPDATE-01, but never enter its mutation/transaction branch.
import { inspectPackage } from '../src/management/inspection.js';
import { readRegular } from '../src/recovery/journal.js';
import { reviewPackage } from '../src/management/review.js';
import { startPackageReview, packageReviewJob, reviewFolder, writeReviewRecord, type ReviewRecord, REVIEW_DEADLINE_MS } from '../src/management/review-jobs.js';
import type { PackageReviewRequest } from '@fbincon/statusline-core/contracts/ui';
test('ordinary npm manifest permissions do not become recovery permissions or write configuration', t => {
    const f = fixture(t), context = { configDir: f.configDir, origin: f.options.origin, hostVersion: () => null };
    const path = join(f.layout.root, 'package.json'), bytes = fs.readFileSync(path);
    for (const mode of [0o600, 0o644, 0o664]) {
        fs.chmodSync(path, mode);
        const before = fs.statSync(path).mode;
        const status = inspectPackage(context, f.prefix);
        assert.equal(status.current, '3.8.0');
        assert.equal(status.compatible, true, JSON.stringify(status.reasons));
        assert.deepEqual(status.reasons, []);
        assert.deepEqual(fs.readFileSync(path), bytes);
        assert.equal(fs.statSync(path).mode, before);
        assert(!fs.existsSync(f.configDir));
        assert.equal(f.state().metadata, 0);
        if (process.platform !== 'win32' && mode !== 0o600) assert.throws(() => readRegular(path), /non-private/);
    }
});
test('local package inspection performs no npm calls and reports corrupt backups without repairing them', t=>{
    const f=fixture(t),context={configDir:f.configDir,origin:f.options.origin,hostVersion:()=>null};
    const state=inspectPackage(context,f.prefix);
    assert.equal(state.current,'3.8.0');assert.equal(state.prefix,f.prefix);assert.equal(f.state().metadata,0);assert(!fs.existsSync(f.configDir));
    const operation=startOperation(f.configDir,f.prefix,'3.9.0',f.layout.registry,productIdentity(f.layout.root,f.prefix)!);
    operation.snapshot=Object.fromEntries(Object.keys(configurationBytes(f.configDir)).map(key=>[key,'0'.repeat(64)]));saveOperation(operation);
    const raw=fs.readFileSync(operationPath(operation));
    const result=inspectPackage(context,f.prefix);
    assert.equal(result.pending?.backup,'invalid');assert.equal(result.history[0]?.backup,'invalid');
    assert.deepEqual(fs.readFileSync(operationPath(operation)),raw);
});
test('editor metadata and verified reviews distinguish artifact verification and preserve all installed bytes',async t=>{
    const f=fixture(t),context={configDir:f.configDir,origin:f.options.origin,hostVersion:()=>null},before=fs.readFileSync(join(f.layout.root,'candidate.json'));
    const status=inspectPackage(context,f.prefix);
    const request:PackageReviewRequest={action:'check',prefix:f.prefix,expected_revision:status.revision,target:null,channel:'latest',backup_id:null,expected_integrity:null};
    const metadata=await reviewPackage(request,context,f.options);assert.equal(metadata.artifact_verified,false);assert.equal(metadata.target,'3.9.0');
    const verified=await reviewPackage({...request,action:'update',target:metadata.target,channel:null,expected_integrity:metadata.integrity},context,f.options);
    assert.equal(verified.artifact_verified,true);assert.equal(f.state().replacements,0);
    assert.deepEqual(fs.readFileSync(join(f.layout.root,'candidate.json')),before);assert(!fs.existsSync(f.configDir));assert(!fs.existsSync(pendingPath(f.prefix)));
});
test('stale identity and changed integrity block editor reviews before downloading or replacing anything',async t=>{
    const f=fixture(t),context={configDir:f.configDir,origin:f.options.origin,hostVersion:()=>null};
    const request:PackageReviewRequest={action:'update',prefix:f.prefix,expected_revision:inspectPackage(context,f.prefix).revision,target:'3.9.0',channel:null,backup_id:null,expected_integrity:'sha512-'+Buffer.alloc(64).toString('base64')};
    f.npm.download=async()=>assert.fail('Unreviewed integrity must not be downloaded');
    await assert.rejects(reviewPackage(request,context,f.options),/integrity/);
    f.write('claude-statusline.json',defaultDisplay());
    await assert.rejects(reviewPackage(request,context,f.options),/conflict/);assert.equal(f.state().replacements,0);
});
test('package review worker ownership prevents another view from cancelling it',async t=>{
    const f=fixture(t),context={configDir:f.configDir,origin:f.options.origin,hostVersion:()=>null};
    const request:PackageReviewRequest={action:'check',prefix:f.prefix,expected_revision:inspectPackage(context,f.prefix).revision,target:null,channel:'latest',backup_id:null,expected_integrity:null};
    const owner='viewer-test-owner-123456789',job=startPackageReview(context,request,owner),folder=reviewFolder(job.id);
    assert.throws(()=>packageReviewJob(context,job.id,'viewer-other-owner-123456789',true),/identity/);
    assert(!fs.existsSync(join(folder,'cancel.json')));
    assert.equal(packageReviewJob(context,job.id,owner,true).state,'cancelled');
    const until=Date.now()+15000;while(fs.existsSync(folder)&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,50));
    assert(!fs.existsSync(folder),'Cancelled worker cleans its private temporary directory');assert(!fs.existsSync(f.configDir));
});
test('review startup grace excludes runner preparation while the overall deadline stays bounded',t=>{
    const f=fixture(t),context={configDir:f.configDir,origin:f.options.origin,hostVersion:()=>null},id='review-'+randomUUID(),owner='viewer-startup-grace-123456789';
    const request:PackageReviewRequest={action:'check',prefix:f.prefix,expected_revision:inspectPackage(context,f.prefix).revision,target:null,channel:'latest',backup_id:null,expected_integrity:null};
    const record:ReviewRecord={configDir:f.configDir,origin:f.options.origin,pid:null,token:null,launched_at:new Date().toISOString(),job:{version:1,id,owner,state:'running',started_at:new Date(Date.now()-60000).toISOString(),finished_at:null,request,review:null,error:null}};
    t.after(()=>fs.rmSync(reviewFolder(id),{recursive:true,force:true}));writeReviewRecord(record);
    assert.equal(packageReviewJob(context,id,owner).state,'running');
    record.launched_at=new Date(Date.now()-16000).toISOString();writeReviewRecord(record);assert.equal(packageReviewJob(context,id,owner).error,'interrupted');
    delete record.launched_at;writeReviewRecord(record);assert.equal(packageReviewJob(context,id,owner).error,'interrupted');
    record.pid=process.pid;record.token=null;writeReviewRecord(record);assert.equal(packageReviewJob(context,id,owner).state,'running','Unknown identity must retain the worker and its files until the overall deadline');
    record.launched_at=new Date().toISOString();record.job.started_at=new Date(Date.now()-REVIEW_DEADLINE_MS-1).toISOString();writeReviewRecord(record);assert.equal(packageReviewJob(context,id,owner).error,'interrupted');
});

import { executionFolder, writeExecution, readExecution, executeReviewed, detachExecution, type ExecutionRecord } from '../src/management/execution.js';
import { reviewHistory, cleanupHistory } from '../src/management/history.js';
import { finishOperation } from '../src/management/store.js';
import mutableFs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
async function reviewedExecution(f:ReturnType<typeof fixture>):Promise<ExecutionRecord>{
    const context={configDir:f.configDir,origin:f.options.origin,hostVersion:()=>null},status=inspectPackage(context,f.prefix);
    const request:PackageReviewRequest={action:'update',prefix:f.prefix,expected_revision:status.revision,target:'3.9.0',channel:null,backup_id:null,expected_integrity:null};
    const review=await reviewPackage(request,context,{...f.options,host:()=>null});
    const id='execution-00000000-0000-0000-0000-000000000001',folder=executionFolder(f.configDir,id),stamp=new Date().toISOString();
    const record:ExecutionRecord={schema_version:1,owner:'viewer-test-owner-12345',configDir:f.configDir,origin:f.options.origin,request,review,pid:null,token:null,value:{version:1,id,transaction_id:null,action:'update',prefix:f.prefix,state:'running',stage:'queued',started_at:stamp,updated_at:stamp,finished_at:null,error:null,running:null,results:{package:null,integration:null,configuration:null},control:{executable:process.execPath,args:[join(folder,'runner/bin/claude-statusline.js')],config_dir:f.configDir}}};
    fs.mkdirSync(folder,{recursive:true,mode:0o700});writeExecution(record);return record;
}
test('reviewed editor execution rechecks identity, persists transaction progress and preserves user configuration',async t=>{
    const f=fixture(t);f.write('settings.json',{env:{KEEP:'yes'}});const before=configurationBytes(f.configDir),record=await reviewedExecution(f);
    assert.equal(await executeReviewed(record,{...f.options,host:()=>null}),0);
    const final=readExecution(f.configDir,record.value.id);assert.equal(final.value.stage,'complete');assert(final.value.transaction_id);assert.equal(final.value.results.package,true);assert.equal(final.value.results.integration,true);assert.deepEqual(configurationBytes(f.configDir),before);assert.equal(f.state().replacements,1);
});
test('a reviewed editor execution refuses changes during staging and cannot silently change the reviewed archive',async t=>{
    const f=fixture(t),record=await reviewedExecution(f),install=f.npm.installArchive;
    f.npm.installArchive=async(archive,prefix)=>{await install(archive,prefix);if(prefix!==f.prefix)f.write('settings.json',{changed:true});};
    assert.equal(await executeReviewed(record,{...f.options,host:()=>null}),2);assert.equal(f.state().replacements,0);assert.equal(record.value.error,'conflict');
});
test('editor detachment does not cancel a worker or overwrite its progress',async t=>{
    const f=fixture(t),record=await reviewedExecution(f);record.pid=process.pid;record.token=processToken(process.pid)!;record.value.stage='installing';writeExecution(record);
    assert.throws(()=>detachExecution(f.configDir,record.value.id,'invalid owner'));detachExecution(f.configDir,record.value.id,'reopened-view');
    detachExecution(f.configDir,record.value.id,record.owner);const status=readExecution(f.configDir,record.value.id);assert.equal(status.value.stage,'installing');assert.equal(status.value.state,'running');assert.equal(status.detached,true);
});
test('editor progress reads a complete private replacement instead of reporting a damaged journal',async t=>{
    const f=fixture(t),record=await reviewedExecution(f),path=join(executionFolder(f.configDir,record.value.id),'execution.json'),next=path+'.next';
    record.value.stage='installing';fs.writeFileSync(next,JSON.stringify(record),{mode:0o600});
    const open=mutableFs.openSync;let replaced=false;
    t.mock.method(mutableFs,'openSync',(...args:Parameters<typeof mutableFs.openSync>)=>{
        if(String(args[0])===path&&!replaced){replaced=true;fs.renameSync(next,path);}
        return open(...args);
    });
    syncBuiltinESMExports();
    try {assert.equal(readExecution(f.configDir,record.value.id).value.stage,'installing');assert(replaced);}
    finally {t.mock.restoreAll();syncBuiltinESMExports();}
});
test('protected cleanup retains current and previous inputs, rejects foreign material and deletes only the reviewed record',async t=>{
    const f=fixture(t),context={configDir:f.configDir,origin:f.options.origin,hostVersion:()=>null};assert.equal(await manage(f.args(),f.options),0);
    const current=readInstallation(f.configDir,f.prefix)!;
    const old=startOperation(f.configDir,f.prefix,'3.7.1',f.layout.registry,null);old.after={...productIdentity(f.layout.root,f.prefix)!,version:'3.7.1'};finishOperation(old);
    const review=reviewHistory(context,f.prefix);assert.equal(review.uncertain,false);assert.equal(review.rows.find(row=>row.id===current.transaction)!.removable,false);assert.equal(review.rows.find(row=>row.id===old.id)!.removable,true);
    const worker=await reviewedExecution(f);worker.request.backup_id=old.id;worker.value.state='running';worker.pid=process.pid;worker.token=processToken(process.pid)!;writeExecution(worker);
    const reserved=reviewHistory(context,f.prefix);assert.equal(reserved.rows.find(row=>row.id===old.id)!.removable,false);assert.throws(()=>cleanupHistory(context,f.prefix,reserved.revision,[old.id]));
    fs.rmSync(executionFolder(f.configDir,worker.value.id),{recursive:true,force:true});
    const extra=join(dirname(operationPath(old)),'foreign.txt');fs.writeFileSync(extra,'keep');assert.throws(()=>cleanupHistory(context,f.prefix,review.revision,[old.id]));assert(fs.existsSync(extra));fs.unlinkSync(extra);
    assert.throws(()=>cleanupHistory(context,f.prefix,review.revision,[current.transaction]));cleanupHistory(context,f.prefix,review.revision,[old.id]);assert(!fs.existsSync(operationPath(old)));assert(fs.existsSync(join(f.configDir,'statusline_runtime/package-management/transactions',current.transaction,'operation.json')));
});

test('history cleanup protects the retained controller executing the cleanup itself',async t=>{
    const f=fixture(t),record=await reviewedExecution(f);record.value.state='complete';record.pid=process.pid;record.token='obsolete-worker-identity';writeExecution(record);detachExecution(f.configDir,record.value.id,record.owner);
    const context={configDir:f.configDir,origin:f.options.origin,hostVersion:()=>null};
    assert.equal(reviewHistory(context,f.prefix).rows.find(row=>row.id===record.value.id)!.removable,true);
    const controller={...context,origin:record.value.control.args[0]!},protectedReview=reviewHistory(controller,f.prefix);
    assert(protectedReview.rows.find(row=>row.id===record.value.id)!.reasons.includes('attached'));
    assert.throws(()=>cleanupHistory(controller,f.prefix,protectedReview.revision,[record.value.id]));assert(fs.existsSync(executionFolder(f.configDir,record.value.id)));
});
