import test from 'node:test';
import { setup, observation as o, writeLines, fs, join, plain, assert } from './runtime-support.js';
import { UsageCollector } from '../src/runtime/usage.js';
import { runtimeIO } from '../src/runtime/io.js';
import { RuntimeProtocol } from '../src/runtime/live/protocol.js';
import { main } from '../src/main.js';
import { config } from './render-support.js';
import { sessionTokenCounts } from '@fbincon/statusline-core/runtime/usage';
import { int } from '@fbincon/statusline-core/runtime/values';
import { VERSION } from '@fbincon/statusline-core/release';
import { subprocess } from './final-cli-support.js';

const assistant = (id: string, input_tokens: number, output_tokens = 0) => ({ type: 'assistant', message: { id, usage: { input_tokens, output_tokens } } });
test('R05 language options preserve real CLI version status and both streams', t => {
    const f = setup(t);
    for (const language of ['en', 'zh-CN', 'zh-TW', 'zh-HK', 'ja', 'ko']) for (const flags of [['--language', language], ['--language=' + language]])
        assert.deepEqual(subprocess(f.root, [...flags, '--version']), { status: 0, stdout: `claude-statusline ${VERSION}\n`, stderr: '' });
    assert.equal(subprocess(f.root, ['--language=invalid', '--version']).status, 2);
});
test('B01 production wait sampling survives a forward wall adjustment through reload and render', async t => {
    const f = setup(t); f.preferences(false, true); f.event('UserPromptSubmit', 1);
    const rows = [o('heartbeat', 0, 0, { payload: { host_version: '2.1.289', loaded_at_ms: 0 } }), o('prompt', 1, 1000, { prompt: 'p' }), o('turn_start', 2, 2000, { prompt: 'p', turn_id: 't' }), o('wait_start', 3, 3000, { turn_id: 't', request_id: 'q' }), o('wait_end', 4, 16000, { turn_id: 't', request_id: 'q' }), o('turn_end', 5, 30000, { turn_id: 't', payload: { status: 'completed', duration_ms: 1500, wait_coverage: true } })];
    for (const [i, row] of rows.entries()) { f.clock(BigInt(Number(row.observed_at_ms) * 1e6), [0n, 1n, 2n, 3n, 6n, 20n][i]! * 1000000000n); f.store.observe([row], { timing: true }); }
    assert.equal(int(f.tasks.store.state('s', 'p')!.duration_ns), 19000000000n);
    assert.equal(int(f.tasks.store.state('s', 'p')!.native_duration_ms), 1500n);
    assert.equal(plain(new RuntimeProtocol(f.context).activePoint('s', 'p')).value, 15);
    fs.writeFileSync(join(f.root, 'claude-statusline.json'), JSON.stringify(config(['task-active-timer'])));
    let output = '';
    assert.equal(await main(['render'], { configDir: f.root, runtime: f.context, stdin: () => '{"session_id":"s","prompt_id":"p"}', stdout: value => { output += value; } }), 0);
    assert.match(output, /Active 0m 15s/);
});
test('B02 a continuous sequence without turn_start cannot certify zero execution', t => {
    const f = setup(t); f.preferences(false, true); f.event('UserPromptSubmit', 1);
    for (const row of [o('heartbeat', 0, 0, { payload: { host_version: '2.1.289', loaded_at_ms: 0 } }), o('prompt', 1, 1000, { prompt: 'p' }), o('turn_end', 2, 9000, { turn_id: 't', payload: { status: 'completed', duration_ms: 1500, wait_coverage: true } })]) {
        f.clock(BigInt(Number(row.observed_at_ms) * 1e6)); f.store.observe([row], { timing: true });
    }
    assert.equal(int(f.tasks.store.state('s', 'p')!.duration_ns), 8000000000n);
    assert.equal(int(f.tasks.store.state('s', 'p')!.native_duration_ms), 1500n);
    const point = plain(new RuntimeProtocol(f.context).activePoint('s', 'p'));
    assert.equal(point.value, null); assert.equal(point.reason, 'incomplete');
});
test('R04 invalid prompt types do not borrow current-task metrics through render', async t => {
    const f = setup(t); f.preferences(true);
    f.clock(2000000000n);
    f.apply(o(), o('prompt', 1, 1010, { prompt: 'p' }), o('turn_start', 2, 1020, { turn_id: 't' }), o('turn_end', 3, 1030, { turn_id: 't', payload: { status: 'completed' } }), o('request_end', 4, 1030, { turn_id: 't', request_id: 'r', payload: { native: true, status: 'completed', usage: { input_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 5, output_tokens: 7 } } }), o('turn_usage', 5, 1030, { turn_id: 't', payload: { usage: { input_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 5, output_tokens: 7 } } }));
    fs.writeFileSync(join(f.root, 'claude-statusline.json'), JSON.stringify(config(['run-state', 'prompt-input-tokens', 'prompt-output-tokens'])));
    const render = async (prompt_id: unknown) => {
        let output = ''; await main(['render'], { configDir: f.root, runtime: f.context, stdin: () => JSON.stringify({ session_id: 's', prompt_id }), stdout: value => { output += value; } }); return output;
    };
    for (const id of [42, true, {}, [], ['p']]) { const text = await render(id); assert.ok(!text.includes('completed')); assert.ok(!text.includes('in 10')); assert.ok(!text.includes('out 7')); }
    for (const id of ['p', null, undefined]) assert.match(await render(id), /Prompt in 10/);
    assert.ok(!(await render('unknown')).includes('in 10'));
});
test('B03 larger same-path replacement rescans identities without losing old totals', t => {
    const f = setup(t), path = join(f.root, 'session.jsonl'), collector = new UsageCollector(f.context), data = { session_id: 's', transcript_path: path };
    const count = () => sessionTokenCounts(collector.collect(data)![4])!.input_tokens;
    writeLines(path, [assistant('A', 1)]); assert.equal(count(), 1n);
    writeLines(path + '.new', [assistant('B', 2), assistant('C', 3)]); fs.renameSync(path + '.new', path);
    assert.equal(count(), 6n); assert.equal(count(), 6n);
});
test('B04 cold replay, later field increments and restart preserve exact totals', t => {
    const f = setup(t), path = join(f.root, 'session.jsonl'), data = { session_id: 's', transcript_path: path };
    let collector = new UsageCollector(f.context);
    const count = () => sessionTokenCounts(collector.collect(data)![4])!;
    writeLines(path, Array.from({ length: 5001 }, (_, i) => assistant('m' + i, 1)));
    assert.equal(count().input_tokens, 5001n);
    writeLines(path, [assistant('m0', 1)], true); assert.equal(count().input_tokens, 5001n);
    collector = new UsageCollector(f.context);
    writeLines(path, [assistant('m0', 2, 7)], true); assert.equal(count().input_tokens, 5002n); assert.equal(count().out, 7n);
    writeLines(path, [assistant('m0', 2, 7)], true); assert.equal(count().input_tokens, 5002n); assert.equal(count().out, 7n);
    const entry = JSON.parse(fs.readFileSync(collector.path(), 'utf8')).sessions.s;
    assert.ok(Object.keys(entry.ids).length <= 5000);
});
test('usage index writes preceding a failed cache commit remain safe on retry', t => {
    const f = setup(t), path = join(f.root, 'session.jsonl'), io = runtimeIO(), collector = new UsageCollector(f.context, io), data = { session_id: 's', transcript_path: path };
    writeLines(path, [assistant('m', 1)]); collector.collect(data);
    const before = fs.readFileSync(collector.path()), write = io.write;
    writeLines(path, [assistant('n', 2)], true);
    io.write = (target, bytes) => { if (target === collector.path()) throw new Error('injected cache commit failure'); write(target, bytes); };
    assert.equal(sessionTokenCounts(collector.collect(data)![4])!.input_tokens, 3n);
    assert.deepEqual(fs.readFileSync(collector.path()), before);
    io.write = write;
    assert.equal(sessionTokenCounts(new UsageCollector(f.context, io).collect(data)![4])!.input_tokens, 3n);
});
test('legacy compressed caches remain untouched and cannot certify unknown identities', t => {
    const f = setup(t), path = join(f.root, 'session.jsonl'), legacy = join(f.root, 'statusline_state.json');
    const raw = JSON.stringify({ sessions: { s: { files: {}, ids: {}, base: { i: 10, o: 0, cc: 0, cr: 0 } } } });
    fs.writeFileSync(legacy, raw); writeLines(path, [assistant('new', 1)]);
    assert.equal(new UsageCollector(f.context).collect({ session_id: 's', transcript_path: path }), null);
    assert.equal(fs.readFileSync(legacy, 'utf8'), raw);
});
