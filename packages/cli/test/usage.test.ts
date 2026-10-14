import test, { type TestContext } from 'node:test';
import { setup, writeLines, assert, fs, join, plain, pythonJson } from './runtime-support.js';
import { UsageCollector } from '../src/runtime/usage.js';
import { runtimeIO } from '../src/runtime/io.js';
import { sessionTokenCounts, BASE, collapseIds, type UsageEntry } from '@fbincon/statusline-core/runtime/usage';
import { dictionary, type Data } from '@fbincon/statusline-core/runtime/values';
import { readJson } from '@fbincon/statusline-core/json-read';
import { rendered, config } from './render-support.js';
function assistant(id: string, i = 0, cc = 0, cr = 0, out = 0): Data { return { type: 'assistant', message: { id, usage: { input_tokens: i, cache_creation_input_tokens: cc, cache_read_input_tokens: cr, output_tokens: out } } }; }
function partial(id: string, usage: Data): Data { return { type: 'assistant', message: { id, usage } }; }
function snapshot(usage: Data): Data { return { type: 'cost-state', modelUsage: { model: usage } }; }
function fixture(t: TestContext) {
    const f = setup(t), path = join(f.root, 'session.jsonl'), io = runtimeIO();
    let reads = 0;
    const base = io.lines;
    io.lines = (...args) => { reads++; return base(...args); };
    const collector = new UsageCollector(f.context, io), data: Data = { session_id: 'fixture', transcript_path: path };
    return { ...f, path, io, collector, data, write: (rows: unknown[], append = false, target = path) => writeLines(target, rows, append),
        counts: () => sessionTokenCounts(collector.collect(data)![4]), reads: () => reads,
        render: (...ids: string[]) => rendered(data, config(ids.length ? ids : ['input-tokens', 'output-tokens']), { usage: value => {
            const row = collector.collect(value); return row ? { hit: row[0], miss: row[1], out: row[2], last_prompt: row[3], entry: row[4], counts: sessionTokenCounts(row[4]) } : null;
        } }) };
}
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_input_is_summed_before_formatting_and_one_collection_is_shared', t => {
    const f = fixture(t); f.write([assistant('m', 1059, 0, 1059, 19)]);
    let calls = 0; const collect = f.collector.collect.bind(f.collector); f.collector.collect = data => { calls++; return collect(data); };
    assert.equal(f.render('tokens', 'input-tokens', 'output-tokens'), 'hit 1.1K · miss 1.1K · out 19 · in 2.1K · out 19'); assert.equal(calls, 1);
    assert.deepEqual(f.counts(), { hit: 1059n, miss: 1059n, input_tokens: 2118n, out: 19n });
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_agents_duplicates_resumes_and_incremental_output_keep_same_scope', t => {
    const f = fixture(t);
    f.write([assistant('main', 1200, 300, 5000, 250)]);
    f.write([assistant('agent', 100, 200, 300, 0), assistant('agent', 100, 200, 300, 40)], false, join(f.root, 'session', 'subagents', 'nested', 'agent-a.jsonl'));
    assert.deepEqual([f.counts()!.input_tokens, f.counts()!.out], [7100n, 290n]);
    f.write([assistant('main', 1200, 300, 5000, 250)], true);
    assert.deepEqual([f.counts()!.input_tokens, f.counts()!.out], [7100n, 290n]);
    const resumed = join(f.root, 'resumed.jsonl');
    f.write([assistant('main', 1200, 300, 5000, 250)], false, resumed);
    f.data.transcript_path = resumed;
    assert.deepEqual([f.counts()!.input_tokens, f.counts()!.out], [7100n, 290n]);
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_authoritative_cost_snapshot_and_post_snapshot_delta_use_raw_integers', t => {
    const f = fixture(t);
    f.write([assistant('before', 5, 0, 0, 1), snapshot({ inputTokens: 10000, cacheCreationInputTokens: 20000, cacheReadInputTokens: 30000, outputTokens: 1000 }), assistant('after', 1, 2, 3, 4)]);
    for (let i = 0; i < 2; i++)
        assert.deepEqual([f.counts()!.input_tokens, f.counts()!.out], [60006n, 1004n]);
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_missing_empty_and_invalid_transcripts_are_unavailable_but_zero_is_observed', t => {
    const f = fixture(t);
    assert.equal(f.render(), '');
    assert.equal(f.counts(), null);
    f.write([]);
    assert.equal(f.render(), '');
    assert.equal(f.counts(), null);
    f.write([partial('invalid', { input_tokens: true, output_tokens: '8' }), snapshot({})]);
    assert.equal(f.render(), '');
    assert.equal(f.counts(), null);
    f.write([assistant('zero')], true);
    assert.equal(f.render(), 'in 0 · out 0');
    assert.deepEqual(f.counts(), { hit: 0n, miss: 0n, out: 0n, input_tokens: 0n });
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_raw_snapshot_has_no_io_and_invalid_empty_state_has_no_counts', () => {
    for (const entry of [null, {}, { ids: {}, base: { i: 0 } }, { ids: { bad: {} } }])
        assert.equal(sessionTokenCounts(entry), null);
    assert.deepEqual(sessionTokenCounts({ ids: { m: { i: 3, o: 4, cc: 5, cr: 6 } } }), { hit: 6n, miss: 8n, out: 4n, input_tokens: 14n });
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_collected_raw_snapshot_reuses_aggregation_without_changing_persistence', t => {
    const f = fixture(t);
    f.write([assistant('m', 3, 5, 6, 4)]);
    const result = f.collector.collect(f.data)!, entry = result[4];
    Object.defineProperty(entry, 'base', { get() { throw new Error('Repeat aggregation'); } });
    assert.equal(sessionTokenCounts(entry)!.input_tokens, 14n);
    assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(f.collector.path(), 'utf8')).sessions.fixture, '_raw_token_counts'), false);
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_partial_usage_does_not_fabricate_the_missing_counter_as_zero', t => {
    const f = fixture(t);
    f.write([partial('output-only', { output_tokens: 9 })]);
    for (let i = 0; i < 2; i++) {
        assert.deepEqual(f.counts(), { hit: null, miss: null, input_tokens: null, out: 9n });
        assert.equal(f.render(), 'out 9');
    }
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_input_only_zero_does_not_imply_output_was_observed', t => {
    const f = fixture(t);
    f.write([partial('input-only', { input_tokens: 0 })]);
    for (let i = 0; i < 2; i++) {
        assert.deepEqual(f.counts(), { hit: 0n, miss: 0n, input_tokens: 0n, out: null });
        assert.equal(f.render(), 'in 0');
    }
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_partial_cost_snapshot_keeps_counter_availability_separate', t => {
    const f = fixture(t);
    f.write([snapshot({ outputTokens: 0 })]);
    for (let i = 0; i < 2; i++) {
        assert.deepEqual(f.counts(), { hit: null, miss: null, input_tokens: null, out: 0n });
        assert.equal(f.render(), 'out 0');
    }
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_invalid_input_does_not_become_an_observed_zero', t => {
    const f = fixture(t);
    for (const [index, invalid] of [null, true, -1, '8', NaN, Infinity, [], readJson('1.0')].entries()) {
        f.data.session_id = String(index);
        f.write([partial('partial', { input_tokens: invalid, output_tokens: 0 })]);
        assert.deepEqual(f.counts(), { hit: null, miss: null, input_tokens: null, out: 0n });
        assert.equal(f.render(), 'out 0');
    }
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_later_zero_observation_fills_only_the_missing_counter', t => {
    const f = fixture(t);
    f.write([partial('partial', { output_tokens: 9 })]);
    assert.equal(f.render(), 'out 9');
    assert.equal(f.counts()!.input_tokens, null);
    f.write([partial('partial', { cache_read_input_tokens: 0 })], true);
    assert.equal(f.render(), 'in 0 · out 9');
    assert.deepEqual(f.counts(), { hit: 0n, miss: 0n, input_tokens: 0n, out: 9n });
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_legacy_zero_observations_are_recovered_once_without_changing_totals', t => {
    const f = fixture(t);
    f.write([partial('main', { input_tokens: 0 })]);
    f.write([partial('agent', { output_tokens: 0 })], false, join(f.root, 'session', 'subagents', 'agent-a.jsonl'));
    f.counts();
    const state = JSON.parse(fs.readFileSync(f.collector.path(), 'utf8'));
    delete state.sessions.fixture.token_observed;
    state.sessions.fixture.usage_scan_version = 2;
    fs.writeFileSync(f.collector.path(), pythonJson(state));
    assert.equal(f.render(), 'in 0 · out 0');
    assert.deepEqual(f.counts(), { hit: 0n, miss: 0n, input_tokens: 0n, out: 0n });
    const reads = f.reads();
    assert.equal(f.render(), 'in 0 · out 0');
    assert.deepEqual(f.counts(), { hit: 0n, miss: 0n, input_tokens: 0n, out: 0n });
    assert.equal(f.reads(), reads);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.collector.path(), 'utf8')).sessions.fixture.ids, state.sessions.fixture.ids);
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_observed_zero_survives_collapsing_ids_and_missing_transcripts', t => {
    const f = fixture(t);
    f.write(Array.from({ length: 5001 }, (_, i) => partial(String(i), { output_tokens: 0 })));
    assert.equal(f.render(), 'out 0');
    assert.equal(f.counts()!.out, 0n);
    const state = JSON.parse(fs.readFileSync(f.collector.path(), 'utf8'));
    assert.equal(Object.keys(state.sessions.fixture.ids).length, 2501);
    fs.unlinkSync(f.path);
    assert.equal(f.render(), 'out 0');
    assert.deepEqual(f.counts(), { hit: null, miss: null, input_tokens: null, out: 0n });
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_partial_cost_snapshot_preserves_the_other_visible_counter', t => {
    const f = fixture(t);
    f.write([partial('input', { input_tokens: 5 }), snapshot({ outputTokens: 9 })]);
    for (let i = 0; i < 2; i++) {
        assert.deepEqual([f.counts()!.input_tokens, f.counts()!.out], [5n, 9n]);
        assert.equal(f.render(), 'in 5 · out 9');
    }
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_partial_cost_snapshot_preserves_the_other_authoritative_counter', t => {
    const f = fixture(t);
    f.write([snapshot({ outputTokens: 9 })]);
    assert.equal(f.render(), 'out 9');
    assert.equal(f.counts()!.out, 9n);
    f.write([snapshot({ inputTokens: 5 })], true);
    for (let i = 0; i < 2; i++) {
        assert.deepEqual([f.counts()!.input_tokens, f.counts()!.out], [5n, 9n]);
        assert.equal(f.render(), 'in 5 · out 9');
    }
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_partial_snapshots_in_one_batch_keep_each_counters_live_delta', t => {
    const f = fixture(t);
    f.write([snapshot({ inputTokens: 10, outputTokens: 20 }), assistant('between', 2, 0, 0, 3), snapshot({ inputTokens: 12 }), assistant('after', 1, 0, 0, 4)]);
    for (let i = 0; i < 2; i++)
        assert.deepEqual([f.counts()!.input_tokens, f.counts()!.out], [13n, 27n]);
});
test('tests.runtime.test_token_counts.RawTokenCountsTests.test_partial_snapshots_attribute_subagent_deltas_per_counter', t => {
    const f = fixture(t);
    f.write([{ ...snapshot({ outputTokens: 20 }), timestamp: '2026-10-04T10:00:01Z' }, { ...snapshot({ inputTokens: 10 }), timestamp: '2026-10-04T10:00:03Z' }]);
    f.write([{ ...assistant('between', 2, 0, 0, 3), timestamp: '2026-10-04T10:00:02Z' }, { ...assistant('after', 1, 0, 0, 4), timestamp: '2026-10-04T10:00:04Z' }], false, join(f.root, 'session', 'subagents', 'agent-a.jsonl'));
    for (let i = 0; i < 2; i++)
        assert.deepEqual([f.counts()!.input_tokens, f.counts()!.out], [11n, 27n]);
});
test('usage byte cursors preserve Chinese partial lines and unchanged reads perform no parsing', t => {
    const f = fixture(t), raw = Buffer.from(pythonJson(partial('中文', { input_tokens: 9007199254740993n, output_tokens: 7 })) + '\n');
    const at = raw.indexOf(Buffer.from('中')) + 1;
    fs.writeFileSync(f.path, raw.subarray(0, at));
    assert.equal(f.counts(), null);
    fs.appendFileSync(f.path, raw.subarray(at, -1));
    assert.equal(f.counts(), null);
    fs.appendFileSync(f.path, '\n');
    assert.equal(f.counts()!.input_tokens, 9007199254740993n);
    const reads = f.reads(), bytes = fs.readFileSync(f.collector.path());
    f.counts();
    assert.equal(f.reads(), reads);
    assert.deepEqual(fs.readFileSync(f.collector.path()), bytes);
    f.write([partial('中文', { input_tokens: 1 })]);
    assert.equal(f.counts()!.input_tokens, 9007199254740993n);
});
