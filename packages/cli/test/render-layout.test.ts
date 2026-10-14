import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as layout from '@fbincon/statusline-core/rendering/layout';
import * as styles from '@fbincon/statusline-core/rendering/styles';
import { rowSpans } from '@fbincon/statusline-core/rendering/spans';
import { DEFAULT_FORMATTING, DEFAULT_ITEM } from '@fbincon/statusline-core/config/defaults';
import { decorate } from '@fbincon/statusline-core/rendering/preferences';
import { truncateText } from '@fbincon/statusline-core/rendering/formatters';
import { DEFAULT } from '@fbincon/statusline-core/rendering/palette';
import { env, config } from './render-support.js';
import { CONFIG_FILENAME } from '@fbincon/statusline-core/config/display';
import { contentWidth } from '../src/rendering/main.js';
const fits = (rows: string[], width: number) => { for (const row of rows)
    assert.ok(layout.displayWidth(row) <= width, row); };
const segments = () => [{ text: DEFAULT.model + 'model' + DEFAULT.reset }, { text: DEFAULT.directory + '/repo' + DEFAULT.reset, prefer_slash_breaks: true }, { text: DEFAULT.branch + 'main' + DEFAULT.reset }];
test('tests.rendering.test_statusline_layout.DisplayWidthTests.test_ansi_unicode_and_combining_width', () => {
    const value = DEFAULT.model + 'A中文é' + DEFAULT.reset;
    assert.equal(layout.displayWidth(value), 6);
    assert.equal(layout.strip(value), 'A中文é');
});
test('tests.rendering.test_statusline_layout.DisplayWidthTests.test_terminal_columns_and_fallbacks', () => {
    assert.equal(contentWidth('42'), 40);
    assert.equal(contentWidth('1'), 2);
    for (const value of [undefined, '', 'nope', '0', '-5'])
        assert.equal(contentWidth(value), 118);
});
test('tests.rendering.test_statusline_layout.SegmentSplittingTests.test_colored_split_preserves_text_and_restarts_style', () => {
    const rows = layout.splitAnsiText(DEFAULT.directory + 'abcdefghij' + DEFAULT.reset, 4);
    assert.equal(rows.map(layout.strip).join(''), 'abcdefghij');
    assert.deepEqual(rows.map(layout.displayWidth), [4, 4, 2]);
    for (const row of rows) {
        assert.ok(row.startsWith(DEFAULT.directory));
        assert.ok(row.endsWith(DEFAULT.reset));
    }
});
test('tests.rendering.test_statusline_layout.SegmentSplittingTests.test_long_absolute_path_prefers_slashes_without_data_loss', () => {
    const path = '/home/fbincon/projects/a-very-long-directory/source/package', rows = layout.layoutSegments([{ text: DEFAULT.directory + path + DEFAULT.reset, prefer_slash_breaks: true }], 14);
    assert.ok(rows.length > 1);
    fits(rows, 14);
    assert.equal(rows.map(layout.strip).join(''), path);
});
test('tests.rendering.test_statusline_layout.SegmentSplittingTests.test_windows_drive_and_unc_paths_prefer_both_separator_styles', () => {
    for (const path of [String.raw `C:\Users\测试 用户\projects\very-long-component\src\package`, String.raw `\\server\share\团队 目录\very-long-component\src\package`, 'C:/Users/测试 用户/projects/very-long-component/src/package']) {
        const rows = layout.layoutSegments([{ text: DEFAULT.directory + path + DEFAULT.reset, prefer_slash_breaks: true }], 18);
        assert.ok(rows.length > 1);
        fits(rows, 18);
        assert.equal(rows.map(layout.strip).join(''), path);
        assert.ok(rows.slice(1).some(row => /^[/\\]/u.test(layout.strip(row))));
    }
});
test('tests.rendering.test_statusline_layout.SegmentSplittingTests.test_single_long_component_and_unicode_are_hard_split', () => {
    const value = '/' + '长目录'.repeat(5) + 'x'.repeat(17), rows = layout.layoutSegments([{ text: DEFAULT.directory + value + DEFAULT.reset, prefer_slash_breaks: true }], 8);
    fits(rows, 8);
    assert.equal(rows.map(layout.strip).join(''), value);
});
test('tests.rendering.test_statusline_layout.SegmentSplittingTests.test_other_oversized_fields_are_split_without_truncation', () => {
    const value = 'feature/' + 'x'.repeat(31), rows = layout.layoutSegments([{ text: DEFAULT.branch + value + DEFAULT.reset }], 9);
    fits(rows, 9);
    assert.equal(rows.map(layout.strip).join(''), value);
});
test('tests.rendering.test_statusline_layout.AdaptiveLayoutTests.test_wide_layout_preserves_single_line_contract', () => {
    assert.deepEqual(layout.layoutSegments(segments(), 80).map(layout.strip), ['model | /repo | main']);
});
test('tests.rendering.test_statusline_layout.AdaptiveLayoutTests.test_exact_fit_and_one_cell_over_wrap_at_segment_boundary', () => {
    assert.deepEqual(layout.layoutSegments([{ text: 'A' }, { text: 'BB' }], 6).map(layout.strip), ['A | BB']);
    assert.deepEqual(layout.layoutSegments([{ text: 'A' }, { text: 'BB' }], 5).map(layout.strip), ['A', 'BB']);
});
test('tests.rendering.test_statusline_layout.AdaptiveLayoutTests.test_narrow_layout_preserves_order_and_clean_separators', () => {
    const rows = layout.layoutSegments(segments(), 9);
    fits(rows, 9);
    assert.deepEqual(rows.map(layout.strip), ['model', '/repo', 'main']);
});
test('tests.rendering.test_statusline_layout.AdaptiveLayoutTests.test_no_hard_row_limit_or_field_loss', () => {
    const values = Array.from({ length: 12 }, (_, i) => 's' + String(i).padStart(2, '0'));
    assert.deepEqual(layout.layoutSegments(values.map(text => ({ text })), 3).map(layout.strip), values);
});
test('tests.rendering.test_statusline_layout.AdaptiveLayoutTests.test_tiny_width_makes_progress_and_keeps_all_content', () => {
    const rows = layout.layoutSegments([{ text: 'ab中cd' }], 2);
    fits(rows, 2);
    assert.equal(rows.map(layout.strip).join(''), 'ab中cd');
});
test('tests.rendering.test_styles.StyleTests.test_decorations_preserve_body_styles_and_isolate_prefix', () => {
    const value = decorate('\x1b[1;31;48;5;200m👩🏽‍💻\x1b[22;39mB', 'current-dir', 'main', DEFAULT_FORMATTING, { ...DEFAULT_ITEM, label: '目录', icon: 'D' }, env.language), units = layout.styledUnits(value);
    assert.equal(units.map(u => u.text).join(''), 'D 目录 👩🏽‍💻B');
    assert.ok(units.slice(0, -2).every(u => !u.style));
    assert.deepEqual(styles.parse(units.at(-2)!.style), { bold: true, foreground: ['ansi', 1], background: ['ansi', 200] });
    assert.deepEqual(styles.parse(units.at(-1)!.style), { bold: false, foreground: null, background: ['ansi', 200] });
    assert.deepEqual(styles.parse(value), styles.DEFAULT);
});
test('tests.rendering.test_styles.StyleTests.test_partial_changes_and_selective_resets', () => {
    const row = '\x1b[31;44mA\x1b[1mB\x1b[22mC\x1b[39mD\x1b[49mE\x1b[1;32mF\x1b[mG';
    assert.deepEqual(layout.styledUnits(row).map(u => styles.parse(u.style)), [
        { bold: false, foreground: ['ansi', 1], background: ['ansi', 4] }, { bold: true, foreground: ['ansi', 1], background: ['ansi', 4] }, { bold: false, foreground: ['ansi', 1], background: ['ansi', 4] },
        { bold: false, foreground: null, background: ['ansi', 4] }, styles.DEFAULT, { bold: true, foreground: ['ansi', 2], background: null }, styles.DEFAULT,
    ]);
    assert.deepEqual(rowSpans('\x1b[31mR\x1b[1mB').at(-1)!.foreground, { kind: 'ansi', value: 1 });
});
test('tests.rendering.test_styles.StyleTests.test_rgb_indexed_and_colon_notation', () => {
    for (const sequence of ['\x1b[38;2;0;128;255;48;5;200m', '\x1b[38:2::0:128:255;48:5:200m', '\x1b[38:2:0:0:128:255;48:5:200m']) {
        const state = styles.parse(sequence);
        assert.deepEqual(state, { bold: false, foreground: ['rgb', '#0080ff'], background: ['ansi', 200] });
        assert.deepEqual(styles.parse(styles.serialize(state)), state);
    }
    assert.deepEqual(styles.parse('\x1b[97;107m'), { bold: false, foreground: ['ansi', 15], background: ['ansi', 15] });
});
test('tests.rendering.test_styles.StyleTests.test_bad_color_groups_never_become_bold_reset_or_other_colors', () => {
    const initial: styles.Style = { bold: true, foreground: ['ansi', 3], background: ['ansi', 4] };
    for (const sequence of ['\x1b[38;2;999;0;0m', '\x1b[38;2;1m', '\x1b[48;5;256m', '\x1b[38;7;0;31m', '\x1b[38:2:1:0:0:0m', '\x1b[38:2::1:2m', '\x1b[3;4m'])
        assert.deepEqual(styles.advance(initial, sequence), initial);
});
test('tests.rendering.test_styles.StyleTests.test_row_wrap_restores_all_supported_state_and_resets_end', () => {
    for (const row of layout.splitAnsiText('\x1b[1;38;5;200;48;2;1;2;3mabcdef', 3)) {
        assert.ok(row.startsWith('\x1b[1;38;5;200;48;2;1;2;3m'));
        assert.ok(row.endsWith(styles.RESET));
    }
});
test('tests.rendering.test_graphemes.GraphemeTests.test_sgr_inside_a_cluster_uses_base_style_and_advances_later_state', () => {
    const value = '\x1b[31m👩\x1b[1;44m🏽‍💻X';
    assert.deepEqual(layout.styledUnits(value).map(u => [u.text, u.width, u.style]), [['👩🏽‍💻', 2, '\x1b[31m'], ['X', 1, '\x1b[1;31;44m']]);
    const rows = layout.splitAnsiText(value, 2);
    assert.deepEqual(rows.map(layout.strip), ['👩🏽‍💻', 'X']);
    assert.ok(rows.every(row => row.endsWith(styles.RESET)));
});
test('tests.rendering.test_graphemes.GraphemeTests.test_combining_mark_style_does_not_detach_it', () => {
    assert.deepEqual(layout.styledUnits('\x1b[31me\x1b[32ḿX').map(u => [u.text, u.style]), [['é', '\x1b[31m'], ['X', '\x1b[32m']]);
    assert.equal(layout.truncateStyled('👨‍👩‍👧‍👦X', 2), '…');
    assert.equal(truncateText('\x1b[31m👩🏽‍💻X', 2, ''), '\x1b[31m👩🏽‍💻\x1b[0m');
});
test('tests.rendering.test_graphemes.GraphemeTests.test_complete_layout_normalizes_cross_style_clusters_and_oversized_units', () => {
    const row = layout.layoutSegments([{ text: '\x1b[31me\x1b[32ḿX' }], 20)[0]!;
    assert.ok(row.includes('\x1b[31mé'));
    assert.ok(!row.includes('e\x1b'));
    const rows = layout.splitAnsiText('a🏽X', 2);
    fits(rows, 2);
    assert.equal(rows.map(layout.strip).join(''), '…X');
});
test('tests.rendering.test_graphemes.GraphemeTests.test_ascii_path_does_not_load_unicode_tables_or_reference_package', () => {
    const source = "import {displayWidth} from '@fbincon/statusline-core/unicode/index'; import {initializedTables} from '@fbincon/statusline-core/unicode/generated-unicode'; if(displayWidth('ASCII') !== 5 || initializedTables() !== 0) throw Error('eager Unicode tables');";
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});
function hotpath(command: string, payload: string, t: import('node:test').TestContext): string[] {
    const root = mkdtempSync(join(tmpdir(), 'ts03-imports-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    writeFileSync(join(root, CONFIG_FILENAME), JSON.stringify(config(['model'])));
    const main = new URL('../src/main.js', import.meta.url).href;
    const script = `import {registerHooks} from 'node:module'; const modules=[]; registerHooks({load(url,context,next){modules.push(url);return next(url,context);}}); const {main}=await import(${JSON.stringify(main)}); await main([${JSON.stringify(command)}],{stdin:()=>${JSON.stringify(payload)}}); process.stderr.write(JSON.stringify(modules));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: root } });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stderr);
}
test('tests.rendering.test_graphemes.GraphemeTests.test_model_only_render_does_not_initialize_unselected_collectors', t => {
    const modules = hotpath('render', '{"model":{"id":"ASCII"}}', t);
    assert.deepEqual(modules.filter(url => /koffi|cli\/dist\/src\/(?:runtime|config|integration)\/|i18n\/(?:generated-locales|messages)|i18n\/statusline\/(?!en\.)/u.test(url)), []);
});
test('tests.rendering.test_subagent_statusline.SubprocessTests.test_hot_path_does_not_import_heavy_or_stateful_modules', t => {
    const modules = hotpath('render-subagents', '{"tasks":[]}', t);
    assert.deepEqual(modules.filter(url => /koffi|cli\/dist\/src\/(?:runtime|config|integration)\/|i18n\/(?:generated-locales|messages)/u.test(url)), []);
});
