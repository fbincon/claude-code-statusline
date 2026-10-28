import test from 'node:test';
import { setup, observation as o, plain, assert, fs, join, allFiles, pythonJson } from './runtime-support.js';
import { fresh } from '@fbincon/statusline-core/runtime/live/state';
import { run } from '@fbincon/statusline-platform/launch';
import { fileURLToPath, pathToFileURL } from 'node:url';
test('tests.runtime.live.test_store.LiveStoreTests.test_duplicate_and_out_of_order_events_preserve_ownership', t => {
    const f = setup(t);
    f.apply(o(), o('prompt', 1, 1010, { prompt: 'p' }));
    f.apply(o('agent_end', 3, 1050, { prompt: 'p', agent: 'a' }));
    const start = o('agent_start', 2, 1020, { prompt: 'p', agent: 'a' });
    f.apply(start, start, o('agent_start', 4, 1100, { prompt: 'new', agent: 'a' }));
    const state = plain(f.store.load('s'));
    assert.deepEqual([state.agents.a.prompt_id, state.agents.a.started_at_ms, state.agents.a.ended_at_ms], ['p', 1020, 1050]);
    assert.equal(state.prompts.p.complete, false);
});
test('tests.runtime.live.test_store.LiveStoreTests.test_old_epoch_cannot_replace_reloaded_live_observations', t => {
    const f = setup(t);
    f.apply(o(), o('prompt', 1, 1010, { prompt: 'p' }));
    f.apply(o('heartbeat', 0, 2000, { epoch: 'new', payload: { host_version: '2.1.289', loaded_at_ms: 2000 } }), o('permission', 1, 2010, { epoch: 'new' }));
    f.apply(o('permission', 2, 9999, { payload: { mode: 'default', live: false } }));
    const state = plain(f.store.load('s'));
    assert.equal(state.permission.mode, 'plan');
    assert.equal(state.epoch, 'new');
    assert.equal(state.prompts.p.complete, false);
    assert.equal(f.apply(o('heartbeat', 0, 3000, { epoch: 'older' })).accepted, 0);
});
test('tests.runtime.live.test_store.LiveStoreTests.test_freshness_and_resume_invalidation', t => {
    const f = setup(t);
    f.apply(o());
    const state = f.store.load('s');
    assert.equal(fresh(state, 16000), true);
    assert.equal(fresh(state, 16001), false);
    assert.equal(fresh(state, 999), false);
    f.apply(o('invalidate', 1, 1010), o('heartbeat', 2, 1020));
    assert.equal(fresh(f.store.load('s'), 1030), false);
});
test('tests.runtime.live.test_store.LiveStoreTests.test_multiple_process_writers_do_not_lose_agents_or_other_sessions', async (t) => {
    const f = setup(t);
    f.preferences(true, false);
    f.apply(o(), o('prompt', 1, 1010, { prompt: 'p' }));
    const entry = fileURLToPath(new URL('../src/entry.js', import.meta.url));
    // Keep the real CLI/protocol path, but retain the original fixture-only
    // exception if the protocol correctly sanitizes an OS failure on a runner.
    const protocol = new URL('../src/runtime/live/protocol.js', import.meta.url).href;
    const diagnostic = `process.argv.splice(1,0,${JSON.stringify(entry)});const{RuntimeProtocol}=await import(${JSON.stringify(protocol)});const dispatch=RuntimeProtocol.prototype.dispatch;RuntimeProtocol.prototype.dispatch=function(...args){try{return dispatch.apply(this,args)}catch(error){process.stderr.write(String(error?.stack??error)+'\\n');throw error;}};await import(${JSON.stringify(pathToFileURL(entry).href)});`;
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => run({ executable: process.execPath, args: ['--input-type=module','-e',diagnostic] }, ['runtime', '--config-dir', f.root], pythonJson({ protocol_version: 2, operation: 'observe', payload: { observations: [o('agent_start', index + 2, 1020 + index, { prompt: 'p', agent: String(index) })] } }), 30000, { ...process.env, CLAUDE_STATUSLINE_RUNTIME_DIR: f.context.runtimeRoot })));
    for (const result of results) {
        assert.equal(result.code, 0, result.stdout + result.stderr);
        assert.equal(result.stderr, '');
    }
    assert.equal(Object.keys(f.store.load('s')!.agents).length, 20);
    f.apply(o('heartbeat', 0, 1000, { session: 'another' }));
    assert.equal(Object.keys(f.store.load('s')!.agents).length, 20);
    assert.equal(f.store.load('another')!.session_id, 'another');
});
test('live history pruning keeps lock inodes and bounded JSON state', t => {
    const f = setup(t);
    for (let i = 0; i < 103; i++)
        f.apply(o('heartbeat', 0, 1000, { session: String(i) }));
    const entries = fs.readdirSync(f.store.directory());
    assert.equal(entries.filter(n => n.endsWith('.json')).length, 100);
    assert.equal(entries.filter(n => n.endsWith('.lock')).length, 103);
    f.apply(o('heartbeat', 1, 1001, { session: '0' }));
    assert.equal(fs.readdirSync(f.store.directory()).filter(n => n.endsWith('.json')).length, 100);
});
