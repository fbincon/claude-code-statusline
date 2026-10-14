import test from 'node:test';
import { assert, fs, plain, setup, observation as o, allFiles, pythonJson } from './runtime-support.js';
import { empty } from '@fbincon/statusline-core/runtime/live/state';
import { applyObservation } from '@fbincon/statusline-core/runtime/live/reducer';
import { reconcileBindings } from '@fbincon/statusline-core/runtime/live/bindings';
import { resolveMetrics } from '@fbincon/statusline-core/runtime/live/snapshot';
import { newRecord } from '@fbincon/statusline-core/runtime/tasks/model';
import { AgentDurations } from '../src/runtime/live/durations.js';
test('tests.runtime.live.test_bindings.LifecycleBindingTests.test_report_message_links_survive_alias_flattening_and_keep_the_human_task', t => {
    const f = setup(t), state = empty('s');
    for (const [key, stamp] of [['human-message', 1000], ['report-message', 2000]] as const)
        state.prompts[key] = { epoch: 'e', started_at_ms: stamp, updated_at_ms: stamp, complete: true, terminal: false, source: 'otel' };
    Object.assign(state.prompt_aliases, { 'human-hook': 'human-message', 'report-hook': 'human-message' });
    Object.assign(state.prompt_links, { 'human-hook': 'human-message', 'report-hook': 'report-message' });
    const record = newRecord('human-hook', { wall_ns: 1000000000n, boot_ns: null, boot_id: null });
    record.prompt_aliases = ['human-message', 'report-hook'];
    record.report_aliases = ['report-hook'];
    f.tasks.store.write('s', { session_id: 's', lifecycle: { schema: 4, turns: [record], current_prompt_id: 'human-hook' } });
    reconcileBindings(state, f.store.history('s'));
    assert.equal(state.prompt_aliases['report-message'], 'human-message');
    assert.equal(Object.hasOwn(state.prompts, 'report-message'), false);
    assert.equal(state.prompt_links['report-hook'], 'report-message');
});
test('tests.runtime.live.test_bindings.LifecycleBindingTests.test_completed_unique_window_binds_requests_and_nested_spawns_without_timer_writes', t => {
    const f = setup(t), state = empty('s');
    const rows = [o(), o('turn_start', 1, 1200, { turn_id: 't' }), o('agent_start', 2, 1300, { agent: 'a', turn_id: 't' }), o('turn_start', 3, 1400, { agent: 'a', turn_id: 'child' }),
        o('agent_start', 4, 1450, { agent: 'nested', parent_agent_id: 'a', turn_id: 'child' }), o('request_start', 5, 1500, { agent: 'nested', turn_id: 'deep', request_id: 'r' }), o('tool_end', 6, 1600, { turn_id: 't', request_id: 'tool', payload: { name: 'Read', status: 'success' } })];
    rows.forEach(row => applyObservation(state, row));
    const record = newRecord('p', { wall_ns: 1100000000n, boot_ns: 1100000000n, boot_id: 'boot' });
    Object.assign(record, { status: 'completed', ended_wall_ns: 2000000000n, updated_wall_ns: 2000000000n });
    f.tasks.store.write('s', { session_id: 's', schema: 1, lifecycle: { schema: 3, session_id: 's', current_prompt_id: 'p', turns: [record] } });
    const before = allFiles(f.root);
    reconcileBindings(state, f.store.history('s'));
    assert.equal(state.active_prompt_id, 'p');
    assert.equal(state.agents.nested!.prompt_id, 'p');
    assert.equal(state.requests['e:r']!.prompt_id, 'p');
    assert.equal(state.tools['e:tool']!.prompt_id, 'p');
    assert.deepEqual(allFiles(f.root), before);
    assert.equal(resolveMetrics(state, f.store.history('s'), 'missing', 1600)['prompt-input-tokens']!.value, null);
    state.turns['e:main:t']!.prompt_id = null;
    f.tasks.store.write('s', { session_id: 's', lifecycle: { schema: 3, turns: [record, { ...record, prompt_id: 'other' }] } });
    reconcileBindings(state, f.store.history('s'));
    assert.equal(state.turns['e:main:t']!.prompt_id, null);
});
test('tests.runtime.live.test_durations.FrozenAgentTests.test_unowned_start_or_missing_start_cannot_create_end_evidence', t => {
    const f = setup(t), durations = new AgentDurations(f.context), event = { session_id: 's', agent_id: 'a', hook_event_name: 'SubagentStart' };
    durations.observe(event, 1000);
    durations.observe({ ...event, hook_event_name: 'SubagentStop' }, 2000);
    assert.deepEqual(plain(durations.load('s')), {});
});
test('classic agent duration evidence freezes on first valid end and survives disabled live metrics', t => {
    const f = setup(t), durations = new AgentDurations(f.context);
    f.event('UserPromptSubmit', 1);
    f.event('SubagentStart', 2, { agent_id: 'a' });
    const start = { session_id: 's', agent_id: 'a', hook_event_name: 'SubagentStart' };
    durations.observe(start, 1000);
    durations.observe(start, 1500);
    durations.observe({ ...start, hook_event_name: 'SubagentStop' }, 43000);
    const before = allFiles(f.root);
    durations.observe({ ...start, hook_event_name: 'SubagentStop' }, 99000);
    assert.deepEqual(plain(durations.load('s')).a, { prompt_id: 'p', started_at_ms: 1000, ended_at_ms: 43000 });
    assert.deepEqual(allFiles(f.root), before);
    assert.equal(plain(durations.endedAt('s')).a, 43000);
    assert.equal(fs.existsSync(f.store.directory()), false);
});
test('runtime byte readers accept BOM encodings without rewriting; legacy text readers retain their boundary', t => {
    const f = setup(t), raw = pythonJson(empty('s')), path = f.store.path('s');
    fs.mkdirSync(f.store.directory(), { recursive: true });
    const utf32 = (little: boolean, bom: boolean) => { const words = [...raw].map(c => c.codePointAt(0)!); if (bom)
        words.unshift(0xfeff); const bytes = Buffer.alloc(words.length * 4); words.forEach((v, i) => little ? bytes.writeUInt32LE(v, i * 4) : bytes.writeUInt32BE(v, i * 4)); return bytes; };
    const le = Buffer.from(raw, 'utf16le'), be = Buffer.from(le).swap16();
    for (const bytes of [Buffer.from('\uFEFF' + raw), le, be, Buffer.concat([Buffer.from([255, 254]), le]), Buffer.concat([Buffer.from([254, 255]), be]), utf32(true, true), utf32(false, true), utf32(true, false), utf32(false, false)]) {
        fs.writeFileSync(path, bytes);
        assert.equal(f.store.load('s')!.session_id, 's');
        assert.deepEqual(fs.readFileSync(path), bytes);
    }
    f.tasks.store.write('s', { schema: 1, session_id: 's' });
    fs.writeFileSync(f.tasks.store.path('s'), '\uFEFF{"schema":1,"session_id":"s"}');
    assert.equal(f.tasks.store.raw('s'), null);
    assert.ok(f.store.history('s'));
});
