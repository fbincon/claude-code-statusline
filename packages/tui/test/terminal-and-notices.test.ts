import test from 'node:test';
import assert from 'node:assert/strict';
import { text } from '@fbincon/statusline-core/i18n/messages';
import { colorCapacity } from '../src/session.js';
import { ansiFrame, frame } from '../src/drawing.js';
import { fixture, plain } from './fixtures.js';

test('monochrome TERM and NO_COLOR override truecolor hints without emitting explicit colors', () => {
    const value = frame(fixture(), 80, 24);
    for (const TERM of ['vt100', 'vt220', 'xterm-mono', 'dumb']) {
        for (const COLORTERM of [undefined, 'truecolor', '24bit']) {
            const capacity = colorCapacity({ TERM, COLORTERM });
            assert.equal(capacity, 0, `${TERM}/${COLORTERM}`);
            const ansi = ansiFrame(value, capacity);
            assert.ok(!/\x1b\[(?:3[0-9]|4[0-9]|9[0-7]|10[0-7])(?:;|m)/u.test(ansi));
            assert.ok(ansi.includes('\x1b[0m'));
        }
    }
    for (const NO_COLOR of ['', '1']) assert.equal(colorCapacity({ TERM: 'xterm-256color', COLORTERM: 'truecolor', NO_COLOR }), 0);
    for (const [TERM, capacity] of [['linux', 8], ['xterm', 16], ['xterm-256color', 256], ['xterm-direct', 256]] as const)
        assert.equal(colorCapacity({ TERM }), capacity);
    assert.equal(colorCapacity({ TERM: 'xterm', COLORTERM: '24bit' }), 256);
});

test('accepted form adjustments clear the previous validation message and localized copy', () => {
    const state = fixture(), e = state.editor;
    e.page = 'settings';
    e.setting = 'field:formatting.thresholds.warning';
    e.draft.display.formatting.thresholds.warning = 89;
    state.key({ key: 'right' });
    assert.equal(e.draft.display.formatting.thresholds.warning, 89);
    assert.ok(state.message);
    assert.ok(state.localized.message);
    assert.ok(plain(state).join('\n').includes('Invalid value'));
    state.key({ key: 'left' });
    assert.equal(e.draft.display.formatting.thresholds.warning, 88);
    assert.equal(state.message, '');
    assert.equal(state.localized.message, undefined);
    state.language = 'zh-CN';
    assert.equal(frame(state, 80, 24).rows[3]!.some(span => span.text.includes('Invalid value')), false);
    assert.equal(state.localized.message, undefined);
});

test('redraw and non-adjustable fields do not dismiss backend or review notices', () => {
    const state = fixture();
    state.editor.page = 'settings';
    state.editor.setting = 'field:metrics.branch_diff_base_ref';
    const message = text('review.cancelled');
    state.notice(message);
    frame(state, 80, 24);
    state.key({ key: 'right' });
    assert.equal(state.localized.message, message);
    assert.equal(state.message, message.fallback);
    state.editor.setting = 'field:formatting.icons';
    state.key({ key: 'right' });
    assert.equal(state.localized.message, message, 'An unrelated successful edit dismissed a backend/review notice');
});
