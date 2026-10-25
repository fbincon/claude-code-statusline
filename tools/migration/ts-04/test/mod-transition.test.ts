import test from 'node:test';
import { fresh, snapshot, assert, fs, join, NATIVE, RUNTIME, jsonBytes } from './install-support.js';
import { bundledFiles, inventory } from '@fbincon/statusline-cli/integration/resources';
import { prepareModDowngrade } from '@fbincon/statusline-cli/management/mod-transition';
import { configurationBytes, configurationHashes } from '@fbincon/statusline-cli/management/configuration';
import { PACKAGE_NAME } from '@fbincon/statusline-core/release';
import { BINDING_FILE } from '@fbincon/statusline-cli/integration/ownership';

function target(f: ReturnType<typeof fresh>): string {
    const root=join(f.temporary,'older target');
    for (const spec of [NATIVE,RUNTIME]) {
        const resources=join(root,'node_modules/@fbincon/statusline-cli/resources',spec.name);
        const files=new Map(bundledFiles(spec).files);files.delete('resource-manifest.json');
        const manifest=JSON.parse(files.get('.claude-plugin/plugin.json')!.toString());manifest.version='3.7.0';files.set('.claude-plugin/plugin.json',jsonBytes(manifest));
        const record=inventory(files,{...spec,protocol:spec===NATIVE?21:3},'3.7.0');files.set('resource-manifest.json',jsonBytes(record));
        for(const [name,bytes] of files){const path=join(resources,name);fs.mkdirSync(join(path,'..'),{recursive:true});fs.writeFileSync(path,bytes);}
    }
    fs.writeFileSync(join(root,'package.json'),JSON.stringify({name:PACKAGE_NAME,version:'3.7.0'}));return root;
}
test('cross-protocol Mod handoff refreshes verified bytes while retaining explicit disablement and preferences',t=>{
    for(const mode of ['enabled','plugin-disabled','opt-out','restricted','disabled-intent']) {
        const f=fresh(t);assert.equal(f.install({native:true}).failed,false);const root=target(f);
        if(mode==='plugin-disabled')f.host.run(['disable',NATIVE.plugin]);
        if(mode==='opt-out')f.put('claude-statusline-native.json',{schema_version:1,native_editor:false});
        if(mode==='restricted')f.host.set('disableAllHooks',true);
        if(mode==='disabled-intent')f.put(BINDING_FILE,{...f.json(BINDING_FILE),refresh_disabled:[NATIVE.name]});
        const before=configurationBytes(f.root),expected=configurationHashes(before), snapshotBefore=snapshot(f.root);
        assert.deepEqual(prepareModDowngrade(f.context,root,'3.7.0',expected,true),expected);assert.deepEqual(snapshot(f.root),snapshotBefore);
        const hashes=prepareModDowngrade(f.context,root,'3.7.0',expected,false);
        assert.deepEqual(hashes,configurationHashes(configurationBytes(f.root)));
        assert.deepEqual(configurationBytes(f.root)['claude-statusline-native.json'],before['claude-statusline-native.json']);
        if(mode==='opt-out')assert.equal(f.host.plugins.length,0);
        else {
            assert.equal(f.json(NATIVE.name+'/.claude-statusline-owner.json').protocol_version,21);
            assert.equal(f.host.plugins[0]!.version,'3.7.0');
            assert.equal(f.host.listing()[1][0]!.enabled,mode==='enabled');
        }
    }
});
test('cross-protocol handoff refuses changed settings and modified owned or target bytes before writing',t=>{
    for(const change of ['configuration','owned','target']) {
        const f=fresh(t);f.install({native:true});const root=target(f),expected=configurationHashes(configurationBytes(f.root));
        if(change==='configuration')f.host.set('env',{CHANGED:'keep'});
        else if(change==='owned')f.put(NATIVE.name+'/plugins/'+NATIVE.name+'/hooks/register.ts',Buffer.from('changed'));
        else fs.appendFileSync(join(root,'node_modules/@fbincon/statusline-cli/resources',NATIVE.name,'hooks/register.ts'),'changed');
        const before=snapshot(f.root);
        assert.throws(()=>prepareModDowngrade(f.context,root,'3.7.0',expected,false));
        assert.deepEqual(snapshot(f.root),before);
    }
});

test('version rollback refreshes both Mod caches through verified reinstall, including unchanged runtime protocol',t=>{
    const f=fresh(t,[2,1,289]);assert.equal(f.install({native:true,nativeTiming:true}).failed,false);
    const root=target(f);prepareModDowngrade(f.context,root,'3.7.0',configurationHashes(configurationBytes(f.root)),false);
    for(const host of [f.host,f.runtime]) {
        assert.equal(host.plugins[0]!.version,'3.7.0');
        assert.equal(host.inputs.backendVersion,'3.7.0');
        assert(host.calls.some(call=>call.args[0]==='uninstall'));
    }
});
