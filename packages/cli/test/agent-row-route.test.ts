import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { revision } from '@fbincon/statusline-platform/hash';
import { PROFILES_FILENAME } from '@fbincon/statusline-core/config/profiles';
import { setup, jsonBytes } from './final-support.js';
import { commit } from '../src/integration/transaction.js';
import { BINDING_FILE } from '../src/integration/ownership.js';
import { AGENT_ROWS, OWNER, VERSION, type InstallContext } from '../src/integration/model.js';
import { inventory } from '../src/integration/resources.js';
import { stage } from '../src/integration/mods.js';
import { observeTransactions, pending } from '../src/recovery/journal.js';
import { AGENT_ROW_EVIDENCE_FILE, AGENT_ROW_ROUTE_FILE, agentRowAccess, agentRowLoaded, beginAgentRowBatch,
    confirmAgentRowBatch, agentRowReady, deactivateAgentRowRoute, inspectAgentRowRoute, planAgentRowInstall,
    readAgentRowRoute, type AgentRowIdentity } from '../src/integration/agent-row-route.js';

function fixture(t: TestContext, withCommand = true) {
    const f = setup(t, true), dir = f.root;
    const context: InstallContext = { configDir: dir, version: [2, 1, 332], launch: f.launch, io: f.io,
        host() { throw new Error('The session must not run administrative plugin commands'); } };
    const settings = () => JSON.parse(readFileSync(f.settingsPath, 'utf8'));
    const before = settings();
    if (!withCommand) delete before.subagentStatusLine;
    const files = new Map([['.claude-plugin/plugin.json', jsonBytes({name: AGENT_ROWS.name, version: VERSION})],
        ['hooks/hooks.json', jsonBytes({modules: ['./row.ts']})], ['hooks/row.ts', Buffer.from('export function register(on) {}')]]);
    const manifest = inventory(files, AGENT_ROWS);
    const choice = planAgentRowInstall(context, before, true, {resourceRevision: revision(manifest)});
    assert(choice.change?.desired && choice.installationId);
    f.io.write(choice.change.path, choice.change.desired);
    files.set('resource-manifest.json', jsonBytes(manifest));
    stage(context, AGENT_ROWS, null, { files, inventory: manifest });
    f.io.write(join(dir, BINDING_FILE), jsonBytes({ schema_version: 1, owner: OWNER, launch: f.launch, backend_version: VERSION }));
    const options = { backendExecutable: f.launch.executable, backendArgs: JSON.stringify(f.launch.args), configDir: dir,
        backendVersion: VERSION, installationId: choice.installationId };
    f.io.write(f.settingsPath, jsonBytes({ ...before, enabledPlugins: { [AGENT_ROWS.plugin]: true },
        pluginConfigs: { [AGENT_ROWS.plugin]: { options } } }));
    const identity: AgentRowIdentity = { backend_version: VERSION, installation_id: choice.installationId,
        session_id: 'private-test-session', host_version: '2.1.332', cwd: dir };
    function prove(source: AgentRowIdentity = identity) {
        agentRowLoaded(dir, source);
        const result = beginAgentRowBatch(dir, source);
        assert(result.revision);
        const token = confirmAgentRowBatch(dir, source, result.revision);
        assert(token);
        return token;
    }
    return {...f, dir, context, before, settings, identity, prove};
}

