import test from 'node:test';
import assert from 'node:assert/strict';
import { config, env, rendered, cli } from './render-support.js';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { BY_SCOPE, defaultItems } from '@fbincon/statusline-core/config/catalog';
import { RenderState, configuredRows } from '@fbincon/statusline-core/rendering/items';
import { strip } from '@fbincon/statusline-core/rendering/layout';
import { DEFAULT } from '@fbincon/statusline-core/rendering/palette';
import type { Data } from '@fbincon/statusline-core/runtime/values';
const NEW = ['project-name', 'hostname', 'context-used', 'version', 'session', 'cost', 'prompt-cache', 'fast-mode', 'agent', 'vim-mode', 'thinking', 'pr', 'worktree', 'repo'];
const items = (data: unknown, ...ids: string[]) => rendered(data, config(ids));
const git = () => ({ kind: 'ok', branch: 'main', upstream_gone: false, ahead: 0, behind: 0, staged: 0, unstaged: 0, conflicts: 0, untracked: 0 });
const usage = () => ({ hit: '10', miss: '20', out: '5', last_prompt: 1, entry: {}, counts: null });
const base = () => ({ model: { id: 'test-model' }, effort: { level: 'high' }, session_id: 'session-1', prompt_id: 'prompt-1', workspace: { current_dir: '/code/repo', project_dir: '/code/repo' }, context_window: { remaining_percentage: 75, context_window_size: 1000 }, rate_limits: { five_hour: { used_percentage: 20 }, seven_day: { used_percentage: 40 }, spend_limit: { used_percentage: 60 } } });
test('tests.rendering.test_statusline_configurable.ConfiguredRenderingTests.test_renderer_registry_covers_every_configurable_item', () => {
    for (const id of BY_SCOPE.main.keys()) {
        if (['text', 'spacer'].includes(id))
            continue;
        assert.doesNotThrow(() => rendered({}, config([id]), { hostname: () => null, branchDiff: () => ({ value: null }) }));
    }
});
test('tests.rendering.test_statusline_configurable.ConfiguredRenderingTests.test_default_order_and_adjacent_groups_preserve_legacy_layout', () => {
    class Timer extends RenderState {
        override promptTimer() { return { text: 'timer' }; }
    }
    const rows = configuredRows(base(), defaultDisplay(), 500, { ...env, git, usage }, (...args) => new Timer(...args));
    assert.equal(rows.map(strip).join('\n'), 'test-model high | /code/repo | Git main | Context 75% left · 1K window | 5h 80% left · weekly 60% left · spend 40% left | hit 10 · miss 20 · out 5 | timer');
});
test('tests.rendering.test_statusline_configurable.ConfiguredRenderingTests.test_items_can_be_selected_and_reordered', () => {
    assert.equal(items(base(), 'weekly-limit', 'model-with-effort', 'context-window-size'), 'weekly 60% left | test-model high | 1K window');
});
test('tests.rendering.test_statusline_configurable.ConfiguredRenderingTests.test_compact_no_color_has_no_ansi_and_uses_dots', () => {
    const rows = configuredRows(base(), config(['model-with-effort', 'context-remaining', 'context-window-size'], { separator_style: 'compact' }), 200, env).join('\n');
    assert.equal(rows, 'test-model high · Context 75% left · 1K window');
    assert.ok(!rows.includes('\x1b'));
});
test('tests.rendering.test_statusline_configurable.ConfiguredRenderingTests.test_ansi_palette_uses_standard_codes', () => {
    const value = configuredRows(base(), config(['model-with-effort'], { use_colors: true, palette: 'ansi' }), 200, env)[0]!;
    assert.ok(value.startsWith('\x1b[1;33m'));
    assert.ok(!value.includes('38;2'));
});
test('tests.rendering.test_statusline_configurable.ConfiguredRenderingTests.test_unselected_expensive_sources_are_not_loaded', () => {
    assert.equal(rendered(base(), config(['model-with-effort']), { git: () => assert.fail('Git was collected'), usage: () => assert.fail('Usage was collected') }), 'test-model high');
});
test('tests.rendering.test_statusline_configurable.ConfiguredRenderingTests.test_timer_loads_totals_even_when_tokens_are_hidden', () => {
    let totals = 0, tasks = 0;
    const value = rendered(base(), config(['task-timer']), { usage: () => { totals++; return usage(); }, task: (_data, observed) => { tasks++; assert.equal(observed.last_prompt, 1); return { state: { status: 'completed', duration_ns: 1000000000n }, sample: { wall_ns: 100n, boot_ns: null, boot_id: null } }; } });
    assert.equal(value, '✓ 0m 01s');
    assert.equal(totals, 1);
    assert.equal(tasks, 1);
});
test('tests.rendering.test_statusline_configurable.ConfiguredRenderingTests.test_project_relative_directory', () => {
    const data = base();
    data.workspace.current_dir = '/code/repo/src/pkg';
    assert.equal(rendered(data, config(['current-dir'], { directory_style: 'project-relative' })), 'src/pkg');
});
test('tests.rendering.test_statusline_configurable.ConfiguredSubprocessTests.test_empty_items_emit_no_blank_line', t => {
    const result = cli(t, 'render', '{"model":{"id":"model"}}', config([]));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
});
test('tests.rendering.test_statusline_configurable.ConfiguredSubprocessTests.test_invalid_config_silently_falls_back_to_defaults', t => {
    const result = cli(t, 'render', '{"model":{"id":"model"}}', '{broken');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(strip(result.stdout).trim(), 'model');
    assert.equal(result.stderr, '');
});
test('tests.rendering.test_statusline_new_items.NewItemCatalogTests.test_default_items_are_exactly_the_legacy_ten', () => {
    assert.deepEqual(defaultItems('main'), ['model-with-effort', 'current-dir', 'git', 'context-remaining', 'context-window-size', 'five-hour-limit', 'weekly-limit', 'spend-limit', 'tokens', 'task-timer']);
    assert.ok(defaultItems('main').length < BY_SCOPE.main.size);
});
test('tests.rendering.test_statusline_new_items.NewItemCatalogTests.test_catalog_order_keeps_same_group_items_adjacent', () => {
    assert.deepEqual([...BY_SCOPE.main.keys()].filter(id => !['text', 'spacer'].includes(id)), ['model-with-effort', 'model', 'effort', 'fast-mode', 'thinking', 'current-dir', 'project-name', 'hostname', 'git', 'git-branch', 'git-changes', 'git-ahead-behind', 'branch-diff', 'pr', 'repo', 'worktree', 'context-remaining', 'context-used', 'context-window-size', 'context-tokens', 'five-hour-limit', 'five-hour-reset', 'weekly-limit', 'weekly-reset', 'spend-limit', 'spend-amount', 'spend-period', 'tokens', 'input-tokens', 'output-tokens', 'prompt-cache', 'cache-state', 'cache-expires', 'cache-misses', 'cache-miss-reason', 'api-requests', 'task-timer', 'task-active-timer', 'version', 'session', 'session-name', 'session-id', 'session-id-short', 'output-style', 'cost', 'session-cost', 'session-duration', 'api-duration', 'lines-changed', 'agent', 'vim-mode', 'run-state', 'permission-mode', 'active-agents', 'task-progress', 'last-tool', 'ttft', 'output-rate', 'prompt-input-tokens', 'prompt-output-tokens', 'prompt-cost']);
});
test('tests.rendering.test_statusline_new_items.NewItemCatalogTests.test_subagent_catalog_and_defaults', () => {
    assert.deepEqual([...BY_SCOPE.subagent.keys()].filter(id => !['text', 'spacer'].includes(id)), ['status-elapsed', 'status', 'name', 'model-with-effort', 'model', 'effort', 'context-remaining', 'context-used', 'context-tokens', 'context-window-size', 'elapsed', 'task', 'tokens', 'current-dir']);
    assert.deepEqual(defaultItems('subagent'), ['status-elapsed', 'name', 'model-with-effort', 'context-remaining', 'task']);
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_all_new_items_hidden_without_payload_fields', () => {
    assert.equal(rendered({}, config(NEW), { hostname: () => '' }), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_context_used_rounding', () => {
    for (const [used_percentage, expected] of [[27, 27], [27.4, 27], [27.6, 28], [0, 0], [100, 100]])
        assert.equal(items({ context_window: { used_percentage } }, 'context-used'), `Context ${expected}% used`);
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_context_used_rejects_invalid_values', () => {
    for (const used_percentage of [null, true, false, '27', NaN, Infinity, -Infinity, -0.1, 100.1, 10n ** 1000n])
        assert.equal(items({ context_window: { used_percentage } }, 'context-used'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_context_items_coexist_in_configured_order', () => {
    assert.equal(items({ context_window: { remaining_percentage: 73, used_percentage: 27, context_window_size: 200000 } }, 'context-remaining', 'context-used', 'context-window-size'), 'Context 73% left · Context 27% used · 200K window');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_project_name_uses_posix_basename', () => {
    for (const [project_dir, name] of [['/code/repo', 'repo'], ['/code/repo/', 'repo'], ['/code/项目', '项目']])
        assert.equal(items({ workspace: { project_dir } }, 'project-name'), 'Project ' + name);
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_project_name_rejects_invalid_values_without_fallback', () => {
    for (const project_dir of [null, 7, '', '/', '///'])
        assert.equal(items({ workspace: { current_dir: '/fallback/current', project_dir, repo: { owner: 'fallback', name: 'repo' } } }, 'project-name'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_project_name_sanitizes_payload_without_filesystem_access', () => {
    assert.equal(items({ workspace: { project_dir: '/code/\x1b[31mproject\nname' } }, 'project-name'), 'Project [31mproject name');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_hostname_renders_sanitizes_and_handles_failures', () => {
    for (const [value, expected] of [['devbox', 'Host devbox'], ['', ''], ['dev\nbox\x1b[31m', 'Host dev box [31m'], [null, '']])
        assert.equal(rendered({}, config(['hostname']), { hostname: () => value! }), expected);
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_hostname_is_not_loaded_when_unselected', () => {
    assert.equal(rendered({ model: { id: 'test-model' } }, config(['model-with-effort']), { hostname: () => assert.fail('hostname selected') }), 'test-model');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_location_items_coalesce_when_adjacent', () => {
    assert.equal(rendered({ workspace: { current_dir: '/code/repo/src', project_dir: '/code/repo' } }, config(['current-dir', 'project-name', 'hostname']), { hostname: () => 'devbox' }), '/code/repo/src · Project repo · Host devbox');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_version_item', () => {
    assert.equal(items({ version: '2.1.258' }, 'version'), 'v2.1.258');
    for (const version of ['', 7])
        assert.equal(items({ version }, 'version'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_session_prefers_name_then_id_prefix', () => {
    for (const [data, expected] of [[{ session_id: 'abcdefghijkl', session_name: 'Refactor' }, 'Session Refactor'], [{ session_id: 'abcdefghijkl' }, 'Session abcdefgh'], [{ session_id: 'abc' }, 'Session abc'], [{ session_id: 'abcdefgh', session_name: '' }, 'Session abcdefgh'], [{ session_id: '' }, '']])
        assert.equal(items(data, 'session'), expected);
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_cost_item_full', () => {
    assert.equal(items({ cost: { total_cost_usd: .12, total_duration_ms: 750000, total_lines_added: 156, total_lines_removed: 23 } }, 'cost'), 'Total $0.12 · 12m 30s · +156/-23');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_cost_item_omits_zero_parts', () => {
    assert.equal(items({ cost: { total_cost_usd: 0, total_duration_ms: 0, total_lines_added: 0, total_lines_removed: 0 } }, 'cost'), 'Total $0.00');
    for (const data of [{ cost: { total_cost_usd: true } }, { cost: { total_cost_usd: 'nope' } }, {}])
        assert.equal(items(data, 'cost'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_prompt_cache_item', () => {
    for (const [prompt_cache, expected] of [[{ hit_ratio: .91, cache_write_tokens: 352000 }, 'cache 91% · 352K w'], [{ hit_ratio: 1.5, cache_write_tokens: 352000 }, '352K w'], [{ hit_ratio: .91, cache_write_tokens: 0 }, 'cache 91%'], [{}, '']])
        assert.equal(items({ prompt_cache }, 'prompt-cache'), expected);
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_fast_mode_item', () => {
    assert.equal(items({ fast_mode: true }, 'fast-mode'), 'fast');
    for (const data of [{ fast_mode: false }, {}])
        assert.equal(items(data, 'fast-mode'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_agent_item', () => {
    assert.equal(items({ agent: { name: 'orchestrator' } }, 'agent'), 'Agent orchestrator');
    for (const data of [{ agent: { name: '' } }, {}])
        assert.equal(items(data, 'agent'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_vim_mode_item', () => {
    assert.equal(items({ vim: { mode: 'NORMAL' } }, 'vim-mode'), 'vim NORMAL');
    for (const data of [{ vim: { mode: '' } }, {}])
        assert.equal(items(data, 'vim-mode'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_thinking_item', () => {
    assert.equal(items({ thinking: { enabled: true } }, 'thinking'), 'thinking');
    for (const data of [{ thinking: { enabled: false } }, {}])
        assert.equal(items(data, 'thinking'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_pr_item', () => {
    assert.equal(items({ pr: { number: 1234, review_state: 'approved' } }, 'pr'), 'PR #1234 · approved');
    assert.equal(items({ pr: { number: 1234, review_state: 'approved', kind: 'mr' } }, 'pr'), 'MR !1234 · approved');
    assert.equal(items({ pr: { number: 7 } }, 'pr'), 'PR #7');
    for (const data of [{ pr: { number: true } }, { pr: { number: '' } }, {}])
        assert.equal(items(data, 'pr'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_worktree_item', () => {
    assert.equal(items({ worktree: { name: 'feat-x' } }, 'worktree'), 'Worktree feat-x');
    for (const data of [{ worktree: { name: '' } }, {}])
        assert.equal(items(data, 'worktree'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_repo_item', () => {
    assert.equal(items({ workspace: { repo: { host: 'github.com', owner: 'acme', name: 'widget' } } }, 'repo'), 'Repo acme/widget');
    for (const data of [{ workspace: { repo: { owner: 'acme' } } }, {}])
        assert.equal(items(data, 'repo'), '');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_new_groups_coalesce_adjacent_items', () => {
    const data = { model: { id: 'test-model' }, effort: { level: 'max' }, fast_mode: true, thinking: { enabled: true }, prompt_cache: { hit_ratio: .91, cache_write_tokens: 352000 }, pr: { number: 1234, review_state: 'approved' }, workspace: { current_dir: '/code/repo', repo: { owner: 'acme', name: 'widget' } } };
    assert.equal(rendered(data, config(['model-with-effort', 'fast-mode', 'thinking', 'git', 'pr', 'repo', 'tokens', 'prompt-cache']), { git, usage }), 'test-model max · fast · thinking | Git main · PR #1234 · approved · Repo acme/widget | hit 10 · miss 20 · out 5 · cache 91% · 352K w');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_new_groups_do_not_cross_ungrouped_items', () => {
    assert.equal(items({ version: '2.1.258', session_id: 'abcdefgh', session_name: 'Refactor', model: { id: 'test-model' } }, 'version', 'model-with-effort', 'session'), 'v2.1.258 | test-model | Session Refactor');
});
test('tests.rendering.test_statusline_new_items.NewItemRenderingTests.test_new_items_do_not_load_expensive_sources', () => {
    assert.equal(rendered({ cost: { total_cost_usd: 1 } }, config(['cost']), { git: () => assert.fail('Git selected'), usage: () => assert.fail('Usage selected') }), 'Total $1.00');
});
test('tests.rendering.test_statusline_new_items.NewItemSubprocessTests.test_new_items_render_end_to_end', t => {
    const result = cli(t, 'render', JSON.stringify({ version: '2.1.258', session_id: 'abc12345xyz', cost: { total_cost_usd: .12, total_duration_ms: 750000, total_lines_added: 156, total_lines_removed: 23 } }), config(['version', 'session', 'cost']));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout.trim(), 'v2.1.258 | Session abc12345 | Total $0.12 · 12m 30s · +156/-23');
});
