import test, { type TestContext } from 'node:test';
import { setup, observation, assert } from './runtime-support.js';
import type { Data } from '@fbincon/statusline-core/runtime/values';
const USAGE = { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 };
function requests(t: TestContext) {
    const f = setup(t);
    let sequence = 0;
    const send = (kind: string, at = 2000, values: Data = {}) => { const row = observation(kind, sequence++, at, values); f.apply(row); return row; };
    send('heartbeat', 1000);
    send('prompt', 1010, { prompt: 'p' });
    send('turn_start', 1020, { turn_id: 't' });
    return { ...f, send,
        request({ request = 'r', turn = 't', agent = null, start = 1100, first = 1300 as number | null, end = 2100, usage = USAGE as Data | null, native = true } = {}) {
            const identity = { turn_id: turn, request_id: request, agent };
            send('request_start', start, identity);
            if (first !== null)
                send('request_first', first, identity);
            return send('request_end', end, { ...identity, payload: { native, usage, status: 'completed' } });
        },
        finish(turn = 't', agent: string | null = null, usage: Data = USAGE) {
            send('turn_end', 2200, { turn_id: turn, agent, payload: { status: 'completed' } });
            send('turn_usage', 2200, { turn_id: turn, agent, payload: { usage } });
        },
    };
}
test('tests.runtime.live.test_requests.RequestTests.test_cache_inclusive_tokens_duplicate_ends_and_turn_usage_do_not_double_count', t => {
    const f = requests(t), end = f.request();
    f.finish();
    f.apply(end);
    const p = f.points('p', 2300);
    assert.equal(p.ttft.value, .2);
    assert.equal(p['output-rate'].value, 20);
    assert.equal(p['prompt-input-tokens'].value, 80);
    assert.equal(p['prompt-output-tokens'].value, 20);
    assert.equal(p['prompt-input-tokens'].partial, false);
    assert.equal(p['prompt-cost'].value, null);
    assert.equal(f.points('p', 50000)['prompt-input-tokens'].value, 80);
});
test('tests.runtime.live.test_requests.RequestTests.test_latest_main_request_replaces_timing_but_agents_add_to_task_usage', t => {
    const f = requests(t);
    f.request();
    f.send('agent_start', 1250, { agent: 'a', turn_id: 't' });
    f.send('turn_start', 1260, { agent: 'a', turn_id: 'child' });
    f.request({ request: 'child-r', turn: 'child', agent: 'a' as any, start: 1300, first: 1400, end: 2000 });
    f.finish('child', 'a');
    f.send('agent_end', 2200, { agent: 'a' });
    f.request({ request: 'r2', start: 2100, first: 2100, end: 2200 });
    f.finish('t', null, Object.fromEntries(Object.entries(USAGE).map(([k, v]) => [k, v * 2])));
    const p = f.points('p', 2300);
    assert.equal(p.ttft.value, 0);
    assert.equal(p['output-rate'].value, 200);
    assert.equal(p['prompt-input-tokens'].value, 240);
    assert.equal(p['prompt-output-tokens'].value, 60);
    assert.equal(p['prompt-output-tokens'].partial, false);
});
test('tests.runtime.live.test_requests.RequestTests.test_missing_usage_synthetic_stream_and_zero_are_distinct', t => {
    const f = requests(t), zero = Object.fromEntries(Object.keys(USAGE).map(k => [k, 0]));
    f.request({ usage: zero });
    f.finish('t', null, zero);
    assert.equal(f.points()['prompt-input-tokens'].value, 0);
    assert.equal(f.points()['output-rate'].value, 0);
    f.request({ request: 'fake', start: 2300, first: null, end: 2400, usage: null, native: false });
    const p = f.points('p', 2500);
    assert.equal(p.ttft.value, null);
    assert.equal(p['output-rate'].value, null);
    assert.equal(p.ttft.reason, 'synthetic_response');
    assert.equal(p['prompt-input-tokens'].partial, true);
});
test('tests.runtime.live.test_requests.RequestTests.test_queued_prompt_and_unowned_auxiliary_do_not_receive_current_usage_or_cost', t => {
    const f = requests(t);
    f.request();
    f.send('prompt', 2000, { prompt: 'queued' });
    f.request({ request: 'aux', turn: 'aux', agent: 'unknown-workflow' as any });
    f.send('request_cost', 2000, { prompt: 'queued', request_id: 'server-wrong', source: 'otel', payload: { cost_usd: 3, usage: USAGE } });
    assert.equal(f.points()['prompt-input-tokens'].value, 80);
    assert.equal(f.points('queued')['prompt-input-tokens'].value, null);
    assert.equal(f.points('queued')['prompt-cost'].value, null);
});
test('tests.runtime.live.test_requests.RequestTests.test_unbound_child_requests_reconcile_only_after_verified_spawn', t => {
    const f = requests(t);
    f.send('turn_start', 2000, { agent: 'a', turn_id: 'child' });
    f.request({ request: 'child-r', turn: 'child', agent: 'a' as any });
    assert.equal(f.points()['prompt-output-tokens'].value, null);
    f.send('agent_start', 2100, { agent: 'a', turn_id: 't' });
    assert.equal(f.points()['prompt-output-tokens'].value, 20);
    assert.equal(f.points()['prompt-output-tokens'].partial, true);
});
test('tests.runtime.live.test_requests.RequestTests.test_delayed_official_costs_deduplicate_and_unjoined_estimates_are_partial', t => {
    const f = requests(t);
    f.request();
    f.finish();
    const first = f.send('request_cost', 2000, { prompt: 'p', request_id: 'server-r', source: 'otel', payload: { cost_usd: 0, usage: USAGE } });
    f.apply(first);
    assert.equal(f.points()['prompt-cost'].value, 0);
    assert.equal(f.points()['prompt-cost'].partial, true);
    f.send('request_cost', 2000, { prompt: 'p', request_id: 'server-r2', source: 'otel', payload: { cost_usd: .0123, usage: USAGE } });
    assert.equal(f.points()['prompt-cost'].value, .0123);
    f.send('request_cost', 2000, { prompt: 'p', request_id: 'server-r2', source: 'otel', payload: { cost_usd: 5, usage: USAGE } });
    assert.equal(f.points()['prompt-cost'].value, 0);
});
test('tests.runtime.live.test_requests.RequestTests.test_clock_reversal_and_turn_reconciliation_mismatch_degrade', t => {
    const f = requests(t);
    f.request({ first: 1000 });
    f.finish('t', null, { ...USAGE, output_tokens: 999 });
    const p = f.points();
    assert.equal(p.ttft.value, null);
    assert.equal(p['output-rate'].value, null);
    assert.equal(p.ttft.reason, 'abnormal_clock');
    assert.equal(p['prompt-output-tokens'].value, 20);
    assert.equal(p['prompt-output-tokens'].partial, true);
});
test('tests.runtime.live.test_requests.RequestTests.test_request_end_before_start_and_conflicting_duplicate_are_safe', t => {
    const f = requests(t);
    f.send('request_end', 2100, { request_id: 'r', turn_id: 't', payload: { native: true, usage: USAGE, status: 'completed' } });
    f.send('request_first', 1300, { request_id: 'r', turn_id: 't' });
    f.send('request_start', 1100, { request_id: 'r', turn_id: 't' });
    f.finish();
    assert.equal(f.points()['output-rate'].value, 20);
    f.send('request_end', 2110, { request_id: 'r', turn_id: 't', payload: { native: true, usage: { ...USAGE, output_tokens: 999 }, status: 'completed' } });
    assert.equal(f.points()['prompt-output-tokens'].value, null);
});
test('tests.runtime.live.test_requests.RequestTests.test_official_prompt_uuid_links_late_cost_without_guessing_message_identity', t => {
    const f = requests(t);
    f.request();
    f.finish();
    f.send('request_cost', 2000, { prompt: 'otel-p', request_id: 'server-r', source: 'otel', payload: { cost_usd: .0123, usage: USAGE } });
    assert.equal(f.points()['prompt-cost'].value, null);
    f.send('prompt_link', 2000, { prompt: 'otel-p', source: 'otel', payload: { message_id: 'p' } });
    assert.equal(f.points()['prompt-cost'].value, .0123);
    assert.equal(f.points()['prompt-cost'].partial, true);
});
