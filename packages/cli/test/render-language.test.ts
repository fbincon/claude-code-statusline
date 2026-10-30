import test from 'node:test';
import assert from 'node:assert/strict';
import { config, agentConfig, env, rendered, updateDisplay } from './render-support.js';
import { BY_SCOPE } from '@fbincon/statusline-core/config/catalog';
import { DEFAULT_FORMATTING } from '@fbincon/statusline-core/config/defaults';
import { defaultItem } from '@fbincon/statusline-core/config/display';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { previewRows, samplePreviewData, SampleRenderState } from '@fbincon/statusline-core/rendering/preview';
import { renderTask } from '@fbincon/statusline-core/rendering/subagents';
import { configuredRows, RenderState } from '@fbincon/statusline-core/rendering/items';
import { displayWidth, strip } from '@fbincon/statusline-core/rendering/layout';
import { renderTaskTimer } from '@fbincon/statusline-core/rendering/timer';
import { NO_COLOR } from '@fbincon/statusline-core/rendering/palette';
import { spendMetric } from '@fbincon/statusline-core/rendering/metrics';
import { metric } from '@fbincon/statusline-core/rendering/live';
import { presentation } from '../src/rendering/environment.js';
import type { DisplayDraft } from '@fbincon/statusline-core/contracts/ui';
const packs = new Map(await Promise.all(LANGUAGES.map(async (code) => [code, await presentation(code)] as const)));
const localized = (language: typeof LANGUAGES[number]) => ({ ...env, language: packs.get(language)! });
function sample(ids: string[], language: typeof LANGUAGES[number] = 'zh-CN', updates: Partial<DisplayDraft> = {}, width = 2000): string {
    return previewRows(config(ids, { statusline_language: language, ...updates }), width, localized(language), '/test/home').join('\n');
}
test('tests.rendering.test_statusline_preview.PreviewContentTests.test_all_catalog_items_have_fixed_sample_values_in_draft_order', () => {
    const selected = ['model-with-effort', 'fast-mode', 'thinking', 'current-dir', 'project-name', 'hostname', 'git', 'pr', 'repo', 'worktree', 'context-remaining', 'context-used', 'context-window-size', 'five-hour-limit', 'weekly-limit', 'spend-limit', 'tokens', 'prompt-cache', 'task-timer', 'task-active-timer', 'version', 'session', 'cost', 'agent', 'vim-mode'];
    const cfg = config(selected, { scope_labels: 'when-subagents' }), expected = 'Main/Session | claude-opus high · fast · thinking | /test/home/projects/claude-code-statusline/src · Project claude-code-statusline · Host devbox | Git feature/statusline-tui ↑1 ~2 ?1 · PR #42 · approved · Repo example/claude-code-statusline | Worktree statusline-tui | Context 73% left · Context 27% used · 200K window | 5h 82% left · weekly 64% left · spend 91% left | hit 1.2M · miss 87.5K · out 22.4K · cache 91% · 352K w | ✓ 1m 42s | Active 1m 30s | v2.1.289 | Session demo-session | Total $0.12 · 12m 30s · +156/-23 | Agent reviewer | vim NORMAL';
    assert.equal(previewRows(cfg, 600, env, '/test/home').join('\n'), expected);
    const ids = [...BY_SCOPE.main.keys()].filter(id => !['text', 'spacer'].includes(id)), state = new SampleRenderState(samplePreviewData('/test/home'), config(ids), NO_COLOR, ' · ', env);
    assert.equal(ids.filter(id => state.render(id) !== null).length, ids.length);
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_builtin_phrases_and_known_values_share_the_production_preview', () => {
    const value = sample(['model-with-effort', 'context-remaining', 'weekly-limit', 'cache-state', 'run-state', 'permission-mode', 'last-tool', 'pr', 'spend-period']);
    for (const expected of ['claude-opus 高', '上下文 剩余 73%', '每周 剩余 64%', '缓存 热', '状态 等待代理', '模式 规划*', '工具 Read 成功', 'PR #42', '已批准', '支出 每月'])
        assert.ok(value.includes(expected), expected);
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_english_phrases_retain_existing_bytes', () => {
    const cases = { 'context-remaining': 'Context 73% left', 'context-used': 'Context 27% used', 'context-window-size': '200K window', 'model-with-effort': 'claude-opus high', 'weekly-limit': 'weekly 64% left', 'weekly-reset': 'weekly reset 6d 2h', 'cache-state': 'Cache warm', 'cache-expires': 'Cache TTL 4m 20s', 'branch-diff': 'Diff 3 files +42/-7', 'task-active-timer': 'Active 1m 30s', 'last-tool': 'Tool Read success', 'run-state': 'State waiting agents' };
    for (const [id, expected] of Object.entries(cases))
        assert.equal(sample([id], 'en'), expected);
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_every_catalog_item_renders_without_translation_key_leaks', () => {
    const task = { id: 'agent', name: '自定义 Name', model: 'claude-opus', effort: 'high', status: 'running', startTime: 1000, tokenCount: 10000, contextWindowSize: 200000, description: '用户描述', cwd: '/自定义/project' };
    for (const language of LANGUAGES)
        for (const scope of ['main', 'subagent'] as const)
            for (const id of BY_SCOPE[scope].keys()) {
                if (['text', 'spacer'].includes(id))
                    continue;
                const value = scope === 'main' ? sample([id], language) : renderTask(task, agentConfig([id], {}, { statusline_language: language }), localized(language), 2000, 43000);
                assert.ok(value, `${language}/${scope}/${id}`);
                assert.ok(!value.includes('statusline.'));
            }
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_unknown_values_names_and_numbers_are_preserved', () => {
    const p = packs.get('zh-CN')!;
    for (const domain of ['run', 'permission', 'effort', 'tool', 'review', 'period']) {
        assert.equal(p.value(domain, 'custom-high/成功'), 'custom-high/成功');
        assert.equal(p.value(domain, 42), 42);
    }
    const value = rendered({ model: { id: 'Context my-custom-model' }, effort: { level: 'future-effort' }, pr: { number: 42, review_state: 'custom-review' }, output_style: { name: 'Default' }, session_name: '用户的 Session' }, config(['model-with-effort', 'pr', 'output-style', 'session-name'], { statusline_language: 'zh-CN' }), { language: p }, 2000);
    for (const expected of ['Context my-custom-model', 'future-effort', 'custom-review', 'Default', '用户的 Session'])
        assert.ok(value.includes(expected));
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_decoration_uses_owned_label_boundaries_in_both_languages', () => {
    for (const [language, value] of [['en', '73% left'], ['zh-CN', '剩余 73%'], ['es', '73% restante'], ['fr', '73% restant'], ['de', '73% übrig'], ['pt-BR', '73% restante'], ['ru', 'осталось 73%'], ['id', 'tersisa 73%']] as const)
        for (const labels of ['legacy', 'short', 'off'] as const) {
            const cfg = updateDisplay(config(['context-remaining'], { statusline_language: language, formatting: { ...DEFAULT_FORMATTING, labels } }), { item_options: { 'context-remaining': { ...defaultItem(), label: '我的 标签' } } });
            assert.equal(previewRows(cfg, 2000, localized(language), '/test/home').join('\n'), '我的 标签 ' + value);
            const agents = agentConfig(['context-remaining'], {}, { statusline_language: language, formatting: { ...DEFAULT_FORMATTING, labels } });
            agents.subagents.instances[0]!.options.label = '我的 标签';
            const task = { id: 'agent', name: 'User 👩🏽‍💻', tokenCount: 54000, contextWindowSize: 200000, status: 'running' };
            assert.equal(renderTask(task, agents, localized(language), 2000, 43000), '我的 标签 ' + value);
        }
    for (const id of ['Context actual model', '✓ original model']) {
        const cfg = updateDisplay(config(['model'], { formatting: { ...DEFAULT_FORMATTING, icons: 'ascii' } }), { item_options: { model: { ...defaultItem(), label: 'Engine', icon: '' } } });
        assert.equal(rendered({ model: { id } }, cfg), 'Engine ' + id);
    }
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_inherited_empty_and_short_labels_are_distinct', () => {
    assert.equal(sample(['context-remaining']), '上下文 剩余 73%');
    const cfg = updateDisplay(config(['context-remaining'], { statusline_language: 'zh-CN' }), { item_options: { 'context-remaining': { ...defaultItem(), label: '' } } });
    assert.equal(previewRows(cfg, 2000, localized('zh-CN'), '/test/home').join('\n'), '剩余 73%');
    assert.equal(sample(['context-remaining'], 'zh-CN', { formatting: { ...DEFAULT_FORMATTING, labels: 'short' } }), '剩余上下文 剩余 73%');
    assert.equal(sample(['context-remaining'], 'zh-CN', { formatting: { ...DEFAULT_FORMATTING, labels: 'off' } }), '剩余 73%');
});
test('translated cost-rate and API request labels disappear cleanly under custom and hidden labels', () => {
    for (const language of LANGUAGES) for (const [id, expected] of [['session-cost-rate', /^~\$0\.58\//u], ['api-requests', /^14$/u]] as const) {
        const off = sample([id], language, { formatting: { ...DEFAULT_FORMATTING, labels: 'off' } });
        assert.match(off, expected, language + '/' + id);
        const cfg = updateDisplay(config([id], { statusline_language: language }), { item_options: { [id]: { ...defaultItem(), label: 'CUSTOM' } } });
        assert.equal(previewRows(cfg, 2000, localized(language), '/test/home').join('\n'), 'CUSTOM ' + off);
    }
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_units_and_raw_arithmetic_do_not_change_with_language', () => {
    for (const language of LANGUAGES)
        for (const [id, value] of [['task-active-timer', '1m 30s'], ['output-rate', '36.5 tok/s'], ['ttft', '0.420s'], ['prompt-cost', '$0.0123'], ['tokens', '1.2M']])
            assert.ok(sample([id!], language).includes(value!));
    assert.equal(spendMetric({ period: 'future' }, 'spend-period', DEFAULT_FORMATTING, packs.get('zh-CN')!), null);
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_timer_language_does_not_change_lifecycle_or_symbols', () => {
    for (const count of [1, 2]) {
        const state = { status: 'running', phase: 'waiting_subagents', active_agents: Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i), {}])), started_wall_ns: 0n, started_boot_ns: 0n, boot_id: 'boot' }, now = { wall_ns: 62000000000n, boot_ns: 62000000000n, boot_id: 'boot' };
        for (const language of ['en', 'zh-CN'] as const) {
            const p = packs.get(language)!, value = renderTaskTimer(state, now, (key, params) => p.text(key.replace(/^statusline\./u, ''), params), NO_COLOR)!;
            assert.ok(value.includes(language === 'en' ? count + ' agent' + (count === 1 ? '' : 's') : `⏳ ${count} 个代理 · 1m 02s`));
        }
        assert.equal(state.status, 'running');
    }
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_wide_text_fitting_colors_and_explicit_rows', () => {
    for (const language of LANGUAGES)
        for (const colors of [false, true])
            for (const labels of ['legacy', 'short', 'off'] as const) {
                const cfg = updateDisplay(config(['model', 'context-used', 'weekly-limit'], { statusline_language: language, use_colors: colors, formatting: { ...DEFAULT_FORMATTING, labels, icons: 'unicode', thresholds: { enabled: true, warning: 70, critical: 90 } } }), { item_options: { model: { ...defaultItem(), label: '组合é中文', max_width: 12 } } });
                for (const width of [2, 12, 32, 64, 80])
                    for (const mode of ['auto', 'explicit'] as const) {
                        const row = updateDisplay(cfg, { layout: { mode, rows: mode === 'auto' ? [] : [['model', 'context-used'], ['weekly-limit']] } });
                        for (const line of previewRows(row, width, localized(language), '/test/home'))
                            assert.ok(displayWidth(line) <= width);
                    }
            }
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_normal_render_translation_does_not_load_ui_catalogues', async () => {
    assert.ok(sample(['context-remaining']).includes('上下文'));
    assert.ok(sample(['context-remaining'], 'en').includes('Context'));
    assert.equal((await presentation('unknown')).text('scope.main'), 'Main/Session');
});
test('tests.rendering.test_statusline_language.StatuslineLanguageTests.test_subagent_known_effort_and_custom_task_survive_language_and_width', () => {
    const task = { name: 'User name', description: '用户 é 描述', model: 'claude-opus', effort: 'high', tokenCount: 10000, contextWindowSize: 200000 }, cfg = agentConfig(['model-with-effort', 'context-remaining', 'task'], {}, { statusline_language: 'zh-CN' });
    const value = renderTask(task, cfg, localized('zh-CN'), 2000);
    for (const expected of ['opus/高', '上下文 剩余 95%', '用户 é 描述'])
        assert.ok(value.includes(expected));
    for (const width of [2, 12, 32, 64])
        assert.ok(displayWidth(renderTask(task, cfg, localized('zh-CN'), width)) <= width);
});
test('tests.rendering.test_statusline_preview.PreviewContentTests.test_toggle_order_separator_directory_padding_and_width_change_preview', () => {
    const base = config(['model-with-effort', 'current-dir', 'git'], { scope_labels: 'when-subagents' }), rows = (cfg = base, width = 500, padding = 0) => previewRows(cfg, width, env, '/test/home', padding), initial = rows();
    assert.notDeepEqual(rows(updateDisplay(base, { items: ['git', 'current-dir'] })), initial);
    const reordered = rows(updateDisplay(base, { items: ['git', 'current-dir', 'model-with-effort'] }));
    assert.ok(reordered[0]!.startsWith('Main/Session'));
    assert.ok(reordered.join('\n').includes('Git feature/statusline-tui'));
    assert.ok(rows(updateDisplay(base, { separator_style: 'compact' }))[0]!.includes(' · '));
    assert.ok(rows(updateDisplay(base, { directory_style: 'home' }))[0]!.includes('~/projects/claude-code-statusline/src'));
    for (const style of ['project-relative', 'basename'] as const)
        assert.ok(rows(updateDisplay(base, { directory_style: style }))[0]!.includes('src'));
    assert.ok(rows(base, 500, 4).every(row => row.startsWith('    ')));
    assert.ok(rows(base, 24).length > initial.length);
    assert.ok(rows(base, 24).every(row => displayWidth(row) <= 24));
});
test('tests.rendering.test_statusline_preview.PreviewContentTests.test_colors_palette_and_empty_items', () => {
    const cfg = config(['model-with-effort'], { use_colors: true });
    assert.ok(previewRows(cfg, 80, env, '/test/home')[0]!.includes('38;2'));
    assert.ok(previewRows(updateDisplay(cfg, { palette: 'ansi' }), 80, env, '/test/home')[0]!.includes('\x1b[1;33m'));
    assert.ok(!previewRows(updateDisplay(cfg, { use_colors: false }), 80, env, '/test/home')[0]!.includes('\x1b'));
    assert.deepEqual(previewRows(updateDisplay(cfg, { items: [] }), 80, env, '/test/home'), []);
});
test('tests.rendering.test_statusline_preview.PreviewContentTests.test_preview_never_calls_live_or_persistent_sources', () => {
    const fail = () => assert.fail('live or persistent source');
    assert.ok(previewRows(config([...BY_SCOPE.main.keys()].filter(id => !['text', 'spacer'].includes(id))), 80, { ...env, now: fail, git: fail, usage: fail, live: fail, branchDiff: fail, hostname: fail, task: fail, activePoint: fail, hadSubagents: fail }, '/test/home').length);
});
test('tests.rendering.test_statusline_scope.ScopeLabelTests.test_off_always_and_conditional_modes', () => {
    const data = { session_id: 'session', prompt_id: 'prompt', model: { id: 'claude-opus' } };
    for (const mode of ['off', 'always', 'when-subagents'] as const)
        assert.equal(rendered(data, config(['model-with-effort'], { scope_labels: mode }), { hadSubagents: () => true }), (mode === 'off' ? '' : 'Main/Session | ') + 'claude-opus');
    assert.equal(rendered(data, config(['model-with-effort'], { scope_labels: 'when-subagents' }), { hadSubagents: () => false }), 'claude-opus');
});
test('tests.rendering.test_statusline_scope.ScopeLabelTests.test_no_subagent_output_remains_byte_compatible', () => {
    const data = { model: { id: 'claude-opus' } };
    assert.deepEqual(configuredRows(data, config(['model-with-effort'], { scope_labels: 'when-subagents' }), 200, env), configuredRows(data, config(['model-with-effort']), 200, env));
});
test('tests.rendering.test_statusline_scope.ScopeLabelTests.test_completed_agent_history_keeps_label_and_empty_main_stays_empty', () => {
    const sources = { hadSubagents: () => true }, data = { model: { id: 'claude-opus' } };
    assert.equal(rendered(data, config(['model-with-effort'], { scope_labels: 'when-subagents' }), sources), 'Main/Session | claude-opus');
    assert.equal(rendered(data, config([], { scope_labels: 'when-subagents' }), sources), '');
});
test('tests.rendering.test_statusline_scope.ScopeLabelTests.test_preview_simulates_a_prompt_with_subagents', () => {
    assert.ok(previewRows(config(['model-with-effort'], { scope_labels: 'when-subagents' }), 200, env, '/test/home')[0]!.startsWith('Main/Session | '));
});
test('tests.rendering.test_live.LiveRenderingTests.test_unavailable_zero_and_partial_are_distinct', () => {
    assert.equal(metric({}, 'active-agents', DEFAULT_FORMATTING, env.language), 'Agents —');
    assert.equal(metric({ 'active-agents': { value: 0 } }, 'active-agents', DEFAULT_FORMATTING, env.language), 'Agents 0');
    assert.equal(metric({ 'active-agents': { value: 0, partial: true } }, 'active-agents', DEFAULT_FORMATTING, env.language), 'Agents 0*');
});
test('tests.rendering.test_live.LiveRenderingTests.test_live_collection_is_lazy_and_shared_and_preview_does_not_collect', () => {
    const ids = ['run-state', 'permission-mode', 'active-agents', 'task-progress', 'last-tool', 'ttft', 'output-rate', 'prompt-input-tokens', 'prompt-output-tokens', 'prompt-cost'];
    let calls = 0;
    const cfg = config(ids), sources = { ...env, hostname: () => 'host', live: () => { calls++; return {}; } }, state = new RenderState({ session_id: 's' }, cfg, NO_COLOR, ' | ', sources);
    assert.ok(state.render('hostname'));
    assert.equal(calls, 0);
    for (const id of ids)
        assert.ok(state.render(id));
    assert.equal(calls, 1);
    assert.ok(previewRows(cfg, 80, sources, '/test/home').length);
    assert.equal(calls, 1);
});
