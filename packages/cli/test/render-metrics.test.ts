import test from 'node:test';
import assert from 'node:assert/strict';
import { config, agentConfig, env, rendered } from './render-support.js';
import { BY_SCOPE } from '@fbincon/statusline-core/config/catalog';
import { previewRows } from '@fbincon/statusline-core/rendering/preview';
import { renderTask } from '@fbincon/statusline-core/rendering/subagents';
import { liveDirectory } from '@fbincon/statusline-core/rendering/items';
import { displayWidth, strip } from '@fbincon/statusline-core/rendering/layout';
import { segment } from '@fbincon/statusline-core/rendering/git';
import { DEFAULT } from '@fbincon/statusline-core/rendering/palette';
import type { Data } from '@fbincon/statusline-core/runtime/values';
const NOW = 2000000000;
const render = (data: unknown, ...ids: string[]) => rendered(data, config(ids), { now: () => NOW });
const A = ['model', 'effort', 'context-tokens', 'five-hour-reset', 'weekly-reset', 'session-cost', 'session-duration', 'api-duration', 'lines-changed'];
const AGENT = ['model', 'effort', 'context-tokens', 'context-window-size'];
const B = ['cache-state', 'cache-expires', 'cache-misses', 'api-requests', 'output-style', 'session-name', 'session-id', 'session-id-short', 'git-branch', 'git-changes', 'git-ahead-behind'];
const noLive = { ...env, now: () => assert.fail('live clock'), git: () => assert.fail('live Git'), usage: () => assert.fail('live transcript') };
const ok = (extra: Data = {}) => ({ kind: 'ok', branch: 'main', oid: 'abc1234', upstream: null, upstream_gone: false, ahead: 0, behind: 0, staged: 0, unstaged: 0, conflicts: 0, untracked: 0, ...extra });
test('tests.rendering.test_display_metrics.DisplayMetricsTests.test_additions_are_opt_in_and_accept_compounds', () => {
    for (const id of A)
        assert.equal(BY_SCOPE.main.get(id)!.default_position, null);
    for (const id of AGENT)
        assert.equal(BY_SCOPE.subagent.get(id)!.default_position, null);
    assert.equal(render({ model: { id: 'claude-opus' }, effort: { level: 'high' } }, 'model-with-effort', 'model', 'effort'), 'claude-opus high · claude-opus · high');
    assert.equal(render({}, ...A), '');
});
test('tests.rendering.test_display_metrics.DisplayMetricsTests.test_model_fallback_and_effort_independence', () => {
    assert.equal(render({ model: { id: 42, display_name: 'Opus' } }, 'model'), 'Opus');
    assert.equal(render({ effort: { level: 'high' } }, 'effort'), 'high');
    assert.equal(render({ effort: { level: true } }, 'effort'), '');
    assert.doesNotMatch(render({ model: { id: '中文\n\x1b[31mmodel' } }, 'model'), /[\x1b\n]/u);
});
test('tests.rendering.test_display_metrics.DisplayMetricsTests.test_context_uses_only_live_input_and_cache_components', () => {
    const context: Data = { context_window_size: 200000, total_input_tokens: 1, current_usage: { input_tokens: 35000, cache_creation_input_tokens: 12000, cache_read_input_tokens: 7000, output_tokens: 90000 } };
    const text = () => render({ context_window: context }, 'context-tokens');
    assert.equal(text(), 'Context 54K / 200K');
    context.current_usage = null;
    assert.equal(text(), '');
    delete context.current_usage;
    context.total_input_tokens = 0;
    assert.equal(text(), 'Context 0 / 200K');
    for (const value of [null, true, '5', -1, 1.2, Infinity, 10n ** 1000n]) {
        context.total_input_tokens = value;
        assert.equal(text(), '');
    }
});
test('tests.rendering.test_display_metrics.DisplayMetricsTests.test_reset_windows_expire_together_and_do_not_require_percentage', () => {
    for (const [field, allowance, reset, label] of [['five_hour', 'five-hour-limit', 'five-hour-reset', '5h'], ['seven_day', 'weekly-limit', 'weekly-reset', 'weekly']] as const) {
        const window: Data = { used_percentage: 25, resets_at: NOW + 7980 }, data = { rate_limits: { [field]: window } };
        assert.equal(render(data, allowance, reset), `${label} 75% left · ${label} reset 2h 13m`);
        for (const value of [NOW, NOW - 1, null, true, 'tomorrow', NaN, Infinity]) {
            window.resets_at = value;
            assert.equal(render(data, allowance, reset), '');
        }
        window.resets_at = NOW + .1;
        assert.equal(render(data, reset), `${label} reset 1s`);
        delete window.resets_at;
        assert.equal(render(data, allowance, reset), `${label} 75% left`);
        delete window.used_percentage;
        window.resets_at = NOW + 525600;
        assert.equal(render(data, reset), `${label} reset 6d 2h`);
    }
});
test('tests.rendering.test_display_metrics.DisplayMetricsTests.test_cost_components_are_independent_and_zero_is_observed', () => {
    const ids = ['session-cost', 'session-duration', 'api-duration', 'lines-changed'];
    let cost: Data = { total_cost_usd: .42, total_duration_ms: 62000, total_api_duration_ms: 12000, total_lines_added: 128, total_lines_removed: 32 };
    assert.equal(render({ cost }, ...ids), 'Cost $0.42 · Session 1m 02s · API 0m 12s · +128/-32');
    cost = Object.fromEntries(Object.keys(cost).map(key => [key, 0]));
    assert.equal(render({ cost }, ...ids), 'Cost $0.00 · Session 0m 00s · API 0m 00s · +0/-0');
    for (const bad of [null, true, '1', -1, NaN, Infinity, 10n ** 1000n]) {
        cost = Object.fromEntries(Object.keys(cost).map(key => [key, bad]));
        assert.equal(render({ cost }, ...ids), '');
    }
    assert.equal(render({ cost: { total_api_duration_ms: 12000 } }, ...ids), 'API 0m 12s');
    assert.equal(render({ cost: { total_lines_added: 5 } }, 'lines-changed'), '');
});
test('tests.rendering.test_display_metrics.DisplayMetricsTests.test_agent_fields_do_not_inherit_main_values', () => {
    const cfg = agentConfig(AGENT), task: Data = { model: 'claude-sonnet-5', effort: 'high', tokenCount: 84000, contextWindowSize: 200000 };
    assert.equal(renderTask(task, cfg, env, 200, NOW * 1000), 'sonnet-5 · high · Context 84K / 200K · 200K window');
    delete task.effort;
    assert.ok(!renderTask(task, cfg, env, 200).includes('high'));
    task.effort = 16000;
    assert.ok(renderTask(task, cfg, env, 200).includes('16000'));
    assert.equal(BY_SCOPE.subagent.get('effort')!.minimum_version, '2.1.214');
    for (const width of [2, 12, 32, 80])
        assert.ok(displayWidth(renderTask(task, cfg, env, width)) <= width);
});
test('tests.rendering.test_display_metrics.DisplayMetricsTests.test_preview_is_complete_and_uses_no_live_sources_or_clock', () => {
    const text = previewRows(config(A), 1000, noLive, '/home/test').join('\n');
    for (const expected of ['5h reset 2h 13m', 'weekly reset 6d 2h', 'API 1m 15s'])
        assert.ok(text.includes(expected));
});
test('tests.rendering.test_display_metrics.CacheSessionGitTests.test_missing_fields_are_hidden_and_new_items_are_opt_in', () => {
    assert.equal(render({}, ...B), '');
    for (const id of B)
        assert.equal(BY_SCOPE.main.get(id)!.default_position, null);
    for (const id of ['prompt-cache', 'cache-state', 'cache-expires', 'cache-misses', 'api-requests'])
        assert.equal(BY_SCOPE.main.get(id)!.minimum_version, '2.1.251');
});
test('tests.rendering.test_display_metrics.CacheSessionGitTests.test_cache_warmth_cools_at_expiry_and_unknown_is_distinct', () => {
    const cache: Data = { warm: true, caching_observed: true, expires_at: NOW + 260 }, text = () => render({ prompt_cache: cache }, 'cache-state', 'cache-expires');
    assert.equal(text(), 'Cache warm · Cache TTL 4m 20s');
    for (const value of [NOW, NOW - 1]) {
        cache.expires_at = value;
        assert.equal(text(), 'Cache cold');
    }
    for (const value of [null, true, 'later', NaN, Infinity, -1, 10n ** 1000n]) {
        cache.expires_at = value;
        assert.equal(text(), '');
    }
    Object.assign(cache, { expires_at: NOW + 260, warm: false });
    assert.equal(text(), 'Cache cold');
    cache.caching_observed = false;
    assert.equal(text(), 'Cache unobserved');
    for (const key of Object.keys(cache))
        delete cache[key];
    assert.equal(text(), '');
});
test('tests.rendering.test_display_metrics.CacheSessionGitTests.test_cache_counts_are_official_main_counts_not_transcript_estimates', () => {
    assert.equal(rendered({ prompt_cache: { misses: 0, requests: 14, expected_rebuilds: 8 }, context_window: { total_input_tokens: 999999 } }, config(['cache-misses', 'api-requests']), { usage: () => assert.fail('transcript') }), 'Cache miss 0 · API requests 14');
    for (const bad of [null, true, '2', -1, 1.5, NaN, Infinity, 10n ** 1000n])
        assert.equal(render({ prompt_cache: { misses: bad, requests: bad } }, 'cache-misses', 'api-requests'), '');
});
test('tests.rendering.test_display_metrics.CacheSessionGitTests.test_named_short_full_session_and_style_are_independent', () => {
    const data: Data = { session_name: '中文 Demo', session_id: 'abcdefgh-1234-5678', output_style: { name: 'Explanatory' } };
    assert.equal(render(data, 'session', 'session-name', 'session-id-short', 'session-id', 'output-style'), 'Session 中文 Demo | Session 中文 Demo | ID abcdefgh | ID abcdefgh-1234-5678 | Style Explanatory');
    delete data.session_name;
    assert.equal(render(data, 'session', 'session-name', 'session-id'), 'Session abcdefgh | ID abcdefgh-1234-5678');
    assert.equal(render({ session_name: 42, session_id: false, output_style: { name: [] } }, 'session-name', 'session-id', 'output-style'), '');
    assert.ok(!render({ session_name: '中文\nDemo' }, 'session-name').includes('\n'));
});
test('tests.rendering.test_display_metrics.CacheSessionGitTests.test_git_components_and_compound_share_one_collection', () => {
    const result = ok({ upstream: 'origin/main', ahead: 2, behind: 3, unstaged: 2, conflicts: 1, untracked: 1 }), data = { cwd: '/fixture', session_id: 'test-session' };
    let calls = 0;
    const render = (...ids: string[]) => rendered(data, config(ids), { git: (cwd, session) => { assert.equal(cwd, '/fixture'); assert.equal(session, 'test-session'); calls++; return result; } });
    assert.equal(render('git', 'git-branch', 'git-changes', 'git-ahead-behind'), 'Git main ↑2↓3~2!1?1 · Git main · Git ~2 !1 ?1 · Git ↑2 ↓3');
    assert.equal(calls, 1);
    Object.assign(result, { ahead: 0, behind: 0, unstaged: 0, conflicts: 0, untracked: 0 });
    assert.equal(render('git-changes', 'git-ahead-behind'), 'Git clean · Git ↑0 ↓0');
    result.upstream = null;
    assert.equal(render('git-ahead-behind'), '');
    Object.assign(result, { upstream: 'origin/main', upstream_gone: true });
    assert.equal(render('git-ahead-behind'), 'Git [gone]');
    result.branch = 'HEAD@abc1234';
    assert.equal(render('git-branch'), 'Git HEAD@abc1234');
    assert.equal(rendered(data, config(['git-branch', 'git-changes', 'git-ahead-behind']), { git: () => ({ kind: 'not_repo' }) }), '');
    assert.equal(rendered(data, config(['git-changes']), { git: () => ({ kind: 'error' }) }), 'Git!');
});
test('tests.rendering.test_display_metrics.CacheSessionGitTests.test_all_new_preview_values_are_fixed_without_collection', () => {
    const text = previewRows(config(B), 1000, noLive, '/home/test').join('\n');
    for (const value of ['Cache warm', 'Cache TTL 4m 20s', 'Cache miss 2', 'API requests 14', 'Style Default', 'Session demo-session', 'ID demo-session', 'ID demo-ses', 'Git feature/statusline-tui', 'Git ~2 ?1', 'Git ↑1 ↓0'])
        assert.ok(text.includes(value), value);
});
test('tests.rendering.test_display_metrics.GatewayMetricTests.test_gateway_optional_amount_and_period_are_independent', () => {
    const window: Data = { used_percentage: 62.8, resets_at: NOW + 500, used_usd: 314.12, limit_usd: 500, period: 'monthly' }, data = { rate_limits: { spend_limit: window } }, ids = ['spend-limit', 'spend-amount', 'spend-period'];
    assert.equal(render(data, ...ids), 'spend 37% left · Spend $314.12 / $500.00 · Spend monthly');
    delete window.used_usd;
    assert.equal(render(data, ...ids), 'spend 37% left · Spend monthly');
    delete window.period;
    assert.equal(render(data, ...ids), 'spend 37% left');
    Object.assign(window, { used_usd: 0, limit_usd: 0, period: 'daily' });
    assert.equal(render(data, 'spend-amount', 'spend-period'), 'Spend $0.00 / $0.00 · Spend daily');
    window.resets_at = NOW;
    assert.equal(render(data, ...ids), '');
});
test('tests.rendering.test_display_metrics.GatewayMetricTests.test_gateway_invalid_values_are_not_derived_from_percentage', () => {
    for (const bad of [null, true, '12', -1, NaN, Infinity, 10n ** 1000n])
        assert.equal(render({ rate_limits: { spend_limit: { used_percentage: 50, used_usd: bad, limit_usd: 500, period: bad } } }, 'spend-amount', 'spend-period'), '');
    for (const id of ['spend-amount', 'spend-period']) {
        assert.equal(BY_SCOPE.main.get(id)!.minimum_version, '2.1.284');
        assert.equal(BY_SCOPE.main.get(id)!.default_position, null);
    }
});
test('tests.rendering.test_display_metrics.GatewayMetricTests.test_preview_includes_gateway_and_raw_cumulative_counts', () => {
    assert.deepEqual(previewRows(config(['spend-amount', 'spend-period', 'input-tokens', 'output-tokens']), 500, noLive, '/home/test'), ['Spend $31.50 / $350.00 · Spend monthly | in 1.29M · out 22.4K']);
});
const limitIds = ['five-hour-limit', 'weekly-limit', 'spend-limit'];
test('tests.rendering.test_statusline_rate_limits.RateLimitSegmentTests.test_all_windows_render_in_fixed_order_as_remaining_percentages', () => {
    assert.equal(render({ rate_limits: { five_hour: { used_percentage: 23 }, seven_day: { used_percentage: 41 }, spend_limit: { used_percentage: 63 } } }, ...limitIds), '5h 77% left · weekly 59% left · spend 37% left');
});
test('tests.rendering.test_statusline_rate_limits.RateLimitSegmentTests.test_windows_are_independently_optional', () => {
    assert.equal(render({ rate_limits: { five_hour: { used_percentage: 23 }, seven_day: { used_percentage: 41 } } }, ...limitIds), '5h 77% left · weekly 59% left');
    assert.equal(render({ rate_limits: { seven_day: { used_percentage: 41 } } }, ...limitIds), 'weekly 59% left');
});
test('tests.rendering.test_statusline_rate_limits.RateLimitSegmentTests.test_absent_or_malformed_containers_hide_the_segment', () => {
    for (const rate_limits of [undefined, null, [], 'invalid', { five_hour: null }, { five_hour: [] }, { five_hour: {} }])
        assert.equal(render({ rate_limits }, ...limitIds), '');
});
test('tests.rendering.test_statusline_rate_limits.RateLimitSegmentTests.test_invalid_values_are_skipped', () => {
    for (const used_percentage of [null, true, false, '23', -1, NaN, Infinity, -Infinity])
        assert.equal(render({ rate_limits: { five_hour: { used_percentage } } }, ...limitIds), '');
});
test('tests.rendering.test_statusline_rate_limits.RateLimitSegmentTests.test_rounding_and_remaining_bounds', () => {
    for (const [used_percentage, left] of [[0, 100], [23.4, 77], [99.6, 0], [100, 0], [150, 0], [10n ** 400n, 0]])
        assert.equal(render({ rate_limits: { five_hour: { used_percentage } } }, ...limitIds), `5h ${left}% left`);
});
test('tests.rendering.test_statusline_git.GitDisplayTests.test_directory_precedence', () => {
    const data: Data = { cwd: '/cwd', workspace: { current_dir: '/current', project_dir: '/project' }, worktree: { path: '/worktree' } };
    assert.equal(liveDirectory(data), '/current');
    delete (data.workspace as Data).current_dir;
    assert.equal(liveDirectory(data), '/cwd');
    delete data.cwd;
    assert.equal(liveDirectory(data), '/worktree');
    delete data.worktree;
    assert.equal(liveDirectory(data), '/project');
    assert.equal(liveDirectory({}), null);
});
test('tests.rendering.test_statusline_git.GitDisplayTests.test_compact_segment_contract_uses_platform_specific_staged_spacing', () => {
    const result = ok({ upstream: 'origin/main', ahead: 2, behind: 1, staged: 5, unstaged: 3, conflicts: 1, untracked: 2 });
    assert.equal(strip(segment(result, DEFAULT, env.language, false)!), 'Git main ↑2↓1● 5~3!1?2');
    assert.equal(strip(segment(result, DEFAULT, env.language, true)!), 'Git main ↑2↓1●5~3!1?2');
    assert.equal(segment({ kind: 'not_repo' }, DEFAULT, env.language, false), null);
    assert.equal(strip(segment({ kind: 'error' }, DEFAULT, env.language, false)!), 'Git!');
});
test('tests.rendering.test_statusline_git.GitDisplayTests.test_zero_staged_count_does_not_add_a_marker', () => {
    assert.equal(strip(segment(ok({ ahead: 1, unstaged: 2 }), DEFAULT, env.language, false)!), 'Git main ↑1~2');
});
test('tests.rendering.test_statusline_git.GitDisplayTests.test_gone_suppresses_divergence_numbers', () => {
    assert.equal(strip(segment(ok({ upstream: 'origin/main', upstream_gone: true, ahead: 9, behind: 8 }), DEFAULT, env.language, false)!), 'Git main [gone]');
});
