import test from 'node:test';
import { fixture, assert, fs, join, bounded, frame, repoRoot } from './support.js';
import { Capture, cellColors, contrast, verifyColors, TERMINAL_THEMES, XTERM_PALETTE } from '../capture.js';
import { ansiFrame } from '@fbincon/statusline-tui/drawing';
import { colorCapacity } from '@fbincon/statusline-tui/session';
import { dimensions } from '@fbincon/statusline-tui/layout';
import { KeyDecoder } from '@fbincon/statusline-platform/terminal/input';
test('native incremental redraws retain reused cells across horizontal absolute positioning', () => {
    const screen = new Capture(24, 4);
    screen.feed('Loading…\x1b[2;1HLoading…');
    screen.feed('\x1b[1;1HRe\x1b[4Gd-only\x1b[2;1HSess\x1b[6Gon:');
    assert.equal(screen.buffer[0]!.map(c=>c.data).join('').trimEnd(),'Read-only');
    assert.equal(screen.buffer[1]!.map(c=>c.data).join('').trimEnd(),'Session:');
    screen.feed('\x1b[GX');
    assert.equal(screen.buffer[1]![0]!.data,'X');
});
test('tests.integration.test_terminal_capture.CaptureTests.test_every_byte_chunking_preserves_clusters_and_base_style', async (t) => {
    const value = Buffer.from('\x1b[31;44m👩\x1b[1m🏽‍💻\x1b[49mX');
    for (const step of [1, 2, 3, value.length]) {
        const screen = new Capture(20, 4);
        for (let i = 0; i < value.length; i += step)
            screen.feed(value.subarray(i, i + step));
        assert.deepEqual(screen.buffer[0]![0], { data: '👩🏽‍💻', fg: 'red', bg: 'blue', bold: false, reverse: false });
        assert.equal(screen.buffer[0]![2]!.data, 'X');
        assert.equal(screen.buffer[0]![2]!.bold, true);
        assert.equal(screen.buffer[0]![2]!.bg, 'default');
        assert.equal(screen.cursor.x, 3);
    }
});
test('tests.integration.test_terminal_capture.CaptureTests.test_clear_and_cursor_moves_do_not_rejoin_old_capture_text', async (t) => {
    const screen = new Capture(20, 4);
    screen.feed('👩\x1b[2J\x1b[H🏽X');
    assert.equal(screen.buffer[0]![0]!.data, '🏽');
    assert.equal(screen.buffer[0]![2]!.data, 'X');
    screen.feed('\x1b[2;1H1️⃣🇨🇳a‍b');
    assert.deepEqual([0, 2, 4, 5].map(x => screen.buffer[1]![x]!.data), ['1️⃣', '🇨🇳', 'a‍', 'b']);
    assert.equal(screen.cursor.x, 6);
});
test('tests.integration.test_terminal_colors.TerminalColorTests.test_external_default_color_chrome_is_readable_in_both_fixtures', async (t) => {
    const f = await fixture(t);
    const screen = new Capture(64, 18);
    screen.feed(ansiFrame(bounded(f.state, 64, 18)));
    for (const [fg, bg] of Object.values(TERMINAL_THEMES))
        assert.doesNotThrow(() => verifyColors(screen.buffer, 64, 18, fg, bg));
});
test('tests.integration.test_terminal_colors.TerminalColorTests.test_external_capture_rejects_fixed_white_chrome_and_artificial_preview_background', async (t) => {
    const f = await fixture(t);
    const screen = new Capture(64, 18);
    screen.feed(ansiFrame(bounded(f.state, 64, 18)));
    screen.buffer[0]![0]!.fg = 'brightwhite';
    assert.throws(() => verifyColors(screen.buffer, 64, 18, ...TERMINAL_THEMES.light), /Fixed chrome/);
    screen.buffer[0]![0]!.fg = 'default';
    screen.buffer[dimensions(64, 18).preview.innerY]![1]!.bg = '1c1c1c';
    assert.throws(() => verifyColors(screen.buffer, 64, 18, ...TERMINAL_THEMES.light), /Artificial preview/);
});
test('tests.integration.test_terminal_colors.TerminalColorTests.test_preview_preserves_low_contrast_samples_instead_of_changing_their_colors', async (t) => {
    const f = await fixture(t);
    f.state.preview = { sample: true, main: [[{ text: 'P', foreground: { kind: 'ansi', value: 15 }, background: null, bold: false }]], subagents: [] };
    const screen = new Capture(64, 18);
    screen.feed(ansiFrame(bounded(f.state, 64, 18)));
    const p = dimensions(64, 18).preview;
    assert.equal(screen.buffer[p.innerY]![p.innerX]!.fg, 'brightwhite');
    assert.ok(verifyColors(screen.buffer, 64, 18, ...TERMINAL_THEMES.light) > 0);
});
test('tests.integration.test_terminal_colors.TerminalColorTests.test_capture_rejects_unreadable_defaults_and_resolves_recorded_ansi_palette', async (t) => {
    const f = await fixture(t);
    const screen = new Capture(64, 18);
    screen.feed(ansiFrame(bounded(f.state, 64, 18)));
    assert.throws(() => verifyColors(screen.buffer, 64, 18, '#ffffff', '#ffffff'), /Unreadable/);
    assert.deepEqual(cellColors({ fg: 'white', bg: 'black', reverse: true }, undefined, undefined, XTERM_PALETTE), ['#000000', '#c0c0c0']);
    assert.deepEqual(cellColors({ fg: 'white', bg: 'black', reverse: true }, undefined, undefined, { white: 'ffffff', black: '17191e' }), ['#17191e', '#ffffff']);
});
test('tests.integration.test_terminal_colors.TerminalColorTests.test_default_roles_are_distinct_and_reverse_after_resolution', async (t) => {
    assert.deepEqual(cellColors({ fg: 'default', bg: 'default', reverse: false }), ['#dedee7', '#17191e']);
    assert.deepEqual(cellColors({ fg: 'default', bg: 'default', reverse: true }), ['#17191e', '#dedee7']);
});
test('tests.integration.test_terminal_colors.TerminalColorTests.test_explicit_light_and_sample_cells_keep_their_original_colors', async (t) => {
    assert.deepEqual(cellColors({ fg: '000000', bg: 'ffffff', reverse: false }), ['#000000', '#ffffff']);
    assert.equal(contrast('#000000', '#ffffff'), 21);
    assert.deepEqual(cellColors({ fg: '8ed3d3', bg: '17191e', reverse: false }), ['#8ed3d3', '#17191e']);
    assert.ok(contrast('#8ed3d3', '#17191e') > 4.5);
});
test('tests.integration.test_terminal_colors.TerminalColorTests.test_white_on_light_is_rejected_but_ansi_names_remain_renderable', async (t) => {
    assert.ok(contrast('#ffffff', '#eeeeee') < 1.2);
    assert.deepEqual(cellColors({ fg: 'white', bg: '17191e', reverse: false }), ['#dedee7', '#17191e']);
});
test('tests.ui.test_terminal.TerminalTests.test_vt_paints_complete_runs_in_order_after_blank_backing_refresh', async (t) => {
    const f = await fixture(t);
    const screen = new Capture(80, 24);
    screen.feed('old text');
    screen.feed(ansiFrame(bounded(f.state, 80, 24)));
    assert.ok(screen.buffer[0]!.map(c => c.data).join('').startsWith('Configure Status Line'));
    assert.ok(!screen.buffer.flat().some(c => c.data === 'old text'));
    assert.equal(screen.buffer[5]![0]!.data, '│');
});
test('tests.ui.test_terminal.TerminalTests.test_resize_clips_pending_runs_again_and_restores_style', async (t) => {
    const f = await fixture(t);
    f.state.preview = { sample: true, main: [[{ text: '中文'.repeat(80), bold: true, foreground: { kind: 'ansi', value: 1 }, background: null }]], subagents: [] };
    for (const [width, height] of [[120, 30], [64, 18]]) {
        const screen = new Capture(width!, height!);
        screen.feed(ansiFrame(bounded(f.state, width!, height!)));
        const footer = screen.buffer[height! - 1]!;
        assert.ok(footer.every(c => c.fg === 'default' && c.bg === 'default'));
        assert.equal(screen.buffer.length, height);
    }
});
test('tests.ui.test_theme.ThemeTests.test_compatibility_exports_share_the_new_implementation', async (t) => {
    const source = fs.readFileSync(join(repoRoot, 'mods/statusline-native/lib/editor/draft.ts'), 'utf8');
    assert.ok(source.startsWith('// Generated by tools/generation/resources.ts'));
    const f = await fixture(t);
    assert.equal(f.e.constructor.name, 'Editor');
    assert.equal(f.e.baseline.draft.display.schema_version, 10);
});
test('tests.ui.test_theme.ThemeTests.test_default_color_failure_preserves_default_text_instead_of_painting_black', async (t) => {
    const screen = new Capture(10, 2);
    screen.feed(ansiFrame({ columns: 10, rows: [[{ text: 'default', bold: false, foreground: null, background: null }]] }, 0));
    assert.ok(screen.buffer[0]!.every(c => c.fg === 'default' && c.bg === 'default'));
    assert.ok(screen.buffer[0]!.map(c => c.data).join('').startsWith('default'));
});
test('tests.ui.test_theme.ThemeTests.test_failed_sample_pair_is_cached_and_falls_back_to_default_text', async (t) => {
    const value = { columns: 10, rows: [[{ text: 'sample', bold: false, foreground: { kind: 'ansi' as const, value: 200 }, background: null }]] };
    const first = ansiFrame(value, 0);
    for (let i = 0; i < 10; i++)
        assert.equal(ansiFrame(value, 0), first);
    const screen = new Capture(10, 2);
    screen.feed(first);
    assert.equal(screen.buffer[0]![0]!.fg, 'default');
    assert.ok(!first.includes('38;'));
});
test('tests.ui.test_theme.ThemeTests.test_pair_exhaustion_falls_back_to_default_text', async (t) => {
    const value = { columns: 500, rows: [Array.from({ length: 500 }, (_, i) => ({ text: 'x', bold: false, foreground: { kind: 'rgb' as const, value: '#' + i.toString(16).padStart(6, '0') }, background: null }))] };
    const output = ansiFrame(value, 256);
    for (const code of output.matchAll(/38;5;(\d+)m/gu))
        assert.ok(Number(code[1]) < 256);
    assert.ok(!ansiFrame(value, 0).includes('38;'));
});
test('tests.ui.test_theme.ThemeTests.test_start_color_failure_is_monochrome', async (t) => {
    const f = await fixture(t);
    await f.session.preview(80, 24);
    const screen = new Capture(80, 24);
    screen.feed(ansiFrame(bounded(f.state, 80, 24), colorCapacity({ NO_COLOR: '' })));
    assert.ok(screen.buffer.flat().every(c => c.fg === 'default' && c.bg === 'default'));
});
test('tests.ui.test_theme.ThemeTests.test_color_pair_attributes_never_exceed_python_pair_limit', async (t) => {
    const f = await fixture(t);
    const huge = frame(f.state, 10000, 10000);
    assert.equal(huge.columns, 500);
    assert.equal(huge.rows.length, 200);
    assert.ok(ansiFrame(huge).length < 2 * 1024 * 1024);
});
test('tests.ui.test_terminal.TerminalTests.test_unsupported_backend_replaces_a_whole_cluster_at_the_same_width', async (t) => {
    const screen = new Capture(20, 2);
    const raw = ansiFrame({ columns: 20, rows: [[{ text: '👩🏽‍💻中文 é', bold: false, foreground: null, background: null }]] }, 0);
    screen.feed(raw);
    assert.equal(screen.buffer[0]![0]!.data, '👩🏽‍💻');
    assert.equal(screen.buffer[0]![2]!.data, '中');
    assert.equal(screen.buffer[0]![4]!.data, '文');
    assert.equal(screen.buffer[0]![7]!.data, 'é');
});
test('terminal decoder preserves every UTF-8 and escape chunk boundary and treats paste as text', () => {
    const raw = Buffer.from('中文 é 👩🏽‍💻\x1b[A\x1b[Z\x13');
    const expected = [...'中文 é 👩🏽‍💻'].map(key => ({ key }));
    for (const step of [1, 2, 3, raw.length]) {
        const decoder = new KeyDecoder();
        const keys = [];
        for (let i = 0; i < raw.length; i += step)
            keys.push(...decoder.push(raw.subarray(i, i + step)));
        assert.deepEqual(keys, [...expected, { key: 'up' }, { key: 'tab', shift: true }, { key: 's', ctrl: true }]);
    }
    const decoder = new KeyDecoder();
    assert.deepEqual(decoder.push('\x1b'), []);
    assert.deepEqual(decoder.flushEscape(), [{ key: 'escape' }]);
    assert.deepEqual(decoder.push('\x1b[200~hello\x13\x1b[201~'), [{ key: 'hello\x13', paste: true }]);
});
