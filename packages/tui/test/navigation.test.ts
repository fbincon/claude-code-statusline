import test from 'node:test';
import assert from 'node:assert/strict';
import { frame } from '../src/drawing.js';
import { fixture } from './fixtures.js';

test('Settings and Layout retain independent selection and scroll across round trips', () => {
    const state = fixture(), e = state.editor;
    e.page = 'settings';
    state.key({ key: 'home' });
    for (let i = 0; i < 20; i++) state.key({ key: 'down' });
    assert.equal(e.setting, 'field:formatting.labels');
    const settingsScroll = state.scroll.settings;
    assert.equal(settingsScroll, 15);
    state.key({ key: 'tab' });
    state.key({ key: 'end' });
    const layoutField = e.setting, layoutScroll = state.scroll.layout;
    state.key({ key: 'tab', shift: true });
    assert.equal(e.setting, 'field:formatting.labels');
    assert.equal(state.scroll.settings, settingsScroll);
    state.key({ key: 'tab' });
    assert.equal(e.setting, layoutField);
    assert.equal(state.scroll.layout, layoutScroll);
    // Traversing a transient detail must not replace either page's field.
    state.key({ key: 'tab' });
    state.key({ key: 'e', ctrl: true });
    state.key({ key: 'end' });
    assert.ok(state.scroll.detail! > 0);
    state.key({ key: 'g', ctrl: true });
    state.key({ key: 'e', ctrl: true });
    frame(state, 80, 24);
    assert.equal(e.setting, 'item:label');
    assert.equal(state.scroll.detail, 0);
    state.key({ key: 'g', ctrl: true });
    state.key({ key: 'tab' });
    state.key({ key: 'tab' });
    assert.equal(e.setting, 'field:formatting.labels');
    state.key({ key: 'tab' });
    assert.equal(e.setting, layoutField);
});

test('resizing preserves focus and pending input; removed layout fields safely fall back', () => {
    const state = fixture(), e = state.editor;
    e.page = 'settings';
    e.setting = 'field:metrics.branch_diff_base_ref';
    state.key({ key: 'return' });
    state.key({ key: 'x' });
    const input = structuredClone(state.input);
    for (const [columns, rows] of [[32, 12], [64, 18], [80, 48], [80, 24]] as const) frame(state, columns, rows);
    assert.equal(e.setting, 'field:metrics.branch_diff_base_ref');
    assert.deepEqual(state.input, input);
    state.key({ key: 'escape' });
    state.key({ key: 'tab' });
    state.key({ key: 'end' });
    assert.ok(e.setting.startsWith('fit:'));
    state.key({ key: 'tab', shift: true });
    const replacement = structuredClone(e.draft);
    replacement.display.instances = [];
    replacement.display.layout = { mode: 'auto', rows: [] };
    e.replaceDraft(replacement);
    state.key({ key: 'tab' });
    assert.equal(e.setting, 'layout-mode');
    assert.equal(state.scroll.layout, 0);
});

test('Settings page-down accounts for appearance controls and group headings', () => {
    for (const [columns, rows, target] of [[64, 18, 'field:theme'], [80, 24, 'field:powerline.separator'], [120, 30, 'field:statusline_language']] as const) {
        const state = fixture();
        state.editor.page = 'settings';
        state.key({ key: 'home' }, columns, rows);
        state.key({ key: 'pagedown' }, columns, rows);
        assert.equal(state.editor.setting, target);
        state.key({ key: 'pageup' }, columns, rows);
        assert.equal(state.editor.setting, 'colors');
    }
});

test('form paging counts fields in Layout and item details while list paging counts items', () => {
    const state = fixture(), e = state.editor;
    e.page = 'layout';
    state.key({ key: 'home' }, 64, 18);
    state.key({ key: 'pagedown' }, 64, 18);
    assert.equal(e.setting, state.rows()[4]!.key); // Two headings occupy this six-line window.
    state.key({ key: 'pageup' }, 64, 18);
    assert.equal(e.setting, 'layout-mode');
    e.page = 'main';
    state.key({ key: 'e', ctrl: true }, 64, 18);
    state.key({ key: 'home' }, 64, 18);
    state.key({ key: 'pagedown' }, 64, 18);
    assert.equal(e.setting, state.rows()[5]!.key); // One heading and five fields.
    state.key({ key: 'pageup' }, 64, 18);
    assert.equal(e.setting, 'item-explain');
    state.key({ key: 'g', ctrl: true }, 64, 18);
    state.key({ key: 'home' }, 64, 18);
    state.key({ key: 'pagedown' }, 64, 18);
    assert.equal(e.selected.main, e.visible('main')[6]!.id);
});
