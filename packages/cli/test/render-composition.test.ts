import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DisplayDraft, ItemOptionsDraft, Scope } from '@fbincon/statusline-core/contracts/ui';
import { defaultDisplay, defaultItem } from '@fbincon/statusline-core/config/display';
import { edit } from '@fbincon/statusline-core/config/instances';
import { configuredRows } from '@fbincon/statusline-core/rendering/items';
import { previewRows, samplePreviewData, SampleRenderState } from '@fbincon/statusline-core/rendering/preview';
import { previewRows as agentsPreview, renderTask, renderPayload } from '@fbincon/statusline-core/rendering/subagents';
import { displayWidth, strip, truncateStyled } from '@fbincon/statusline-core/rendering/layout';
import { rowSpans } from '@fbincon/statusline-core/rendering/spans';
import { config, agentConfig, env, rendered, updateDisplay, updateSubagents } from './render-support.js';
import { presentation } from '../src/rendering/environment.js';
import type { Data } from '@fbincon/statusline-core/runtime/values';
const exact = (ids: string[], updates: Partial<DisplayDraft> = {}) => { const cfg = config(ids, updates); return updateDisplay(cfg, { instances: cfg.instances.filter(node => node.enabled) }); };
const explicit = (cfg: DisplayDraft, rows = [cfg.instances.map(node => node.id)]) => updateDisplay(cfg, { layout: { mode: 'explicit', rows: rows.filter(row => row.length) } });
function options(cfg: DisplayDraft, scope: Scope, values: Record<string, Partial<ItemOptionsDraft>>) {
    const nodes = (scope === 'main' ? cfg.instances : cfg.subagents.instances).map(node => ({ ...node, options: { ...node.options, ...(values[node.id] ?? {}) } }));
    return updateDisplay(cfg, scope === 'main' ? { instances: nodes } : { subagents: { ...cfg.subagents, instances: nodes } });
}
let serial = 0;
const change = (cfg: DisplayDraft, scope: Scope, request: Parameters<typeof edit>[2]) => edit(cfg, scope, request, () => 'instance-' + ++serial);
const base = () => explicit(exact(['model', 'session-name', 'context-used']), [['model', 'session-name'], ['context-used']]);
test('tests.rendering.test_explicit_layout.ExplicitLayoutTests.test_priority_overrides_order_without_moving_rows', () => {
    const cfg = options(base(), 'main', { 'session-name': { priority: 100 } });
    assert.deepEqual(configuredRows({ model: { id: 'abcdefghijklmnopqrstuvwxyz' }, session_name: 'saved', context_window: { used_percentage: 90 } }, cfg, 14, env), ['Session saved', 'Context 90% u…']);
});
test('tests.rendering.test_explicit_layout.ExplicitLayoutTests.test_equal_priority_drops_rightmost_and_clips_final_item', () => {
    assert.deepEqual(configuredRows({ model: { id: '界'.repeat(20) }, session_name: 'saved' }, base(), 8, env), ['界界界…']);
});
test('tests.rendering.test_explicit_layout.ExplicitLayoutTests.test_width_clipping_preserves_styles_and_combining_characters', () => {
    const value = truncateStyled('\x1b[31m' + 'é'.repeat(10) + '\x1b[0m', 4);
    assert.equal(strip(value), 'ééé…');
    assert.ok(value.endsWith('\x1b[0m'));
});
test('tests.rendering.test_explicit_layout.ExplicitLayoutTests.test_scope_decoration_does_not_hide_the_only_real_item', () => {
    const cfg = updateDisplay(base(), { items: ['model'], scope_labels: 'always' });
    assert.deepEqual(configuredRows({ model: { id: 'Sonnet' } }, cfg, 6, env), ['Sonnet']);
    assert.deepEqual(configuredRows({ model: { id: 'Sonnet' } }, cfg, 40, env), ['Main/Session | Sonnet']);
});
test('tests.rendering.test_explicit_layout.ExplicitLayoutTests.test_per_item_width_is_applied_before_fitting', () => {
    const cfg = options(base(), 'main', { model: { max_width: 5 } });
    assert.deepEqual(configuredRows({ model: { id: 'long-model' }, session_name: 'x' }, cfg, 30, env), ['long… | Session x']);
});
test('tests.rendering.test_explicit_layout.ExplicitLayoutTests.test_missing_rows_do_not_create_blank_lines_and_preview_is_bounded', () => {
    assert.deepEqual(configuredRows({}, base(), 80, env), []);
    for (const width of [2, 8, 32, 80, 120]) {
        const rows = previewRows(base(), width, env, '/home/test');
        assert.ok(rows.length <= 2);
        assert.ok(rows.every(row => displayWidth(row) <= width));
    }
});
test('tests.rendering.test_explicit_layout.ExplicitLayoutTests.test_order_and_enable_disable_keep_explicit_partition_valid', () => {
    let cfg = updateDisplay(base(), { items: ['context-used', 'model', 'session-name'] });
    assert.deepEqual(cfg.layout.rows, [['context-used', 'model'], ['session-name']]);
    for (const items of [['context-used', 'model'], ['context-used', 'model', 'tokens']]) {
        cfg = updateDisplay(cfg, { items });
        assert.deepEqual(cfg.layout.rows.flat(), cfg.instances.map(node => node.id));
    }
    assert.deepEqual(updateDisplay(cfg, { items: [] }).layout.rows, cfg.layout.rows);
    assert.deepEqual(configuredRows({}, updateDisplay(cfg, { items: [] }), 80, env), []);
});
test('tests.rendering.test_explicit_layout.ExplicitLayoutTests.test_bad_partitions_are_refused', () => {
    for (const rows of [[['model', 'model']], [['session-name', 'model', 'context-used']], [[]]])
        assert.throws(() => updateDisplay(base(), { layout: { mode: 'explicit', rows } }));
});
test('tests.rendering.test_explicit_layout.ExplicitLayoutTests.test_subagent_hidden_ids_are_emitted_and_host_order_is_retained', () => {
    const tasks = [{ id: 'done', status: 'completed' }, { id: 'first', status: 'failed' }, { id: 'second', status: 'running' }, { id: 'first', status: 'running' }];
    const cfg = agentConfig(undefined, { hide_completed: true, row_limit: 1 });
    let rows = renderPayload({ tasks }, cfg, env);
    assert.deepEqual(rows.map(row => row.id), ['done', 'first', 'second']);
    assert.equal(rows[0]!.content, '');
    assert.ok(rows[1]!.content);
    assert.equal(rows[2]!.content, '');
    rows = renderPayload({ tasks }, updateDisplay(cfg, { subagents: { ...cfg.subagents, visibility: 'running', row_limit: null } }), env);
    assert.equal(rows[1]!.content, '');
    assert.ok(rows[2]!.content);
});
test('tests.rendering.test_explicit_layout.ExplicitLayoutTests.test_task_text_and_zero_row_limit', () => {
    const cfg = agentConfig(['task'], { task_max_width: 6 }), task = { id: 'one', description: '界'.repeat(30), status: 'running' };
    assert.ok(displayWidth(renderPayload({ tasks: [task], columns: 100 }, cfg, env)[0]!.content) <= 6);
    assert.deepEqual(renderPayload({ tasks: [task] }, updateDisplay(cfg, { subagents: { ...cfg.subagents, row_limit: 0 } }), env), [{ id: 'one', content: '' }]);
});
test('tests.rendering.test_components.ComponentTests.test_repeated_formats_share_one_git_snapshot', () => {
    let cfg = config(['git-branch']);
    const copied = change(cfg, 'main', { action: 'copy', id: 'git-branch' });
    cfg = options(copied.config, 'main', { [copied.selected!]: { label: 'Again' } });
    let calls = 0;
    const text = rendered({ workspace: { current_dir: '/tmp' } }, cfg, { git: () => { calls++; return { kind: 'ok', branch: 'main' }; } });
    assert.equal(calls, 1);
    assert.ok(text.includes('Again'));
    assert.equal(text.match(/main/gu)?.length, 2);
});
test('tests.rendering.test_components.ComponentTests.test_same_metric_has_independent_number_formats', () => {
    const copied = change(config(['input-tokens']), 'main', { action: 'copy', id: 'input-tokens' });
    const cfg = options(copied.config, 'main', { 'input-tokens': { formatting: { number_format: 'full' } }, [copied.selected!]: { formatting: { number_format: 'compact' } } });
    const row = previewRows(cfg, 120, env, '/home/test')[0]!;
    assert.ok(row.includes('1287500'));
    assert.ok(row.includes('1.29M'));
});
test('tests.rendering.test_components.ComponentTests.test_spacer_fits_both_scopes_styles_and_widths', () => {
    let cfg = explicit(exact(['model']));
    cfg = change(cfg, 'main', { action: 'add', type_id: 'spacer' }).config;
    cfg = change(cfg, 'main', { action: 'add', type_id: 'text', text: '右侧 👩🏽‍💻' }).config;
    for (const scope of ['main', 'subagent'] as const) {
        if (scope === 'subagent') {
            cfg = updateDisplay(cfg, { subagents: agentConfig(['status', 'name']).subagents });
            cfg = change(cfg, scope, { action: 'add', type_id: 'spacer' }).config;
            cfg = change(cfg, scope, { action: 'add', type_id: 'elapsed' }).config;
        }
        for (const width of [2, 5, 40, 80, 120])
            for (const style of ['classic', 'powerline'] as const) {
                const current = updateDisplay(cfg, { separator_style: style });
                const rows = scope === 'main' ? previewRows(current, width, env, '/home/test') : agentsPreview(current, width, env);
                for (const row of rows)
                    assert.ok(displayWidth(row) <= width);
                if (scope === 'main' && width >= 40) {
                    assert.equal(displayWidth(rows[0]!), width);
                    assert.ok(strip(rows[0]!).replace(/[ >]+$/u, '').endsWith('右侧 👩🏽‍💻'));
                }
            }
    }
});
test('tests.rendering.test_components.ComponentTests.test_text_only_and_empty_spacer_rows', () => {
    let cfg = explicit(exact([]));
    cfg = change(cfg, 'main', { action: 'add', type_id: 'spacer' }).config;
    assert.deepEqual(configuredRows({}, cfg, 80, env), []);
    const added = change(cfg, 'main', { action: 'add', type_id: 'text', text: 'literal ${name}' });
    cfg = added.config;
    assert.ok(strip(configuredRows({}, cfg, 80, env)[0]!).endsWith('literal ${name}'));
    cfg = change(cfg, 'main', { action: 'remove', id: added.selected! }).config;
    assert.deepEqual(configuredRows({}, cfg, 80, env), []);
});
test('tests.rendering.test_components.ComponentTests.test_repeated_timers_collect_one_raw_task_snapshot', () => {
    const copy = change(config(['task-timer']), 'main', { action: 'copy', id: 'task-timer' }), cfg = options(copy.config, 'main', { [copy.selected!]: { label: 'Again' } });
    let totals = 0, tasks = 0;
    const row = rendered({ session_id: 's', prompt_id: 'p' }, cfg, { usage: () => { totals++; return { hit: '0', miss: '0', out: '0', last_prompt: null, entry: {}, counts: null }; }, task: () => { tasks++; return { state: { status: 'completed', duration_ns: 1000000000n }, sample: { wall_ns: 100n, boot_ns: null, boot_id: null } }; } });
    assert.equal(totals, 1);
    assert.equal(tasks, 1);
    assert.equal(row.match(/0m 01s/gu)?.length, 2);
    assert.ok(row.includes('Again'));
});
test('tests.rendering.test_components.ComponentTests.test_repeated_branch_diff_collects_once_and_agents_stay_separate', () => {
    let cfg = change(config(['branch-diff']), 'main', { action: 'copy', id: 'branch-diff' }).config;
    let calls = 0;
    rendered({ workspace: { current_dir: '/tmp' } }, cfg, { branchDiff: () => { calls++; return { value: { files: 1, added: 3, removed: 0 }, reason: null }; } });
    assert.equal(calls, 1);
    cfg = updateDisplay(cfg, { subagents: agentConfig(['tokens']).subagents });
    const copy = change(cfg, 'subagent', { action: 'copy', id: 'tokens' });
    cfg = options(copy.config, 'subagent', { tokens: { formatting: { number_format: 'full' } }, [copy.selected!]: { formatting: { number_format: 'compact' } } });
    const rows = renderPayload({ columns: 120, tasks: [{ id: 'a', tokenCount: 1000 }, { id: 'b', tokenCount: 2000 }] }, cfg, env, 0);
    assert.deepEqual(rows.map(row => row.id), ['a', 'b']);
    assert.ok(rows[0]!.content.includes('1000'));
    assert.ok(rows[0]!.content.includes('1K'));
    assert.ok(rows[1]!.content.includes('2000'));
    assert.ok(!rows[1]!.content.includes('1000'));
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_legacy_preview_bytes_match_fixed_v111', async () => {
    const fixtures = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../tests/fixtures/legacy-appearance.json', import.meta.url)), 'utf8'));
    for (const row of fixtures.cases) {
        let cfg = updateDisplay(defaultDisplay(), { statusline_language: row.language, palette: row.palette, use_colors: row.colors });
        if (row.mode === 'explicit')
            cfg = explicit(cfg, [cfg.instances.slice(0, 3).map(n => n.id), cfg.instances.slice(3).map(n => n.id)]);
        const source = { ...env, language: await presentation(row.language) }, data = samplePreviewData('/home/test');
        data.workspace = { current_dir: '/fixture/project/src', project_dir: '/fixture/project' };
        assert.deepEqual(configuredRows(data, cfg, row.width, source, (...args) => new SampleRenderState(...args)), row.main);
        assert.deepEqual(agentsPreview(cfg, row.width, source), row.subagents);
    }
});
const clean = { kind: 'ok', branch: 'main', upstream: 'origin/main', upstream_gone: false, staged: 0, unstaged: 0, conflicts: 0, untracked: 0, ahead: 0, behind: 0 };
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_git_hides_only_confirmed_clean_relevant_state', () => {
    for (const item of ['git', 'git-changes']) {
        const cfg = options(config([item]), 'main', { [item]: { visibility: 'git-dirty' } });
        for (const [patch, hidden] of [[{}, true], [{ staged: 1 }, false], [{ unstaged: 1 }, false], [{ conflicts: 1 }, false], [{ untracked: 1 }, false], [{ ahead: 1 }, item !== 'git'], [{ behind: 1 }, item !== 'git'], [{ upstream_gone: true }, item !== 'git'], [{ kind: 'error' }, false]] as const)
            assert.equal(rendered({ cwd: '/fixture' }, cfg, { git: () => ({ ...clean, ...patch }) }) === '', hidden);
    }
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_live_zero_and_empty_require_complete_observations', () => {
    for (const [item, zero, positive] of [['active-agents', 0, 2], ['task-progress', { completed: 0, total: 0 }, { completed: 5, total: 5 }]] as const) {
        const cfg = options(config([item]), 'main', { [item]: { visibility: 'nonzero' } });
        for (const [point, hidden] of [[{ value: zero, partial: false, reason: null }, true], [{ value: positive, partial: false, reason: null }, false], [{ value: zero, partial: true, reason: 'incomplete' }, false], [{ value: null, partial: false, reason: 'stale' }, false], [{ value: null, partial: false, reason: 'runtime_disabled' }, false]] as const)
            assert.equal(rendered({}, cfg, { live: () => ({ [item]: point }) }) === '', hidden);
    }
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_visibility_uses_raw_used_percentage_in_both_languages', async () => {
    for (const language of ['en', 'zh-CN'] as const)
        for (const item of ['context-used', 'context-remaining']) {
            const cfg = options(config([item], { statusline_language: language }), 'main', { [item]: { visibility: 'used-at-least' } });
            for (const used of [0, 69.99, 70, 100, 101])
                assert.equal(Boolean(rendered({ context_window: { used_percentage: used, remaining_percentage: Math.max(0, 100 - used) } }, cfg, { language: await presentation(language) })), used >= 70 && !(item === 'context-used' && used > 100));
        }
    for (const allowance of ['remaining', 'used'] as const) {
        let cfg = options(config(['five-hour-limit']), 'main', { 'five-hour-limit': { visibility: 'used-at-least' } });
        cfg = updateDisplay(cfg, { formatting: { ...cfg.formatting, allowance } });
        for (const [used, resets, visible] of [[69.99, 200, false], [70, 200, true], [90, 99, false]] as const)
            assert.equal(Boolean(rendered({ rate_limits: { five_hour: { used_percentage: used, resets_at: resets } } }, cfg, { now: () => 100 })), visible);
    }
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_background_survives_inner_resets_and_colors_off_has_no_sgr', () => {
    const cfg = options(config(['model-with-effort'], { use_colors: true }), 'main', { 'model-with-effort': { label: '引擎', foreground: '#102030', background: '#abcdef' } }), data = { model: { id: 'test' }, effort: { level: 'high' } };
    const row = configuredRows(data, cfg, 120, env).join('\n');
    for (const span of rowSpans(row)) {
        assert.deepEqual(span.foreground, { kind: 'rgb', value: '#102030' });
        assert.deepEqual(span.background, { kind: 'rgb', value: '#abcdef' });
    }
    assert.equal(configuredRows(data, updateDisplay(cfg, { use_colors: false }), 120, env).join('\n'), strip(row));
    for (const span of rowSpans(configuredRows(data, updateDisplay(cfg, { palette: 'ansi' }), 120, env).join('\n')))
        for (const color of [span.foreground, span.background]) {
            assert.equal(color?.kind, 'ansi');
            assert.ok(typeof color!.value === 'number' && color.value >= 0 && color.value < 16);
        }
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_risk_wins_foreground_and_preserves_background', () => {
    let cfg = options(config(['context-used'], { use_colors: true }), 'main', { 'context-used': { foreground: '#123456', background: '#102030' } });
    cfg = updateDisplay(cfg, { formatting: { ...cfg.formatting, thresholds: { enabled: true, warning: 70, critical: 90 } } });
    for (const [used_percentage, fg] of [[69, '#123456'], [70, '#f2b550'], [90, '#f28686']]) {
        const spans = rowSpans(configuredRows({ context_window: { used_percentage } }, cfg, 120, env)[0]!);
        assert.ok(spans.length);
        for (const span of spans) {
            assert.equal(span.foreground!.value, fg);
            assert.equal(span.background!.value, '#102030');
        }
    }
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_terminal_default_differs_from_inherit', () => {
    const cfg = options(config(['model'], { use_colors: true, theme: 'dark', separator_style: 'powerline' }), 'main', { model: { foreground: 'default', background: 'default' } });
    assert.ok(rowSpans(configuredRows({ model: { id: 'X' } }, cfg, 120, env)[0]!).every(s => s.foreground === null && s.background === null));
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_hidden_middle_has_no_separator_or_background', () => {
    const cfg = options(config(['model', 'context-used', 'effort'], { use_colors: true, separator_style: 'powerline', powerline_glyph: 'powerline' }), 'main', { 'context-used': { visibility: 'used-at-least', background: '#aa0000' } }), row = configuredRows({ model: { id: 'X' }, effort: { level: 'high' }, context_window: { used_percentage: 5 } }, cfg, 120, env)[0]!;
    assert.ok(!strip(row).includes('5%'));
    assert.ok(rowSpans(row).every(s => s.background?.value !== '#aa0000'));
    assert.equal(strip(row).match(/[>\ue0b0]/gu)?.length, 2);
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_powerline_widths_styles_graphemes_and_empty_rows', () => {
    for (const mode of ['auto', 'explicit'])
        for (const theme of ['classic', 'dark', 'light', 'terminal'] as const)
            for (const powerline_glyph of ['ascii', 'powerline'] as const) {
                let cfg = options(exact(['model', 'context-used'], { use_colors: true, theme, separator_style: 'powerline', powerline_glyph }), 'main', { model: { label: '中文👩🏽‍💻' } });
                if (mode === 'explicit')
                    cfg = explicit(cfg);
                for (const width of [2, 3, 4, 8, 15, 40, 120])
                    for (const row of configuredRows({ model: { id: 'á' }, context_window: { used_percentage: 80 } }, cfg, width, env)) {
                        assert.ok(displayWidth(row) <= width);
                        assert.ok(row.endsWith('\x1b[0m'));
                        if (row.includes('👩'))
                            assert.ok(strip(row).includes('👩🏽‍💻'));
                    }
            }
    const cfg = options(config(['context-used'], { separator_style: 'powerline', scope_labels: 'always' }), 'main', { 'context-used': { visibility: 'used-at-least' } });
    assert.equal(rendered({ context_window: { used_percentage: 0 } }, cfg), '');
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_subagent_color_only_keeps_existing_fitting_and_threshold_uses_ratio', () => {
    const task = { id: 'a', name: 'Explore', model: 'claude-sonnet-5', status: 'running', startTime: 0, tokenCount: 13999, contextWindowSize: 20000, description: 'checking a long description' }, base = defaultDisplay(), colored = options(base, 'subagent', { name: { background: '#223344' } });
    for (const width of [1, 2, 8, 15, 30, 80])
        assert.equal(strip(renderTask(task, base, env, width, 1000)), strip(renderTask(task, colored, env, width, 1000)));
    const cfg = options(agentConfig(['context-used'], {}, { separator_style: 'powerline' }), 'subagent', { 'context-used': { visibility: 'used-at-least' } });
    assert.equal(renderTask(task, cfg, env), '');
    assert.ok(renderTask({ ...task, tokenCount: 14000 }, cfg, env));
    for (const width of [1, 2, 3, 4, 15])
        assert.ok(displayWidth(renderTask({ ...task, tokenCount: 14000 }, cfg, env, width)) <= width);
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_hidden_subagent_content_preserves_ids_order_and_row_quota', () => {
    const cfg = options(agentConfig(['context-used'], { row_limit: 1 }, { separator_style: 'powerline' }), 'subagent', { 'context-used': { visibility: 'used-at-least' } });
    const rows = renderPayload({ columns: 30, tasks: [['low', 699], ['high', 700], ['limited', 900]].map(([id, tokenCount]) => ({ id, tokenCount, status: 'running', contextWindowSize: 1000 })) }, cfg, env);
    assert.deepEqual(rows.map(r => r.id), ['low', 'high', 'limited']);
    assert.equal(rows[0]!.content, '');
    assert.ok(rows[1]!.content);
    assert.equal(rows[2]!.content, '');
});
test('tests.rendering.test_appearance.AppearanceRenderingTests.test_conditions_reuse_one_lazy_collection_per_source', () => {
    const cfg = options(config(['git', 'git-changes', 'active-agents', 'task-progress']), 'main', { git: { visibility: 'git-dirty' }, 'git-changes': { visibility: 'git-dirty' }, 'active-agents': { visibility: 'nonzero' }, 'task-progress': { visibility: 'nonzero' } });
    let git = 0, live = 0;
    assert.ok(rendered({ workspace: { current_dir: '/fixture/project' }, session_id: 'example' }, cfg, { git: () => { git++; return { ...clean, staged: 1 }; }, live: () => { live++; return { 'active-agents': { value: 2, partial: false, reason: null }, 'task-progress': { value: { completed: 1, total: 2 }, partial: false, reason: null } }; } }));
    assert.equal(git, 1);
    assert.equal(live, 1);
});
