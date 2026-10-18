import test from 'node:test';
import assert from 'node:assert/strict';
import { displayWidth, graphemes } from '@fbincon/statusline-core/unicode/index';
import { LANGUAGES, t } from '@fbincon/statusline-core/i18n/messages';
import { createReview } from '@fbincon/statusline-core/editor/import-review';
import { frame, ansiFrame, shortcuts } from '../src/drawing.js';
import { column } from '../src/drawing/canvas.js';
import { fieldLabel, fieldValue } from '../src/drawing/presentation.js';
import { dimensions } from '../src/layout.js';
import { paint } from '../src/theme.js';
import type { State } from '../src/state.js';
import { fixture, plain } from './fixtures.js';

const sizes = [[32, 12], [64, 18], [64, 19], [64, 20], [80, 24], [120, 30], [80, 48]] as const;
const pages = ['main', 'subagents', 'settings', 'layout'] as const;

test('all six languages retain bounded frames, complete separators and full-row selections', () => {
    for (const language of LANGUAGES) {
        for (const [columns, rows] of sizes) {
            for (const page of pages) {
                const state = fixture(language);
                state.editor.page = page;
                const value = frame(state, columns, rows);
                assert.equal(value.rows.length, rows);
                assert.ok(value.rows.every(row => displayWidth(row.map(span => span.text).join('')) === columns));
                if (columns < 64) continue;
                const size = dimensions(columns, rows);
                const selection = value.rows.slice(size.content.innerY, size.preview.y)
                    .find(row => row.some(span => span.reverse));
                assert.ok(selection);
                assert.equal(selection.filter(span => span.reverse).reduce((n, span) => n + displayWidth(span.text), 0), size.content.innerWidth);
                if (page === 'settings' || page === 'layout') {
                    const group = value.rows.flat().find(span => span.text.startsWith('─ ') && span.text.endsWith('─'));
                    assert.ok(group);
                    assert.equal(displayWidth(group.text), size.content.innerWidth);
                    assert.equal(group.bold, true);
                    assert.deepEqual(group.foreground, { kind: 'ansi', value: 6 });
                }
            }
        }
    }
});

