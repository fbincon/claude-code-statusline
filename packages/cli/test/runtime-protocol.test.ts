import test from 'node:test';
import { setup, observation as o, assert, fs, join, allFiles, pythonJson } from './runtime-support.js';
import { loadRuntime } from '../src/config/backend-preferences.js';
import { run } from '@fbincon/statusline-platform/launch';
import { fileURLToPath } from 'node:url';
function request(operation: string, payload: unknown) { return { protocol_version: 1, operation, payload }; }
const read = request('read', { session_id: 's', prompt_id: null });
test('tests.runtime.live.test_protocol.RuntimeProtocolTests.test_read_and_disabled_observe_never_create_runtime_files', t => {
    const f = setup(t);
    f.preferences(true);
    assert.equal(f.protocol.dispatch(read).reason, 'not_observed');
    assert.equal(fs.existsSync(f.context.runtimeRoot), false);
    f.preferences(false);
    const result = f.protocol.dispatch(request('observe', { observations: [o()] }));
    assert.deepEqual([result.accepted, result.ignored], [0, 1]);
    assert.equal(f.protocol.dispatch(read).reason, 'runtime_disabled');
    assert.equal(fs.existsSync(f.context.runtimeRoot), false);
});
test('tests.runtime.live.test_protocol.RuntimeProtocolTests.test_entire_invalid_batch_is_rejected_before_persistence', t => {
    const f = setup(t);
    f.preferences(true);
    for (const [field, value] of [['seq', true], ['observed_at_ms', NaN], ['observed_at_ms', -(10n ** 1000n)], ['source', 'unknown'], ['session_id', 'bad\x1bpath']] as const) {
        assert.throws(() => f.protocol.dispatch(request('observe', { observations: [o(), { ...o('heartbeat', 1), [field]: value }] })));
        assert.equal(fs.existsSync(f.context.runtimeRoot), false);
    }
});
test('tests.runtime.live.test_protocol.RuntimeProtocolTests.test_permission_snapshot_cannot_claim_a_live_change_feed', t => {
    const f = setup(t);
    assert.throws(() => f.protocol.dispatch(request('observe', { observations: [o('permission', 0, 1000, { payload: { mode: 'plan', live: true } })] })), /verified change feed/);
});
test('tests.runtime.live.test_protocol.RuntimeProtocolTests.test_json_stdout_errors_and_utf8_cli_paths', async (t) => {
    const f = setup(t), config = join(f.root, '配置 with spaces');
    fs.mkdirSync(config);
    fs.writeFileSync(join(config, 'claude-statusline-runtime.json'), '{"schema_version":1,"live_metrics":true}');
    const inputs = [pythonJson(request('observe', { observations: [{ ...o(), observed_at_ms: -(10n ** 1000n) }] })),
        '{"protocol_version":1,"protocol_version":1,"operation":"read","payload":{}}',
        '{"protocol_version":1,"operation":"observe","payload":{"observations":[NaN]}}', pythonJson(request('observe', { observations: [o()] }))];
    for (const [index, input] of inputs.entries()) {
        const result = await run({ executable: process.execPath, args: [fileURLToPath(new URL('../src/entry.js', import.meta.url))] }, ['runtime', '--config-dir', config], input, 30000, { ...process.env, CLAUDE_STATUSLINE_RUNTIME_DIR: f.context.runtimeRoot });
        assert.equal(result.code, index === 3 ? 0 : 2, result.stdout + result.stderr);
        assert.equal(result.stderr, '');
        assert.equal(JSON.parse(result.stdout).protocol_version, index === 1 || index === 2 ? 2 : 1);
    }
});
test('tests.runtime.live.test_protocol.RuntimeProtocolTests.test_corrupt_state_is_unavailable_and_read_does_not_repair', t => {
    const f = setup(t);
    f.preferences(true);
    f.apply(o());
    fs.writeFileSync(f.store.path('s'), 'broken');
    const before = allFiles(f.root);
    assert.equal(f.protocol.dispatch(read).reason, 'not_observed');
    assert.deepEqual(allFiles(f.root), before);
});
test('tests.runtime.live.test_protocol.RuntimeProtocolTests.test_preference_is_strict_and_explicit_repair_is_supported', t => {
    const f = setup(t);
    for (const raw of ['{"schema_version":true,"live_metrics":true}', '{"schema_version":1,"live_metrics":"on"}', '{"schema_version":1,"live_metrics":true,"live_metrics":false}']) {
        fs.writeFileSync(join(f.root, 'claude-statusline-runtime.json'), raw);
        assert.throws(() => loadRuntime(f.root));
        assert.equal(loadRuntime(f.root, undefined, false).live_metrics, false);
    }
});
test('runtime protocol rejects oversized requests and reports storage failures without stderr', async (t) => {
    const f = setup(t);
    const oversized = await f.protocol.handle(' '.repeat(1048577));
    assert.equal(oversized.status, 2);
    assert.match(oversized.stdout, /larger than 1 MiB/);
    const duplicate = await f.protocol.handle('\uFEFF{"protocol_version":1,"protocol_version":2}');
    assert.equal(duplicate.status, 2);
    assert.match(duplicate.stdout, /duplicate JSON field: protocol_version/);
    assert.equal((await f.protocol.handle(new Uint8Array([0xff]))).status, 2);
    f.preferences(true);
    f.protocol.store.io.write = () => { throw Object.assign(new Error('private path'), { code: 'EIO' }); };
    const result = await f.protocol.handle(pythonJson(request('observe', { observations: [o()] })));
    assert.equal(result.status, 2);
    assert.deepEqual(result.response.error, { code: 'source_unavailable', message: 'Runtime state cannot be read or published' });
});
