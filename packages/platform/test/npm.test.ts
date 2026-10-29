import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Npm, readPackageManifest } from '../src/npm.js';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { PACKAGE_COMPATIBILITY } from '@fbincon/statusline-core/management/compatibility';
import { verifyArchive,type NpmLayout } from '../src/npm.js';
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { resolvedPath } from '../src/commands.js';
import { removeTree } from '../src/remove-tree.js';
test('ordinary package manifests accept public permissions and reject unsafe or malformed inputs without writes', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'package manifest 中文 ')), path = join(root, 'package.json');
    t.after(() => removeTree(root));
    const manifest = { name: '@fbincon/claude-code-statusline', version: '3.12.0' }, bytes = Buffer.from(JSON.stringify(manifest));
    fs.writeFileSync(path, bytes);
    for (const mode of process.platform === 'win32' ? [0o600] : [0o600, 0o644, 0o664]) {
        fs.chmodSync(path, mode); const actual = fs.statSync(path).mode;
        assert.deepEqual(readPackageManifest(root), manifest);
        assert.deepEqual(fs.readFileSync(path), bytes); assert.equal(fs.statSync(path).mode, actual);
    }
    for (const invalid of [Buffer.from('null'), Buffer.from('[]'), Buffer.from('{'), Buffer.from([0xff]), Buffer.alloc(1048577, 32)]) {
        fs.writeFileSync(path, invalid); assert.throws(() => readPackageManifest(root), error => error instanceof PackageError && error.code === 'identity');
        assert.deepEqual(fs.readFileSync(path), invalid);
    }
    fs.unlinkSync(path);
    assert.throws(() => readPackageManifest(root), PackageError);
    if (process.platform !== 'win32') {
        const outside = join(root, 'outside.json'); fs.writeFileSync(outside, bytes); fs.symlinkSync(outside, path);
        assert.throws(() => readPackageManifest(root), PackageError); assert.deepEqual(fs.readFileSync(outside), bytes); fs.unlinkSync(path);
    }
    fs.mkdirSync(path); assert.throws(() => readPackageManifest(root), PackageError);
});
test('npm uses Node and literal argv, reports its effective prefix and scoped registry, and never invokes a shell shim', async () => {
    const prefix = resolve(tmpdir(), 'npm prefix 中文 & $`'), root = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules'), calls: readonly string[][] = [];
    const seen: string[][] = [];
    const npm = new Npm({}, async (o) => { seen.push([...o.args]); assert.equal(o.executable, process.execPath); const args = o.args.slice(1); return { code: 0, reason: 'completed', stdout: args[0] === 'prefix' ? prefix : args[0] === 'root' ? root : args[0] === '--version' ? '11.19.0' : JSON.stringify({cache:resolve(tmpdir(), 'npm cache'),registry:'https://registry.npmjs.org/','@fbincon:registry':'https://scoped.example.invalid/'}) }; }, 'npm-cli.js');
    const layout = await npm.layout();
    assert.equal(layout.prefix, resolvedPath(prefix));
    assert.equal(layout.registry,'https://scoped.example.invalid/');
    assert.equal(seen.filter(args=>args[1]==='config').length,1);
    await npm.install('3.8.0', layout);
    const args = seen.at(-1)!;
    assert(args.includes(resolvedPath(prefix)));
    assert(args.includes('--ignore-scripts'));
    assert(args.includes('@fbincon/claude-code-statusline@3.8.0'));
    await assert.rejects(npm.install('latest', layout), PackageError);
    void calls;
});
test('version metadata binds exact identity, integrity and compatibility without accepting forged legacy declarations',async()=>{
    const layout={registry:'https://registry.npmjs.org/'} as NpmLayout;
    const valid={name:'@fbincon/claude-code-statusline',version:'3.8.0',engines:{node:'>=22'},dist:{integrity:'sha512-'+Buffer.alloc(64).toString('base64')},statuslineCompatibility:PACKAGE_COMPATIBILITY};
    for(const patch of [{name:'foreign'},{version:'3.9.0'},{dist:{integrity:'sha1-unknown'}},{statuslineCompatibility:undefined},{engines:{node:'\x1b[31m'}}]){
        const npm=new Npm({},async()=>({code:0,reason:'completed',stdout:JSON.stringify({...valid,...patch})}),'npm-cli.js');await assert.rejects(npm.metadata('3.8.0',layout),PackageError);
    }
    const legacy=new Npm({},async()=>({code:0,reason:'completed',stdout:JSON.stringify({...valid,version:'3.7.0'})}),'npm-cli.js');await assert.rejects(legacy.metadata('3.7.0',layout),PackageError);
    const good=new Npm({},async()=>({code:0,reason:'completed',stdout:JSON.stringify(valid)}),'npm-cli.js');assert.equal((await good.metadata('latest',layout)).version,'3.8.0');
    const damaged=new Npm({},async()=>({code:1,reason:'exit',stdout:JSON.stringify({error:{code:'EINTEGRITY',detail:'private registry material'}})}),'npm-cli.js');
    await assert.rejects(damaged.run(['pack','--json']),e=>e instanceof PackageError && e.code==='integrity' && !e.message.includes('private'));
});
test('archive verification rejects changed bytes and pins historical 3.7.0 beyond registry metadata',t=>{
    const root=fs.mkdtempSync(join(tmpdir(),'archive-integrity-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const path=join(root,'target.tgz'),bytes=Buffer.from('test artifact');fs.writeFileSync(path,bytes);
    const target={version:'3.8.0',registry:'https://registry.npmjs.org/',nodeEngine:'>=22',compatibility:PACKAGE_COMPATIBILITY,integrity:'sha512-'+createHash('sha512').update(bytes).digest('base64'),legacy:false};
    verifyArchive(path,target);assert.throws(()=>verifyArchive(path,{...target,version:'3.7.0',legacy:true}),PackageError);
    fs.appendFileSync(path,'changed');assert.throws(()=>verifyArchive(path,target),PackageError);
});
test('invalid registry credentials, malformed locations and process failures are rejected without raw stderr', async () => {
    for (const result of [{ code: 1, reason: 'exit' as const, stdout: '' }, { code: null, reason: 'timeout' as const, stdout: '' }, { code: null, reason: 'cancelled' as const, stdout: '' }]) {
        const npm = new Npm({}, async () => result, 'npm-cli.js');
        await assert.rejects(npm.layout(), PackageError);
    }
    const prefix = resolve(tmpdir(), 'npm prefix'), root = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules');
    const npm = new Npm({}, async (o) => ({ code: 0, reason: 'completed', stdout: o.args[1] === 'prefix' ? prefix : o.args[1] === 'root' ? root : o.args[1] === '--version' ? '11.19.0' : JSON.stringify({cache:resolve(tmpdir(), 'npm-cache'),registry:'https://user:secret@example.invalid/'}) }), 'npm-cli.js');
    await assert.rejects(npm.layout(), (e: unknown) => e instanceof PackageError && e.code === 'registry' && !e.message.includes('secret'));
});

test('batched npm configuration preserves default registry and rejects malformed JSON without leaking it', async () => {
    const prefix = resolve(tmpdir(), 'batched npm prefix'), root = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules');
    for (const config of ['private-malformed-value', 'null', '[]', JSON.stringify({ cache: resolve(tmpdir(), 'cache'), registry: 'https://registry.npmjs.org/' })]) {
        const npm = new Npm({}, async o => ({ code: 0, reason: 'completed', stdout: o.args[1] === 'root' ? root : o.args[1] === '--version' ? '11.19.0' : config }), 'npm-cli.js');
        if (config.startsWith('{')) assert.equal((await npm.layout(prefix)).registry, 'https://registry.npmjs.org/');
        else await assert.rejects(npm.layout(prefix), error => error instanceof PackageError && !error.message.includes('private-malformed'));
    }
});

test('opt-in process timing publishes durations without private arguments or environments', async t => {
    const { channel } = await import('node:diagnostics_channel');
    const events: unknown[] = [], listener = (value: unknown) => events.push(value), timing = channel('claude-statusline.management-timing');
    timing.subscribe(listener); t.after(() => timing.unsubscribe(listener));
    const npm = new Npm({ PRIVATE_SECRET: 'private-value' }, async () => ({ code: 0, reason: 'completed', stdout: 'result' }), 'private-path/npm-cli.js');
    assert.equal(await npm.run(['view', 'private-package', '--registry', 'https://private.example.invalid/']), 'result');
    assert.equal(events.length, 1); assert.deepEqual(Object.keys(events[0] as object).sort(), ['elapsed_ms', 'phase']);
    assert(!JSON.stringify(events).includes('private')); assert.equal((events[0] as any).phase, 'npm.view');
});
