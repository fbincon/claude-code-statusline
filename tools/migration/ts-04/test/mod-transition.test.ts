import test from 'node:test';
import { fresh, snapshot, assert, fs, join, NATIVE, RUNTIME, jsonBytes } from './install-support.js';
import { bundledFiles, inventory } from '@fbincon/statusline-cli/integration/resources';
import { prepareModDowngrade } from '@fbincon/statusline-cli/management/mod-transition';
import { configurationBytes, configurationHashes } from '@fbincon/statusline-cli/management/configuration';
import { PACKAGE_NAME, VERSION } from '@fbincon/statusline-core/release';
import { PACKAGE_COMPATIBILITY } from '@fbincon/statusline-core/management/compatibility';
import { AGENT_ROWS } from '@fbincon/statusline-cli/integration/model';
import { AGENT_ROW_ROUTE_FILE } from '@fbincon/statusline-cli/integration/agent-row-paths';
import { deactivateAgentRowRoute, readAgentRowRoute } from '@fbincon/statusline-cli/integration/agent-row-state';
import { commandFor } from '@fbincon/statusline-platform/commands';
import { BINDING_FILE } from '@fbincon/statusline-cli/integration/ownership';

function target(f: ReturnType<typeof fresh>, withAgentRows = false): string {
    const root=join(f.temporary,'older target');
    const version = withAgentRows ? VERSION : '3.7.0';
    for (const spec of withAgentRows ? [NATIVE, RUNTIME, AGENT_ROWS] : [NATIVE, RUNTIME]) {
        const resources=join(root,'node_modules/@fbincon/statusline-cli/resources',spec.name);
        const files=new Map(bundledFiles(spec).files);files.delete('resource-manifest.json');
        const manifest=JSON.parse(files.get('.claude-plugin/plugin.json')!.toString());manifest.version=version;files.set('.claude-plugin/plugin.json',jsonBytes(manifest));
        if (spec === AGENT_ROWS) files.set('lib/test-fixture.ts', Buffer.from('export const changed = true;\n'));
        const record=inventory(files,{...spec,protocol:withAgentRows?spec.protocol:spec===NATIVE?21:3},version);files.set('resource-manifest.json',jsonBytes(record));
        for(const [name,bytes] of files){const path=join(resources,name);fs.mkdirSync(join(path,'..'),{recursive:true});fs.writeFileSync(path,bytes);}
    }
    fs.writeFileSync(join(root,'package.json'),JSON.stringify({name:PACKAGE_NAME,version,...(withAgentRows?{statuslineCompatibility:PACKAGE_COMPATIBILITY}:{})}));return root;
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

test('retiring AgentRow verifies its cache, restores the supported legacy command and preserves explicit disablement', t => {
    for (const state of ['mod', 'manually-disabled', 'disabled-intent', 'foreign-callback']) {
        const f = fresh(t, [2, 1, 332]);
        f.put('settings.json', { env: { KEEP: 'yes' }, enabledPlugins: { unrelated: true } });
        assert.equal(f.install({ native: false, nativeTiming: false }).failed, false);
        assert.ok(readAgentRowRoute(f.root)?.installationId);
        if (state === 'manually-disabled') f.agentRows.enabled(false);
        if (state === 'disabled-intent') f.put(BINDING_FILE, { ...f.json(BINDING_FILE), refresh_disabled: [AGENT_ROWS.name] });
        const foreign = { type: 'command', command: 'unrelated-command' };
        if (state === 'foreign-callback') f.agentRows.set('subagentStatusLine', foreign);
        const root = target(f), expected = configurationHashes(configurationBytes(f.root)), before = snapshot(f.root);
        assert.deepEqual(prepareModDowngrade(f.context, root, '3.7.0', expected, true), expected);
        assert.deepEqual(snapshot(f.root), before);
        const hashes = prepareModDowngrade(f.context, root, '3.7.0', expected, false);
        const settings = f.json('settings.json');
        assert.deepEqual(settings.env, { KEEP: 'yes' });
        assert.deepEqual(settings.enabledPlugins, { unrelated: true });
        assert.deepEqual(settings.subagentStatusLine, state === 'foreign-callback' ? foreign :
            { type: 'command', command: commandFor(f.launch, 'render-subagents') });
        assert.deepEqual(f.agentRows.listing(), [[], []]);
        assert(!fs.existsSync(join(f.root, AGENT_ROWS.name)));
        assert.equal(f.json(BINDING_FILE).refresh_disabled, undefined);
        const route = readAgentRowRoute(f.root);
        if (state === 'manually-disabled' || state === 'disabled-intent') {
            assert.equal(route?.reason, 'mod-disabled');
            assert.equal(route?.installationId, null);
            assert.equal(deactivateAgentRowRoute(f.root), null);
        } else assert.equal(route, null);
        assert.deepEqual(prepareModDowngrade(f.context, root, '3.7.0', hashes, false), hashes);
    }
});

test('an edited AgentRow cache blocks retirement before the route or user configuration changes', t => {
    const f = fresh(t, [2, 1, 332]);
    assert.equal(f.install({ native: false, nativeTiming: false }).failed, false);
    const cache = String(f.agentRows.listing()[1][0]!.installPath);
    fs.appendFileSync(join(cache, 'hooks/hooks.json'), ' ');
    const expected = configurationHashes(configurationBytes(f.root)), before = snapshot(f.root);
    const root = target(f);
    assert.throws(() => prepareModDowngrade(f.context, root, '3.7.0', expected, false), /cache changed/u);
    assert.deepEqual(snapshot(f.root), before);
    assert.ok(expected[AGENT_ROW_ROUTE_FILE]);
});

test('an equal-version target refreshes an owned AgentRow when its verified resource inventory differs', t => {
    const f = fresh(t, [2, 1, 332]);
    assert.equal(f.install({ native: false, nativeTiming: false }).failed, false);
    const root = target(f, true), expected = configurationHashes(configurationBytes(f.root));
    const calls = f.agentRows.calls.length;
    prepareModDowngrade(f.context, root, VERSION, expected, false);
    assert.ok(f.agentRows.calls.slice(calls).some(call => call.args[0] === 'uninstall'));
    assert.equal(fs.readFileSync(join(String(f.agentRows.listing()[1][0]!.installPath), 'lib/test-fixture.ts'), 'utf8'),
        'export const changed = true;\n');
});
