import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Npm } from '../src/npm.js';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { PACKAGE_COMPATIBILITY } from '@fbincon/statusline-core/management/compatibility';
import { verifyArchive,type NpmLayout } from '../src/npm.js';
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
test('npm uses Node and literal argv, reports its effective prefix and scoped registry, and never invokes a shell shim', async () => {
    const prefix = resolve(tmpdir(), 'npm prefix 中文 & $`'), root = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules'), calls: readonly string[][] = [];
    const seen: string[][] = [];
    const npm = new Npm({}, async (o) => { seen.push([...o.args]); assert.equal(o.executable, process.execPath); const args = o.args.slice(1); return { code: 0, reason: 'completed', stdout: args[0] === 'prefix' ? prefix : args[0] === 'root' ? root : args[0] === '--version' ? '11.19.0' : args[2] === 'cache' ? resolve(tmpdir(), 'npm cache') : 'https://registry.npmjs.org/' }; }, 'npm-cli.js');
    const layout = await npm.layout();
    assert.equal(layout.prefix, prefix);
    await npm.install('3.8.0', layout);
    const args = seen.at(-1)!;
    assert(args.includes(prefix));
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
    const npm = new Npm({}, async (o) => ({ code: 0, reason: 'completed', stdout: o.args[1] === 'prefix' ? prefix : o.args[1] === 'root' ? root : o.args[1] === '--version' ? '11.19.0' : o.args[3] === 'cache' ? resolve(tmpdir(), 'npm-cache') : 'https://user:secret@example.invalid/' }), 'npm-cli.js');
    await assert.rejects(npm.layout(), (e: unknown) => e instanceof PackageError && e.code === 'registry' && !e.message.includes('secret'));
});
