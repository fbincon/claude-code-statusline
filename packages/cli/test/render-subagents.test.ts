import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTask, renderPayload, previewRows } from '@fbincon/statusline-core/rendering/subagents';
import { displayWidth } from '@fbincon/statusline-core/rendering/layout';
import { BY_SCOPE } from '@fbincon/statusline-core/config/catalog';
import { config, agentConfig, task, env, NOW, cli } from './render-support.js';
const statuses = { pending: '…', running: '⏱', completed: '✓', failed: '✗', killed: '■', paused: '⏳', waiting: '⏳', 'new-state': '?' };
test('tests.rendering.test_subagent_statusline.RendererTests.test_default_exact_output_and_task_order', () => {
    assert.deepEqual(renderPayload({ columns: 100, tasks: [task(), task({ id: 'task-2', name: 'Review' })] }, config(), env, NOW), [
        { id: 'task-1', content: '⏱ 1m 18s · Explore · sonnet-5/high · Context 58% left · searching auth flow' },
        { id: 'task-2', content: '⏱ 1m 18s · Review · sonnet-5/high · Context 58% left · searching auth flow' },
    ]);
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_all_statuses_and_unknown', () => {
    for (const [status, marker] of Object.entries(statuses))
        assert.equal(renderTask(task({ status }), agentConfig(['status']), env, 80, NOW), marker);
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_status_elapsed_combined_and_icon_only_fallback', () => {
    for (const [startTime, expected] of [[1788400000000, '⏱ 1m 18s'], [null, '⏱'], ['yesterday', '⏱'], [NOW + 1000, '⏱ 0m 00s']])
        assert.equal(renderTask(task({ startTime }), agentConfig(['status-elapsed']), env, 80, NOW), expected);
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_status_elapsed_icons_for_each_status', () => {
    for (const [status, marker] of Object.entries(statuses))
        assert.equal(renderTask(task({ status }), agentConfig(['status-elapsed']), env, 80, NOW), marker + (['pending', 'running', 'waiting', 'paused'].includes(status) ? ' 1m 18s' : ''));
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_status_elapsed_colors_match_status_and_elapsed', () => {
    for (const [palette, color] of [['default', '\x1b[1;38;2;142;211;211m'], ['ansi', '\x1b[1;36m']] as const)
        assert.equal(renderTask(task(), agentConfig(['status-elapsed'], {}, { use_colors: true, palette }), env, 80, NOW), color + '⏱ 1m 18s\x1b[0m');
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_model_effort_context_elapsed_tokens_and_directory', () => {
    const cfg = agentConfig(['model-with-effort', 'context-used', 'elapsed', 'tokens', 'current-dir'], {}, { directory_style: 'basename' });
    assert.equal(renderTask(task({ effort: 7, startTime: NOW + 1000 }), cfg, env, 100, NOW), 'sonnet-5/7 · Context 42% used · 0m 00s · 84K tokens · project');
    assert.ok(renderTask(task({ effort: null }), cfg, env, 100, NOW).startsWith('sonnet-5 ·'));
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_context_remaining_rounding_and_format', () => {
    for (const [tokenCount, left] of [[84000, 58], [18500, 91], [83000, 58], [0, 100], [200000, 0]])
        assert.equal(renderTask(task({ tokenCount }), agentConfig(['context-remaining']), env), `Context ${left}% left`);
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_context_remaining_clamps_at_zero_over_window', () => {
    assert.equal(renderTask(task({ tokenCount: 400000 }), agentConfig(['context-remaining']), env), 'Context 0% left');
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_context_remaining_missing_fields_omitted', () => {
    for (const field of ['contextWindowSize', 'tokenCount'])
        assert.equal(renderTask(task({ [field]: null }), agentConfig(['context-remaining']), env), '');
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_context_remaining_invalid_values_omitted', () => {
    for (const [tokenCount, contextWindowSize] of [[-1, 200000], ['84', 200000], [true, 200000], [NaN, 200000], [Infinity, 200000], [10n ** 1000n, 200000], [84000, 0], [84000, '200000'], [84000, false], [null, 200000], [84000, null]])
        assert.equal(renderTask(task({ tokenCount, contextWindowSize }), agentConfig(['context-remaining']), env), '');
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_context_used_renders_full_label', () => {
    assert.equal(renderTask(task(), agentConfig(['context-used']), env), 'Context 42% used');
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_context_remaining_default_and_preview', () => {
    assert.ok(renderTask(task(), config(), env).includes('Context 58% left'));
    const rows = previewRows(config(), 100, env);
    assert.ok(rows[0]!.includes('Context 58% left'));
    assert.ok(rows[1]!.includes('Context 91% left'));
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_invalid_optional_fields_are_omitted', () => {
    const cfg = agentConfig([...BY_SCOPE.subagent.keys()].filter(id => !['status', 'elapsed', 'text', 'spacer'].includes(id)));
    assert.equal(renderTask(task({ model: { broken: true }, effort: NaN, tokenCount: -1, contextWindowSize: 0, startTime: 'yesterday', cwd: ['not', 'a', 'path'] }), cfg, env, 100), '⏱ · Explore · searching auth flow');
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_name_type_and_task_fallbacks', () => {
    const cfg = agentConfig(['name', 'task']);
    assert.equal(renderTask(task({ name: null, label: null, description: 'Local Agent' }), cfg, env), 'Local Agent');
    assert.equal(renderTask(task({ name: null, type: null, label: null, description: null }), cfg, env), 'Agent');
    for (const [name, description] of [['Straße', 'STRASSE'], ['Σς', 'σσ'], ['Ꭰ', 'ꭰ'], ['İ', 'i̇']])
        assert.equal(renderTask(task({ name, label: null, description }), cfg, env), name);
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_duplicate_and_invalid_ids_are_skipped', () => {
    assert.deepEqual(renderPayload({ columns: 'bad', tasks: [task({ id: 'a' }), task({ id: 'a', name: 'duplicate' }), task({ id: '' }), task({ id: 7 }), { id: 'b', status: 'completed' }, 'broken'] }, config(), env, NOW).map(row => row.id), ['a', 'b']);
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_empty_items_or_disabled_rows_emit_empty_content_per_id', () => {
    for (const cfg of [agentConfig([]), agentConfig(undefined, { enabled: false })])
        assert.deepEqual(renderPayload({ tasks: [task()] }, cfg, env, NOW), [{ id: 'task-1', content: '' }]);
});
test('tests.rendering.test_subagent_statusline.RendererTests.test_preview_is_deterministic_running_and_completed_data', () => {
    const rows = previewRows(config(), 100, env);
    assert.equal(rows.length, 2);
    assert.ok(rows[0]!.startsWith('⏱ 1m 18s'));
    assert.ok(rows[1]!.startsWith('✓ 0m 42s'));
    assert.deepEqual(previewRows(config(), 100, env), rows);
});
test('tests.rendering.test_subagent_statusline.WidthAndSanitizationTests.test_every_path_is_single_line_and_within_columns', () => {
    const value = task({ name: '探索器👩🏽‍💻é'.repeat(5), label: '第一行\n第二行\t\x1b[31m注入'.repeat(8), cwd: '/项目/' + '很长目录/'.repeat(10) });
    const cfg = agentConfig([...BY_SCOPE.subagent.keys()].filter(id => !['status', 'elapsed', 'text', 'spacer'].includes(id)), {}, { use_colors: true });
    for (const columns of [100, 50, 30, 20, 10, 5, 2, 1]) {
        const content = renderPayload({ columns, tasks: [value] }, cfg, env, NOW)[0]!.content;
        assert.ok(displayWidth(content) <= columns);
        assert.doesNotMatch(content, /[\n\r\t]|\x1b\[31m/u);
        if (content.includes('\x1b['))
            assert.ok(content.endsWith('\x1b[0m'));
    }
});
test('tests.rendering.test_subagent_statusline.WidthAndSanitizationTests.test_optional_drop_priority_and_core_fallback', () => {
    const cfg = agentConfig(['status', 'name', 'current-dir', 'tokens', 'context-used', 'model-with-effort', 'elapsed', 'task']), value = task({ label: 'x'.repeat(200) });
    const content = renderTask(value, cfg, env, 30, NOW);
    assert.ok(content.includes('⏱ Explore'));
    assert.ok(content.includes('1m 18s'));
    assert.ok(!content.includes('/project'));
    assert.equal(renderTask(value, cfg, env, 1, NOW), '⏱');
});
test('tests.rendering.test_subagent_statusline.WidthAndSanitizationTests.test_status_elapsed_core_item_survives_narrow_widths', () => {
    const cfg = agentConfig(['status-elapsed', 'name', 'current-dir', 'tokens', 'context-used', 'model-with-effort', 'task']), value = task({ label: 'x'.repeat(200) });
    const content = renderTask(value, cfg, env, 12, NOW);
    assert.ok(content.includes('⏱ 1m 18s'));
    assert.ok(displayWidth(content) <= 12);
    assert.equal(renderTask(value, cfg, env, 1, NOW), '⏱');
});
test('tests.rendering.test_subagent_statusline.SubprocessTests.test_ndjson_utf8_corrupt_config_fallback_and_invalid_input', t => {
    const result = cli(t, 'render-subagents', JSON.stringify({ columns: 80, tasks: [task({ id: '中文-id' })] }), '{broken');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout.trim().split('\n').length, 1);
    assert.equal(JSON.parse(result.stdout).id, '中文-id');
    for (const value of ['{broken', '[]', '{"tasks":{}}']) {
        const result = cli(t, 'render-subagents', value);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, '');
    }
});