test('agent row install plans stay read-only, stable and preserve explicit unavailable and foreign choices', t => {
    const f = fixture(t), read = () => readFileSync(join(f.dir, AGENT_ROW_ROUTE_FILE));
    const original = read(), state = readAgentRowRoute(f.dir)!;
    for (const [patch,mode,legacy] of [[204, 'preserve', 'keep'], [205, 'legacy', 'write'], [322, 'legacy', 'write'],
        [323, 'builtin', 'remove'], [324, 'builtin', 'remove'], [325, 'builtin', 'remove'],
        [326, 'standby', 'keep'], [332, 'standby', 'keep'], [333, 'standby', 'keep']] as const) {
        const result = planAgentRowInstall({...f.context, version:[2,1,patch]}, f.settings(), true);
        assert.equal(result.mode, mode); assert.equal(result.legacy, legacy);
    }
    const again = planAgentRowInstall(f.context, f.settings(), true);
    assert.equal(again.change, null); assert.equal(again.installationId, state.installationId);
    const legacy = planAgentRowInstall(f.context, f.settings(), true, {preference:'legacy'});
    assert.equal(legacy.mode, 'legacy'); assert.equal(legacy.installationId, null);
    const unknown = planAgentRowInstall({...f.context, version:null}, f.settings(), true, {preference:'mod'});
    assert.equal(unknown.unsupported, true); assert.equal(unknown.change, null);
    const future = planAgentRowInstall({...f.context,version:[2,1,333]}, f.settings(), true, {preference:'legacy'});
    assert.equal(future.unsupported, true);
    const blocked = planAgentRowInstall(f.context, f.settings(), true, {preference:'mod',modUnavailable:'failed'});
    assert.equal(blocked.unsupported, true); assert.equal(blocked.legacy, 'keep'); assert.equal(blocked.change, null);
    for (const force of [false,true]) {
        const foreign = {subagentStatusLine:{type:'command',command:'some-other-program'}};
        assert.equal(planAgentRowInstall(f.context, foreign, true, {force}).legacy, 'keep');
        assert.equal(planAgentRowInstall(f.context, foreign, true, {force,preference:'mod'}).unsupported, true);
    }
    assert.deepEqual(read(), original);
    assert.equal(existsSync(join(f.dir, AGENT_ROW_EVIDENCE_FILE)), false);
});

test('a loaded session and its actual first eligible batch publish one recoverable, idempotent handoff', t => {
    const f = fixture(t), directory = f.dir;
    assert.equal(beginAgentRowBatch(directory, f.identity).mode, 'pass');
    assert.equal(agentRowReady(directory, f.identity, randomUUID()), 'pass');
    assert.equal(agentRowLoaded(directory, f.identity), 'standby');
    assert.equal(agentRowReady(directory, f.identity, randomUUID()), 'standby');
    const token = f.prove();
    assert.equal(agentRowReady(directory, {...f.identity,session_id:'other-session'}, token), 'pass');
    assert.equal(agentRowReady(directory, {...f.identity,host_version:'2.1.330'}, token), 'pass');
    const updated = f.settings(); updated.permissions.allow.push('example');
    f.io.write(f.settingsPath,jsonBytes(updated));
    assert.equal(agentRowReady(directory, f.identity, token), 'mod');
    const expected = { ...updated }; delete expected.subagentStatusLine;
    assert.deepEqual(f.settings(), expected);
    const state = readAgentRowRoute(directory)!, file = join(directory, AGENT_ROW_EVIDENCE_FILE);
    assert.equal(state.mode,'mod'); assert.equal(state.installationId,f.identity.installation_id);
    assert.equal(state.legacyRevision,null);
    assert.equal(inspectAgentRowRoute(f.context, f.settings(), true).mode, 'mod');
    assert(inspectAgentRowRoute(f.context, f.settings(), true).verifiedAt);
    const evidence = readFileSync(file,'utf8');
    assert(!evidence.includes(f.identity.session_id)); assert(!evidence.includes(directory));
    assert(!evidence.includes(token)); assert(!evidence.includes('subagentStatusLine'));
    if(process.platform!=='win32') assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.equal(agentRowReady(directory, f.identity, token), 'mod');
    assert.equal(readFileSync(file,'utf8'), evidence);
    assert.deepEqual(beginAgentRowBatch(directory, f.identity), {mode:'mod'});
    const nextHost = {...f.identity,host_version:'2.1.333'};
    assert.equal(agentRowLoaded(directory,nextHost), 'mod');
    assert.equal(agentRowAccess(directory,{...f.identity,host_version:'2.1.325'}), 'pass');
    assert.equal(planAgentRowInstall(f.context, f.settings(), true).change, null);
});

