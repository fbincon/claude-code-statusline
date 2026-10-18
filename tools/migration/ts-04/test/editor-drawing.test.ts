import test from 'node:test';
import { fixture, assert, bounded, text } from './support.js';
import { dimensions, formWindow } from '@fbincon/statusline-tui/layout';
import { ansiFrame, shortcuts } from '@fbincon/statusline-tui/drawing';
import { colorCapacity } from '@fbincon/statusline-tui/session';
import { LANGUAGES, t as tMessage } from '@fbincon/statusline-core/i18n/messages';
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import { guidanceLines } from '@fbincon/statusline-core/editor/guidance';
import { wrapText } from '@fbincon/statusline-core/editor/text';
import { terminalColor } from '@fbincon/statusline-core/rendering/colors';
test('tests.ui.test_layout.GroupWindowTests.test_all_selections_fit_with_group_headings_and_sticky_context', async (t) => {
    const rows = [{ group: 'A' }, { group: 'A' }, { group: 'B' }, { group: 'B' }, { group: 'C' }];
    for (const height of [1, 2, 3, 8])
        for (let selected = 0; selected < rows.length; selected++) {
            const w = formWindow(rows, selected, 0, height);
            assert.ok(w.lines.length <= height);
            assert.ok(w.lines.some(line => line.index === selected));
            if (height > 1)
                assert.equal(w.lines[0]!.group, rows[w.start]!.group);
        }
});
test('tests.ui.test_layout.GroupWindowTests.test_empty_and_invalid_selection_are_bounded', async (t) => {
    assert.deepEqual(formWindow([], 999, 999, 0), { start: 0, end: 0, lines: [] });
    for (const index of [-50, 50]) {
        const w = formWindow([{ group: 'A' }], index, -5, 1);
        assert.equal(w.start, 0);
        assert.equal(w.end, 1);
        assert.deepEqual(w.lines, [{ group: 'A', index: 0 }]);
    }
});
test('tests.ui.test_layout.GroupWindowTests.test_settings_layout_and_detail_groups_are_contiguous', async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    let rows = f.state.rows();
    assert.deepEqual([...new Set(rows.map(r => r.group))], ['Appearance', 'Refresh / behavior', 'Git metrics', 'Formatting', 'Risk colors', 'Subagent visibility', 'Presets / portable files', 'Interface']);
    assert.deepEqual(rows.slice(0, 5).map(r => r.key), ['colors', 'palette', 'directory-style', 'separator-style', 'scope-labels']);
    for (const page of ['layout', 'settings'] as const) {
        f.e.page = page;
        rows = f.state.rows();
        for (const group of new Set(rows.map(r => r.group))) {
            const ix = rows.flatMap((r, i) => r.group === group ? [i] : []);
            assert.equal(ix.at(-1)! - ix[0]! + 1, ix.length);
        }
    }
    f.e.detail = { scope: 'main', id: f.e.selected.main };
    assert.deepEqual(f.state.rows().slice(-2).map(r => r.key), ['item:priority', 'item:max_width']);
});
test('tests.ui.test_layout.GroupWindowTests.test_navigation_only_selects_fields_across_groups_and_resize', async (t) => {
    const f = await fixture(t);
    for (const page of ['settings', 'layout'] as const) {
        f.e.page = page;
        for (const key of ['home', 'down', 'pagedown', 'end', 'up', 'pageup']) {
            f.keys(key);
            for (const [w, h] of [[64, 18], [80, 24], [120, 30]]) {
                bounded(f.state, w!, h!);
                assert.ok(f.state.rows().some(r => r.key === f.e.setting));
            }
        }
    }
});
test('tests.ui.test_layout.DrawingTests.test_all_pages_at_boundaries_without_overlaps_or_out_of_bounds_writes', async (t) => {
    const f = await fixture(t);
    for (const [w, h] of [[32, 12], [64, 18], [64, 19], [64, 20], [80, 24], [120, 30], [80, 48]])
        for (const page of ['main', 'subagents', 'settings', 'layout'] as const) {
            f.e.page = page;
            const output = bounded(f.state, w!, h!);
            const body = output.rows.map(r => r.map(s => s.text).join('')).join('\n');
            if (w! >= 64) {
                assert.ok(body.includes('Preview (sample data)'));
                assert.ok(body.includes('Ctrl+S'));
                assert.equal(dimensions(w!, h!).preview.y + dimensions(w!, h!).preview.height, h! - 2);
                const ys = output.rows.flatMap((r, i) => i > 4 && i < dimensions(w!, h!).preview.y && r.some(s => s.reverse) ? [i] : []);
                assert.equal(ys.length, 1);
            }
            else
                assert.ok(body.includes('Terminal too small'));
        }
});
test('all framed pages retain complete borders, aligned columns and full-width selections in every language', async t => {
    for (const language of LANGUAGES) {
        const f = await fixture(t, language);
        for (const page of ['main', 'subagents', 'settings', 'layout'] as const) {
            f.e.page = page;
            for (const [width, height] of [[64, 20], [80, 24], [120, 30]]) {
                const value = bounded(f.state, width!, height!), size = dimensions(width!, height!);
                const plain = value.rows.map(row => row.map(span => span.text).join(''));
                for (const panel of [size.content, size.preview]) {
                    assert.ok(plain[panel.y]!.startsWith('┌─'));
                    assert.ok(plain[panel.y]!.endsWith('─┐'));
                    assert.equal(plain[panel.y + panel.height - 1], '└' + '─'.repeat(width! - 2) + '┘');
                    for (let y = panel.innerY; y < panel.y + panel.height - 1; y++) {
                        assert.ok(plain[y]!.startsWith('│'));
                        assert.ok(plain[y]!.endsWith('│'));
                    }
                }
                const selected = value.rows.slice(size.content.innerY, size.content.y + size.content.height - 1).find(row => row.some(span => span.reverse));
                assert.ok(selected);
                assert.equal(selected.filter(span => span.reverse).reduce((n, span) => n + displayWidth(span.text), 0), size.content.innerWidth);
                if (page === 'settings' || page === 'layout')
                    assert.ok(plain.slice(size.content.innerY, size.preview.y).some(line => line.includes('───')));
            }
        }
    }
});
test('tests.ui.test_layout.DrawingTests.test_shortcut_keys_and_labels_have_independent_styles_on_every_page', async (t) => {
    const f = await fixture(t);
    for (const page of ['main', 'subagents', 'settings', 'layout'] as const) {
        f.e.page = page;
        const rows = bounded(f.state, 120, 30).rows;
        const action = rows[28]!;
        const save = page === 'main' || page === 'subagents' ? 'Enter/Ctrl+S' : 'Ctrl+S';
        assert.ok(action.some(s => s.text === save && s.bold && !s.reverse));
        assert.ok(action.some(s => s.text.includes('save') && !s.reverse));
    }
});
test('tests.ui.test_layout.DrawingTests.test_shortcut_groups_clip_at_cell_boundaries_without_partial_bindings', async (t) => {
    for (let width = 0; width < 50; width++) {
        const spans = shortcuts([['Ctrl+S', '保存'], ['Esc', '取消'], ['Ctrl+C', '中断']], width);
        const plain = spans.map(s => s.text).join('');
        assert.ok(displayWidth(plain) <= width);
        assert.ok(!plain || ['Ctrl+S 保存', 'Ctrl+S 保存 · Esc 取消', 'Ctrl+S 保存 · Esc 取消 · Ctrl+C 中断'].includes(plain));
    }
});
test('tests.ui.test_layout.DrawingTests.test_portable_file_action_keys_use_the_same_styles_as_footer_keys', async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    for (const key of ['preset-apply', 'import-file', 'export-file']) {
        f.e.setting = key;
        const output = bounded(f.state, 120, 30);
        const cell = output.rows.flat().find(s => s.text === 'Enter');
        assert.ok(cell?.bold);
    }
});
test('tests.ui.test_layout.DrawingTests.test_preview_uses_the_panel_width_and_retains_sample_styles', async (t) => {
    const f = await fixture(t);
    await f.session.preview(80, 24);
    const call = f.calls.filter(c => c.operation === 'preview').at(-1)!;
    assert.equal((call.payload as any).width, dimensions(80, 24).preview.innerWidth);
    const color = { kind: 'rgb' as const, value: '#123456' };
    f.state.preview = { sample: true, main: [[{ text: '中文  ', bold: true, foreground: color, background: null }]], subagents: [] };
    const output = bounded(f.state, 80, 24), row = output.rows[dimensions(80, 24).preview.innerY]!;
    assert.ok(row.some(s => s.foreground === color && s.bold && s.text === '中文  '));
    assert.ok(row.every(s => s.background === null));
});
test('tests.ui.test_layout.DrawingTests.test_long_cjk_values_clipping_empty_search_and_small_window', async (t) => {
    const f = await fixture(t, 'zh-CN');
    f.e.draft.display.instances[0]!.options.label = '超长'.repeat(80);
    for (const [w, h] of [[32, 12], [64, 18], [120, 30]])
        bounded(f.state, w!, h!);
    f.state.search('definitely-absent');
    const output = text(f.state, 64, 18);
    assert.ok(output.includes(tMessage('ui.drawing.no_matching_items', 'zh-CN')));
});
test('tests.ui.test_layout.DrawingTests.test_detail_input_and_invalid_legacy_number_show_contextual_controls', async (t) => {
    const f = await fixture(t);
    f.keys({ key: 'e', ctrl: true }, 'return');
    assert.ok(text(f.state).includes('Enter'));
    assert.ok(text(f.state).includes('restore'));
    f.keys('escape', { key: 'g', ctrl: true });
    f.e.page = 'settings';
    f.e.setting = 'padding';
    f.keys('9', '9');
    assert.ok(text(f.state).includes('32'));
    assert.ok(text(f.state).includes('Backspace'));
});
test('tests.ui.test_language.LanguageUiTests.test_all_pages_and_forms_draw_chinese_inside_cell_bounds', async (t) => {
    const f = await fixture(t, 'zh-CN');
    for (const page of ['main', 'subagents', 'settings', 'layout'] as const) {
        f.e.page = page;
        for (const [w, h] of [[64, 18], [64, 20], [80, 24], [120, 30], [80, 48]])
            bounded(f.state, w!, h!);
    }
    f.e.detail = { scope: 'main', id: f.e.selected.main };
    bounded(f.state, 64, 18);
    assert.ok(text(f.state).includes('中文') || text(f.state).includes('格式'));
});
test('tests.ui.test_guidance.GuidanceTests.test_all_explanations_wrap_inside_terminal_cells', async (t) => {
    const f = await fixture(t);
    for (const language of LANGUAGES)
        for (const item of f.e.description.catalog)
            for (const width of [2, 20, 60])
                for (const line of guidanceLines(item, language, width))
                    assert.ok(displayWidth(line) <= width);
    for (const line of wrapText(['👩🏽‍💻中文 é '.repeat(10)], 4))
        assert.ok(displayWidth(line) <= 4);
});
test('tests.ui.test_guidance.GuidanceTests.test_all_items_have_scoped_translated_guidance_without_process_calls', async (t) => {
    const f = await fixture(t);
    const count = f.calls.length;
    for (const language of LANGUAGES)
        for (const item of f.e.description.catalog) {
            const lines = guidanceLines(item, language, 10000).join(' ');
            assert.ok(lines.includes(item.id));
            assert.ok(lines.includes(tMessage('guidance.static', language)));
            assert.ok(!lines.includes('undefined'));
        }
    assert.equal(f.calls.length, count);
});
test('tests.ui.test_guidance.GuidanceTests.test_requirements_distinguish_collectors_and_metric_scopes', async (t) => {
    const f = await fixture(t);
    const guide = (scope: string, id: string) => f.e.description.catalog.find(i => i.scope === scope && i.id === id)!.guidance;
    assert.ok(guide('main', 'task-active-timer').requirements.includes('native_timing'));
    assert.ok(!guide('main', 'task-active-timer').requirements.includes('live_metrics'));
    assert.ok(guide('main', 'ttft').requirements.includes('live_metrics'));
    assert.ok(guide('main', 'branch-diff').requirements.includes('git_base'));
    assert.equal(guide('main', 'tokens').measurement_scope, 'all_sessions');
    assert.equal(guide('subagent', 'tokens').measurement_scope, 'subagent_context');
});
test('tests.ui.test_guidance.GuidanceTests.test_guidance_scroll_cancel_and_resize_preserve_draft_and_selection', async (t) => {
    const f = await fixture(t);
    const before = structuredClone(f.e.draft), selected = f.e.selected.main;
    f.keys({ key: 'e', ctrl: true });
    f.e.setting = 'item-guidance';
    f.keys('return', 'end');
    bounded(f.state, 64, 18);
    assert.ok(f.e.guidanceScroll! >= 0);
    bounded(f.state, 120, 30);
    f.keys('escape');
    assert.equal(f.e.guidanceScroll, null);
    assert.deepEqual(f.e.draft, before);
    assert.equal(f.e.selected.main, selected);
});
test('tests.ui.test_search.SearchTests.test_category_and_highlight_draw_within_small_and_resized_terminals', async (t) => {
    const f = await fixture(t);
    f.state.search('git');
    for (const [w, h] of [[64, 18], [80, 24], [120, 30]]) {
        const output = bounded(f.state, w!, h!);
        assert.ok(output.rows.slice(5, dimensions(w!, h!).preview.y).flat().some(s => s.bold && /git/i.test(s.text)));
    }
    f.keys({ key: 'f', ctrl: true });
    for (const [w, h] of [[32, 12], [64, 18], [120, 30]])
        bounded(f.state, w!, h!);
});
test('tests.ui.test_search.SearchTests.test_alternate_language_highlights_only_the_actual_source_characters', async (t) => {
    const f = await fixture(t, 'zh-CN');
    f.state.search('model with effort');
    const output = bounded(f.state, 120, 30);
    const spans = output.rows.slice(5, dimensions(120, 30).preview.y).flat().filter(s => s.bold);
    assert.ok(spans.some(s => /model/i.test(s.text)));
    assert.ok(!spans.some(s => /[模型]/u.test(s.text)));
});
test('tests.ui.test_theme.ThemeTests.test_preview_caption_follows_palette_draft_and_color_disable', async (t) => {
    const f = await fixture(t);
    f.e.draft.display.palette = 'ansi';
    assert.ok(text(f.state).includes('Palette: ansi'));
    f.e.draft.display.use_colors = false;
    assert.ok(text(f.state).includes('Colors: off'));
});
test('tests.ui.test_theme.ThemeTests.test_basic_and_monochrome_capabilities', async (t) => {
    assert.equal(colorCapacity({ TERM: 'dumb' }), 0);
    assert.equal(colorCapacity({ NO_COLOR: '' }), 0);
    assert.equal(colorCapacity({ TERM: 'linux' }), 8);
    assert.equal(colorCapacity({ TERM: 'xterm' }), 16);
    assert.equal(colorCapacity({ TERM: 'xterm-256color' }), 256);
});
test('tests.ui.test_theme.ThemeTests.test_chrome_is_default_color_on_all_pages_and_selected_actions', async (t) => {
    const f = await fixture(t);
    for (const page of ['main', 'subagents', 'settings', 'layout'] as const) {
        f.e.page = page;
        const value = bounded(f.state, 80, 24);
        assert.ok(value.rows.flat().every(s => s.background === null && (s.foreground === null || s.bold && s.foreground.kind === 'ansi' && s.foreground.value === 6)));
        assert.ok(value.rows[0]!.some(s => s.bold && s.foreground?.value === 6));
        assert.ok(value.rows.flat().some(s => s.reverse));
        assert.ok(ansiFrame(value).includes('38;5;6m'));
        assert.ok(!ansiFrame(value, 0).includes('38;'));
    }
});
test('tests.ui.test_theme.ThemeTests.test_preview_uses_terminal_defaults_without_reserved_background_pairs', async (t) => {
    const f = await fixture(t);
    f.state.preview = { sample: true, main: [[{ text: 'low contrast', bold: false, foreground: { kind: 'ansi', value: 15 }, background: null }]], subagents: [] };
    const output = ansiFrame(bounded(f.state, 80, 24), 256);
    assert.ok(output.includes('38;5;15m'));
    assert.ok(!output.includes('48;'));
});
test('tests.ui.test_theme.ThemeTests.test_preview_preserves_quantized_rgb_and_ansi_sample_foregrounds', async (t) => {
    const f = await fixture(t);
    f.state.preview = { sample: true, main: [[{ text: 'red', bold: false, foreground: { kind: 'rgb', value: '#ff0000' }, background: null }, { text: 'blue', bold: true, foreground: { kind: 'ansi', value: 12 }, background: null }]], subagents: [] };
    for (const colors of [0, 8, 16, 256]) {
        const output = ansiFrame(bounded(f.state, 80, 24), colors);
        assert.ok(output.includes('red'));
        assert.ok(output.includes('blue'));
        if (!colors)
            assert.ok(!/\x1b\[(?:38|48|3[0-7]|4[0-7]|9[0-7])(?:;|m)/u.test(output));
    }
    assert.equal(terminalColor(['rgb', '#ff0000'], 256), 9);
});
test('tests.ui.test_theme.ThemeTests.test_preview_fills_empty_rows_trailing_spaces_resets_and_overflow', async (t) => {
    const f = await fixture(t);
    const p = dimensions(80, 24).preview;
    f.state.preview = { sample: true, main: Array.from({ length: 10 }, () => [{ text: 'A  ', bold: true, foreground: { kind: 'ansi', value: 2 }, background: null }]), subagents: [] };
    let output = bounded(f.state, 80, 24);
    assert.ok(output.rows[p.innerY]!.some(s => s.text === 'A  '));
    assert.ok(output.rows[p.innerY + p.innerHeight - 1]!.some(s => s.text.includes('more line')));
    f.state.preview.main = [];
    output = bounded(f.state, 80, 24);
    assert.ok(output.rows[p.innerY + 1]!.every(s => s.foreground === null && s.background === null));
    assert.ok(ansiFrame(output).endsWith('\x1b[0m'));
});
test('tests.ui.test_terminal.TerminalTests.test_plain_text_never_becomes_terminal_control_instructions', async (t) => {
    const f = await fixture(t);
    f.state.notice('untrusted \x1b[2J \x00 text');
    const output = ansiFrame(bounded(f.state, 80, 24));
    assert.ok(!output.includes('untrusted \x1b'));
    assert.ok(!output.includes('\0'));
    assert.ok(output.includes('untrusted'));
});
test('tests.ui.test_terminal.TerminalTests.test_text_input_accepts_joiners_and_removes_complete_clusters', async (t) => {
    const f = await fixture(t);
    f.keys({ key: 'e', ctrl: true }, 'return', { key: 'u', ctrl: true });
    for (const c of '👩🏽‍💻é')
        f.keys(c);
    assert.equal((f.state.input as any).buffer, '👩🏽‍💻é');
    f.keys('backspace');
    assert.equal((f.state.input as any).buffer, '👩🏽‍💻');
    f.keys('backspace');
    assert.equal((f.state.input as any).buffer, '');
});
test('tests.ui.test_terminal.TerminalTests.test_color_pairs_preserve_both_channels_and_selective_defaults', async (t) => {
    const sample = { columns: 10, rows: [[{ text: 'x', bold: false, foreground: { kind: 'ansi' as const, value: 1 }, background: { kind: 'ansi' as const, value: 4 } }, { text: 'y', bold: false, foreground: null, background: null }]] };
    const output = ansiFrame(sample, 256);
    assert.ok(output.includes('38;5;1m'));
    assert.ok(output.includes('48;5;4m'));
    assert.ok(output.includes('\x1b[0my'));
});
test('tests.ui.test_terminal.TerminalTests.test_background_mapping_for_monochrome_basic_bright_and_256_color', async (t) => {
    for (const count of [0, 8, 16, 256]) {
        const output = ansiFrame({ columns: 1, rows: [[{ text: 'x', bold: false, foreground: null, background: { kind: 'ansi', value: 12 } }]] }, count);
        assert.ok(count === 0 ? !/\x1b\[4[08]/u.test(output) : count === 8 ? output.includes('44m') : count === 16 ? output.includes('104m') : output.includes('48;5;12m'));
    }
});
test('tests.ui.test_terminal.TerminalTests.test_span_merging_retains_background_boundaries_and_resets', async (t) => {
    const output = ansiFrame({ columns: 2, rows: [[{ text: 'x', bold: true, foreground: null, background: { kind: 'ansi', value: 1 } }, { text: 'y', bold: false, foreground: null, background: { kind: 'ansi', value: 2 } }]] });
    assert.ok(output.includes('48;5;1mx\x1b[0m\x1b[48;5;2my'));
    assert.ok(output.endsWith('\x1b[0m'));
});
