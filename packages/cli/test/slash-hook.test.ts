import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handlePayload, experimentalReason, safeErrorReason, slashHook } from '../src/integration/slash-hook.js';
import { UNAVAILABLE_MESSAGE, type EditorLauncher, type EditorResult } from '../src/integration/editor.js';
import { FEATURE_FILENAME } from '@fbincon/statusline-core/config/backend-preferences';
import { readDisplay } from '../src/rendering/main.js';
import { CONFIG_FILENAME } from '@fbincon/statusline-core/config/display';
import { writeFeature } from '../src/config/backend-preferences.js';
function setup(t: TestContext) {
    const configDir = mkdtempSync(join(tmpdir(), 'ts03-slash-'));
    t.after(() => rmSync(configDir, { recursive: true, force: true }));
    const launch = { executable: process.execPath, args: [fileURLToPath(new URL('../src/entry.js', import.meta.url))] };
    return { configDir, launch, hostVersion: () => [2, 1, 288], editor: (() => assert.fail('unexpected editor')) as EditorLauncher };
}
const payload = (command_args: unknown = '', command_name = 'statusline-config') => ({ hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', command_name, command_args });
test('tests.integration.test_slash_hook.SlashHookTests.test_empty_arguments_pass_through_to_guided_skill', async (t) => {
    assert.equal(await handlePayload(payload('   '), setup(t)), null);
});
test('tests.integration.test_slash_hook.SlashHookTests.test_unrelated_events_and_commands_are_ignored', async (t) => {
    const f = setup(t);
    for (const data of [{}, { ...payload('show'), hook_event_name: 'UserPromptSubmit' }, { ...payload('show'), expansion_type: 'mcp_prompt' }, payload('show', 'other')])
        assert.equal(await handlePayload(data, f), null);
    assert.deepEqual(readdirSync(f.configDir), []);
});
test('tests.integration.test_slash_hook.SlashHookTests.test_direct_arguments_update_locally_and_block_model_expansion', async (t) => {
    const f = setup(t);
    let result = JSON.parse((await handlePayload(payload('set-items git tokens'), f))!);
    assert.equal(result.decision, 'block');
    assert.ok(result.reason.includes('updated'));
    assert.deepEqual(readDisplay(f.configDir).instances.filter(n => n.enabled).map(n => n.id), ['git', 'tokens']);
    result = JSON.parse((await handlePayload(payload('subagents set-items status name tokens'), f))!);
    assert.equal(result.decision, 'block');
    assert.deepEqual(readDisplay(f.configDir).subagents.instances.filter(n => n.enabled).map(n => n.id), ['status', 'name', 'tokens']);
    assert.equal(JSON.parse((await handlePayload(payload('set scope-labels always'), f))!).decision, 'block');
    assert.equal(readDisplay(f.configDir).scope_labels, 'always');
});
test('tests.integration.test_slash_hook.SlashHookTests.test_show_returns_configuration_in_block_reason', async (t) => {
    const result = JSON.parse((await handlePayload(payload('show'), setup(t)))!);
    assert.equal(result.decision, 'block');
    assert.ok(result.reason.includes('Items:'));
    assert.ok(result.reason.includes('Installed: no'));
});
test('tests.integration.test_slash_hook.SlashHookTests.test_help_and_invalid_arguments_block_without_changes', async (t) => {
    const f = setup(t);
    assert.ok(JSON.parse((await handlePayload(payload('help'), f))!).reason.includes('Usage:'));
    const result = JSON.parse((await handlePayload(payload('set-items clock'), f))!);
    assert.equal(result.decision, 'block');
    assert.ok(result.reason.includes('was not changed'));
    assert.ok(!existsSync(join(f.configDir, CONFIG_FILENAME)));
});
test('tests.integration.test_slash_hook.SlashHookTests.test_non_string_arguments_are_rejected', async (t) => {
    const result = JSON.parse((await handlePayload(payload(['show']), setup(t)))!);
    assert.equal(result.decision, 'block');
    assert.ok(result.reason.includes('invalid arguments'));
});
test('tests.integration.test_slash_hook.ExperimentalSlashHookTests.test_empty_arguments_launch_and_every_outcome_blocks_model', async (t) => {
    const f = setup(t);
    writeFeature(f.configDir, true);
    const cases = { updated: 'Status line configuration updated. Backup: /backup', 'already-current': 'Status line configuration already current.', cancelled: 'Status line configuration unchanged.', interrupted: 'interrupted; no changes were saved', 'timed-out': 'timed out; no changes were saved', error: 'Interactive status line configuration failed: popup failed' };
    for (const [outcome, expected] of Object.entries(cases)) {
        let calls = 0;
        const result = JSON.parse((await handlePayload(payload('', 'statusline-configure'), { ...f, editor: request => { calls++; assert.deepEqual(request, { configDir: f.configDir, backend: f.launch, cwd: undefined }); return { outcome: outcome as EditorResult['outcome'], message: expected }; } }))!);
        assert.equal(result.decision, 'block');
        assert.ok(result.reason.includes(expected));
        assert.equal(calls, 1);
    }
});
test('tests.integration.test_slash_hook.ExperimentalSlashHookTests.test_stable_default_launches_without_a_preference_file', async (t) => {
    const f = setup(t);
    let calls = 0;
    const result = JSON.parse((await handlePayload(payload('', 'statusline-configure'), { ...f, editor: request => { calls++; assert.deepEqual(request.backend, f.launch); return { outcome: 'cancelled', message: 'unchanged' }; } }))!);
    assert.equal(result.decision, 'block');
    assert.equal(calls, 1);
    assert.ok(!existsSync(join(f.configDir, FEATURE_FILENAME)));
});
test('tests.integration.test_slash_hook.ExperimentalSlashHookTests.test_help_and_unsupported_arguments_never_launch', async (t) => {
    const f = setup(t);
    for (const arg of ['help', '-h', '--help', 'extra', ['bad']]) {
        const result = JSON.parse((await handlePayload(payload(arg, 'statusline-configure'), f))!);
        assert.equal(result.decision, 'block');
        assert.ok(result.reason.includes(typeof arg === 'string' ? 'Usage:' : 'invalid'));
    }
});
test('tests.integration.test_slash_hook.ExperimentalSlashHookTests.test_disabled_corrupt_and_suspended_preferences_do_not_launch', async (t) => {
    const f = setup(t), request = payload('', 'statusline-configure');
    writeFeature(f.configDir, false);
    assert.ok(JSON.parse((await handlePayload(request, f))!).reason.includes('disabled'));
    writeFileSync(join(f.configDir, FEATURE_FILENAME), 'broken');
    assert.ok(JSON.parse((await handlePayload(request, f))!).reason.includes('repair'));
    writeFeature(f.configDir, true);
    assert.ok(JSON.parse((await handlePayload(request, { ...f, hostVersion: () => [2, 1, 257] }))!).reason.includes('suspended'));
});
test('tests.integration.test_slash_hook.ExperimentalSlashHookTests.test_unavailable_launcher_returns_documented_fallback', async (t) => {
    const result = JSON.parse((await handlePayload(payload('', 'statusline-configure'), { ...setup(t), editor: () => ({ outcome: 'error', message: UNAVAILABLE_MESSAGE }) }))!);
    assert.equal(result.reason, UNAVAILABLE_MESSAGE);
});
test('editor boundary preserves exact launch arguments, cwd and bounded Unicode results without starting a terminal', async (t) => {
    const f = setup(t), cwd = '/中文 path', source = '👩'.repeat(2001);
    let requests = 0;
    const response = JSON.parse((await handlePayload({ ...payload('', 'statusline-configure'), cwd }, { ...f, editor: async (request) => { requests++; assert.equal(request.cwd, cwd); assert.deepEqual(request.backend.args, f.launch.args); return { outcome: 'updated', message: source }; } }))!);
    assert.equal(requests, 1);
    assert.equal([...response.reason].length, 2000);
    assert.equal(safeErrorReason('\n  first line  \nsecret\n'), 'first line');
    assert.equal([...safeErrorReason('界'.repeat(501)) as string].length, 500);
    assert.equal(experimentalReason(null), 'Interactive status line configuration failed.');
    const failed = JSON.parse((await handlePayload(payload('', 'statusline-configure'), { ...f, editor: () => { throw new Error('popup unavailable\ninternal detail'); } }))!);
    assert.equal(failed.decision, 'block');
    assert.ok(!failed.reason.includes('internal detail'));
    for (const input of ['{broken', '[]', '{"hook_event_name":1}'])
        assert.equal(await slashHook(() => input, f), '');
    assert.equal(await slashHook(() => { throw new Error('read failed'); }, f), '');
});