test('handoff rechecks the reviewed display, project collection, legacy value, binding and current policy', t => {
    const f=fixture(t), original=f.settings();
    assert.equal(agentRowLoaded(f.dir,f.identity),'standby');
    const inFlight=beginAgentRowBatch(f.dir,f.identity);
    assert(inFlight.revision);
    f.io.write(join(f.dir,PROFILES_FILENAME),jsonBytes({example:'changed during the batch'}));
    assert.equal(confirmAgentRowBatch(f.dir,f.identity,inFlight.revision),undefined);
    const token=f.prove();
    f.io.write(f.displayPath,jsonBytes({example:'changed after the batch'}));
    assert.equal(agentRowReady(f.dir,f.identity,token),'standby');
    const retry=f.prove();
    assert.notEqual(retry,token);
    for(const settings of [{...original,subagentStatusLine:{...original.subagentStatusLine, label:'changed'}},
        {...original,subagentStatusLine:{type:'command',command:'foreign'}},
        {...original,disableAllHooks:true},
        {...original,enabledPlugins:{[AGENT_ROWS.plugin]:false}},
        {...original,enabledPlugins:{[AGENT_ROWS.plugin]:[VERSION]}},
        {...original,pluginConfigs:{[AGENT_ROWS.plugin]:{options:{...original.pluginConfigs[AGENT_ROWS.plugin].options,
            installationId:randomUUID()}}}}]) {
        f.io.write(f.settingsPath,jsonBytes(settings));
        assert.equal(agentRowReady(f.dir,f.identity,retry),'pass');
        assert.deepEqual(f.settings(),settings);
    }
    f.io.write(f.settingsPath,jsonBytes(original));
    const change=deactivateAgentRowRoute(f.dir)!;
    f.io.lock(f.dir,()=>commit(f.dir,'agent-row-test-deactivate',[change],f.io));
    assert.equal(agentRowReady(f.dir,f.identity,retry),'pass');
    assert.deepEqual(f.settings(),original);
});

test('handoff rolls back an interrupted settings write before retrying the same reviewed generation', t => {
    const f=fixture(t), token=f.prove(), settingsBefore=readFileSync(f.settingsPath), routeBefore=readFileSync(join(f.dir,AGENT_ROW_ROUTE_FILE));
    const restore=observeTransactions((step,journal)=>{
        if(journal.action==='agent-row-handoff' && step==='applied:0') throw new Error('interrupted handoff');
    });
    try { assert.throws(()=>agentRowReady(f.dir,f.identity,token),/interrupted handoff/); }
    finally { restore(); }
    assert.deepEqual(readFileSync(f.settingsPath), settingsBefore);
    assert.deepEqual(readFileSync(join(f.dir,AGENT_ROW_ROUTE_FILE)), routeBefore);
    assert.deepEqual(pending(f.dir),[]);
    assert.equal(agentRowReady(f.dir,f.identity,token),'mod');
});

test('clean Mod installs record real per-session evidence without touching settings and retain manual disable on downgrade', t=>{
    const f=fixture(t,false), settingsBefore=readFileSync(f.settingsPath), token=f.prove();
    assert.equal(readAgentRowRoute(f.dir)?.mode,'mod');
    assert.equal(agentRowReady(f.dir,f.identity,token),'mod');
    assert.deepEqual(readFileSync(f.settingsPath),settingsBefore);
    const disabled=deactivateAgentRowRoute(f.dir,true)!;
    f.io.lock(f.dir,()=>commit(f.dir,'agent-row-disable',[disabled],f.io));
    assert.equal(deactivateAgentRowRoute(f.dir),null);
    const settings={...f.settings()};delete settings.enabledPlugins;
    const retained=planAgentRowInstall(f.context,settings,true);
    assert.equal(retained.reason,'mod-disabled');assert.equal(retained.mode,'legacy');
    const explicit=planAgentRowInstall(f.context,settings,true,{preference:'mod'});
    assert.equal(explicit.mode,'mod');assert.notEqual(explicit.installationId,f.identity.installation_id);
});

test('a non-private session receipt never authorizes removal or blocks read-only editing', { skip: process.platform==='win32' }, t=>{
    const f=fixture(t), old=f.settings(), token=f.prove(), path=join(f.dir,AGENT_ROW_EVIDENCE_FILE);
    chmodSync(path,0o644);
    assert.throws(()=>agentRowReady(f.dir,f.identity,token),/private/);
    assert.equal(inspectAgentRowRoute(f.context,old,true,{evidence:false}).mode,'standby');
    assert.deepEqual(f.settings(),old);
});