test('overlays and editing states remain bounded at every supported size and color depth', () => {
    const states: ((state: State) => void)[] = [
        state => state.key({ key: 'a', ctrl: true }),
        state => state.key({ key: 'f', ctrl: true }),
        state => { state.key({ key: 'a', ctrl: true }); state.search('git'); },
        state => state.search('zzzz-no-match'),
        state => state.key({ key: '/' }),
        state => state.key({ key: 'e', ctrl: true }),
        state => { state.key({ key: 'e', ctrl: true }); state.key({ key: 'return' }); },
        state => { state.key({ key: 'e', ctrl: true }); state.editor.guidanceScroll = 0; },
        state => { state.editor.page = 'settings'; state.editor.setting = 'padding'; state.key({ key: '9' }); },
        state => { state.editor.page = 'settings'; state.editor.setting = 'import-file'; state.key({ key: 'return' }); },
        state => state.notice('中文 👩🏽‍💻 é warning'),
        state => {
            state.editor.review = createReview({ draft: state.editor.draft, changes: [{
                section: 'host', kind: 'change', scope: null, item_id: null, path: ['host', 'padding'],
                label: { key: 'settings.padding', params: {}, fallback: 'Padding' }, before: 0, after: 1,
            }] });
        },
    ];
    for (const language of LANGUAGES) {
        for (const configure of states) {
            const state = fixture(language);
            configure(state);
            for (const [columns, rows] of sizes) {
                const value = frame(state, columns, rows);
                assert.ok(value.rows.every(row => displayWidth(row.map(span => span.text).join('')) === columns));
                for (const colors of [0, 8, 16, 256]) {
                    const output = ansiFrame(value, colors);
                    assert.ok(output.endsWith('\x1b[0m'));
                    if (colors === 0) assert.ok(!/\x1b\[(?:38|48);[0-9;]*m/u.test(output));
                }
            }
        }
    }
});

test('one ellipsis and atomic graphemes survive long names, captions and fields', () => {
    for (const value of ['long '.repeat(20), '中文'.repeat(20), '👩🏽‍💻é'.repeat(20)]) {
        for (const width of [1, 2, 3, 18, 44]) {
            const shown = column(value, width);
            assert.equal(displayWidth(shown), width);
            assert.equal([...shown].filter(character => character === '…').length, 1);
            for (const cluster of graphemes(shown.trimEnd().replace(/…$/u, ''))) {
                assert.ok(graphemes(value).includes(cluster));
            }
        }
    }
    const state = fixture('zh-CN');
    state.editor.page = 'settings';
    assert.ok(!plain(state).join('\n').includes('……'));
});

test('external fields localize inheritance while literal user values remain exact', () => {
    for (const language of LANGUAGES) {
        const state = fixture(language);
        state.key({ key: 'e', ctrl: true });
        for (const key of ['label', 'icon', 'foreground', 'background']) {
            const row = state.rows().find(row => row.key === 'item:' + key)!;
            assert.equal(fieldValue(row, state), t('values.inherit', language));
        }
        const node = state.editor.instance('main', state.editor.selected.main)!;
        for (const literal of ['inherit', 'on', 'off', '中文 👩🏽‍💻 é']) {
            node.options.label = literal;
            assert.equal(fieldValue(state.rows().find(row => row.key === 'item:label')!, state), literal);
        }
        state.editor.detail = null;
        state.editor.page = 'settings';
        const base = state.rows().find(row => row.key === 'field:metrics.branch_diff_base_ref')!;
        assert.equal(fieldValue(base, state), t('values.inherit', language));
        for (const key of ['colors', 'directory-style', 'separator-style', 'refresh_interval', 'vim-indicator']) {
            assert.equal(fieldLabel(state.rows().find(row => row.key === key)!, state), t('settings.' + key, language));
        }
    }
});

test('actions contain one bold Enter and item format identifies its scope and return key', () => {
    for (const language of LANGUAGES) {
        const state = fixture(language);
        for (const scope of ['main', 'subagent'] as const) {
            state.editor.page = scope === 'main' ? 'main' : 'subagents';
            state.key({ key: 'e', ctrl: true });
            const output = plain(state);
            const guidance = output.find(row => row.includes(t('settings.item-guidance', language)))!;
            assert.equal(guidance.match(/Enter/gu)?.length, 1);
            assert.ok(output[4]!.includes(t(scope === 'main' ? 'ui.drawing.main_items' : 'ui.drawing.subagent_items', language)));
            assert.ok(output.at(-1)!.includes('Ctrl+G'));
            state.key({ key: 'g', ctrl: true });
        }
        state.editor.page = 'settings';
        for (const key of ['preset-apply', 'import-file', 'export-file']) {
            state.editor.setting = key;
            const value = frame(state, 120, 30);
            const row = value.rows.find(row => row.some(span => span.reverse && span.text.includes(t('settings.' + key, language))))!;
            assert.equal(row.map(span => span.text).join('').match(/Enter/gu)?.length, 1);
            assert.ok(row.some(span => span.text === 'Enter' && span.bold && span.reverse));
        }
    }
});

test('search highlights labels and descriptions, and identifies alternate-field snippets', () => {
    const state = fixture();
    state.key({ key: 'a', ctrl: true });
    state.search('git');
    const value = frame(state, 120, 30);
    assert.ok(value.rows.some(row => row.filter(span => span.bold && /git/iu.test(span.text)).length >= 2));
    assert.ok(plain(state).some(row => row.includes('Match: ')));
    const chinese = fixture('zh-CN');
    chinese.key({ key: 'a', ctrl: true });
    chinese.search('model with effort');
    const translated = frame(chinese, 120, 30);
    assert.ok(plain(chinese).some(row => row.includes('匹配：')));
    assert.ok(translated.rows.flat().some(span => span.bold && /model/iu.test(span.text)));
    assert.ok(!translated.rows.flat().some(span => span.bold && /模型/u.test(span.text)));
});

test('footers follow actual category, numeric, filtered and add actions', () => {
    const state = fixture('zh-CN');
    assert.ok(plain(state, 80, 24).at(-2)!.includes('Enter/Ctrl+S'));
    assert.ok(plain(state, 80, 24).at(-1)!.includes('Ctrl+A/D/X'));
    state.search('git');
    assert.ok(!plain(state).at(-1)!.includes('←→'));
    state.key({ key: 'f', ctrl: true });
    assert.ok(plain(state)[3]!.includes(t('catalog.search.choose_category', 'zh-CN')));
    assert.ok(plain(state).at(-1)!.includes('Home/End'));
    assert.ok(!plain(state).at(-1)!.includes('Ctrl+U'));
    state.key({ key: 'escape' });
    state.key({ key: 'a', ctrl: true });
    assert.ok(plain(state).at(-2)!.includes(t('composition.add', 'zh-CN')));
    state.key({ key: 'escape' });
    state.editor.page = 'settings';
    state.editor.setting = 'padding';
    state.key({ key: '9' });
    assert.ok(plain(state).join('\n').includes('[9_]'));
    assert.ok(plain(state).at(-1)!.includes('Digits'));
    assert.ok(!plain(state).at(-1)!.includes('Ctrl+U'));
    state.key({ key: 'backspace' });
    assert.ok(plain(state).join('\n').includes('[_]'));
    state.key({ key: 'escape' });
    assert.equal(state.editor.draft.host.padding, 0);
});

test('pending configuration input marks modifications without marking open or path dialogs', () => {
    const state = fixture();
    state.key({ key: 'e', ctrl: true });
    state.key({ key: 'return' });
    assert.equal(state.modified, false);
    state.key({ key: 'x' });
    assert.equal(state.modified, true);
    assert.ok(plain(state)[0]!.includes('*'));
    state.key({ key: 'backspace' });
    assert.equal(state.modified, false);
    state.key({ key: 'x' });
    state.key({ key: 'escape' });
    assert.equal(state.modified, false);
    state.key({ key: 'g', ctrl: true });
    state.editor.page = 'settings';
    state.editor.setting = 'import-file';
    state.key({ key: 'return' });
    state.key({ key: 'x' });
    assert.equal(state.modified, false);
});

test('small terminals retain title, current dimensions and complete exit bindings', () => {
    for (const language of LANGUAGES) {
        const output = plain(fixture(language), 32, 12);
        assert.ok(output[0]!.includes(t('ui.drawing.configure_status_line', language)));
        assert.ok(output.join('').includes('32x12'));
        assert.ok(output.join('').includes('64x18'));
        assert.ok(output.at(-1)!.includes('Esc'));
    }
});

test('preview overflow pluralizes and 8-color bright foregrounds retain intensity', () => {
    const state = fixture();
    state.preview!.main = Array.from({ length: 8 }, () => [paint('sample')]);
    assert.ok(plain(state, 64, 18).some(row => row.includes('7 more lines')));
    const value = { columns: 1, rows: [[{ ...paint('x'), foreground: { kind: 'ansi' as const, value: 12 } }]] };
    assert.ok(ansiFrame(value, 8).includes('\x1b[1m\x1b[34mx'));
    assert.ok(!ansiFrame(value, 0).includes('\x1b[34m'));
    const hints = shortcuts([['Ctrl+A/D/X', 'long action label', 'add/copy/rm'], ['Tab', 'page']], 28);
    assert.equal(hints.map(span => span.text).join(''), 'Ctrl+A/D/X add/copy/rm');
});

test('notices and inline keys retain bold while review headings preserve full-row selection', () => {
    const state = fixture();
    state.notice('Example warning');
    assert.ok(frame(state, 80, 24).rows[3]!.some(span => span.text.includes('Example warning') && span.bold));
    state.notice('');
    state.key({ key: 'e', ctrl: true });
    assert.ok(frame(state, 80, 24).rows[3]!.some(span => span.text === 'Ctrl+G' && span.bold));
    state.editor.review = createReview({ draft: state.editor.draft, changes: [{
        section: 'host', kind: 'change', scope: null, item_id: null, path: ['host', 'padding'],
        label: { key: 'settings.padding', params: {}, fallback: 'Padding' }, before: 0, after: 1,
    }] });
    const selected = frame(state, 80, 24).rows[5]!;
    assert.ok(selected.some(span => span.reverse && span.bold && span.foreground?.value === 6));
    assert.equal(selected.filter(span => span.reverse).reduce((n, span) => n + displayWidth(span.text), 0), 76);
});
