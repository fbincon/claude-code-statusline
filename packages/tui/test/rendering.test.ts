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

test('all interface languages retain bounded frames, complete separators and full-row selections', () => {
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

test('external tabs show Layout before Settings and highlight the active page', () => {
    for (const language of ['en', 'zh-CN'] as const) {
        const state = fixture(language);
        const order = ['main', 'subagents', 'layout', 'settings'] as const;
        for (const page of order) {
            const tabs = frame(state, 80, 24).rows[2]!;
            const label = (id: typeof order[number]) => t('ui.drawing.' + id, language);
            assert.equal(tabs.map(span => span.text).join('').trimEnd(), order.map(label).join('  '));
            assert.equal(tabs.filter(span => span.reverse).map(span => span.text).join(''), label(page));
            state.key({ key: 'tab' });
        }
    }
});

test('external selected components show their catalog examples across scopes and copies', () => {
    const { content, listHeight } = dimensions(120, 30);
    for (const language of ['en', 'zh-CN'] as const) {
        for (const scope of ['main', 'subagent'] as const) {
            const state = fixture(language), e = state.editor;
            e.page = scope === 'main' ? 'main' : 'subagents';
            const selected = e.visible(scope).find(item => item.id === e.selected[scope])!;
            const detail = t(`items.${scope}.${selected.id}.description`, language);
            const expected = t('ui.drawing.item_example', language, { examples: selected.examples.join(' · ') });
            const example = () => plain(state)[content.innerY + listHeight + 1]!.trim().replace(/^│\s*|\s*│$/gu, '');
            assert.ok(plain(state).slice(content.innerY + 1, content.innerY + 1 + listHeight).some(row => row.includes(detail)));
            assert.equal(example(), expected);
            state.key({ key: 'd', ctrl: true });
            assert.notEqual(e.selected[scope], selected.id);
            assert.equal(example(), expected);
            state.key({ key: 'a', ctrl: true });
            assert.equal(e.listContext(scope).selected, selected.id);
            assert.equal(example(), expected);
            state.search('not-a-real-component-xyz');
            assert.ok(plain(state).some(row => row.includes(t('ui.drawing.no_matching_items', language))));
            assert.equal(example(), '');
        }
    }
});

test('all locales fit the complete example on one row at the minimum external width', () => {
    for (const language of LANGUAGES) {
        const state = fixture(language), e = state.editor;
        state.key({ key: 'a', ctrl: true });
        const selected = e.catalog('main').find(item => item.id === 'session-cost-rate')!;
        e.selectItem('main', selected.id);
        const expected = t('ui.drawing.item_example', language, { examples: selected.examples.join(' · ') });
        for (const [columns, rows] of [[64, 18], [64, 20]] as const) {
            const { content, listHeight } = dimensions(columns, rows);
            assert.equal(listHeight + 3, content.innerHeight, language);
            const value = plain(state, columns, rows);
            assert.ok(value.every(row => displayWidth(row) === columns));
            assert.ok(value[content.innerY + listHeight + 1]!.includes(expected), language);
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
        state => { state.key({ key: 'e', ctrl: true }); state.key({ key: 'home' }); state.key({ key: 'return' }); },
        state => { state.key({ key: 'e', ctrl: true }); state.key({ key: 'home' }); state.key({ key: 'down' }); state.key({ key: 'return' }); },
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
            assert.equal(fieldValue(row, state), t(key === 'label' || key === 'icon' ? 'item-decoration.use-preset' : 'values.inherit', language));
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

test('external item format pairs preset controls with independent custom input', () => {
    const state = fixture('zh-CN'), e = state.editor;
    state.key({ key: 'e', ctrl: true });
    const fields = state.rows().filter(row => /^item:(?:labels?|icons?)$/u.test(row.key));
    assert.deepEqual(fields.map(row => fieldLabel(row, state)), ['标签预设', '自定义标签', '图标预设', '自定义图标']);
    e.setting = 'item:labels';
    assert.ok(frame(state, 64, 18).rows.at(-1)!.some(span => span.bold && span.text === '←→/Enter'));
    state.key({ key: 'right' });
    state.key({ key: 'down' });
    assert.equal(e.setting, 'item:label');
    state.key({ key: 'return' });
    state.key({ key: 'u', ctrl: true });
    state.key({ key: 'Ctrl+G', paste: true });
    state.key({ key: 'return' });
    assert.ok(frame(state, 64, 18).rows.some(row => row.some(span => span.reverse && !span.bold && span.text.includes('Ctrl+G'))));
    state.key({ key: 'up' });
    assert.ok(plain(state, 64, 18)[3]!.includes('自定义值优先'));
    state.key({ key: 'down' });
    state.key({ key: 'return' });
    state.key({ key: 'u', ctrl: true });
    state.key({ key: 'return' });
    assert.ok(plain(state, 64, 18).some(row => row.includes('自定义标签') && row.includes(t('values.hidden', 'zh-CN'))));
    state.key({ key: 'return' });
    state.key({ key: 'inherit', paste: true });
    state.key({ key: 'return' });
    const { label, formatting } = e.instance('main', e.selected.main)!.options;
    assert.equal(label, null);
    assert.equal(formatting.labels, 'legacy');
    assert.ok(plain(state, 64, 18).some(row => row.includes('自定义标签') && row.includes('跟随预设')));
});

test('external shortcuts show a top toolbar, pinned details and a compact footer', () => {
    const state = fixture('zh-CN');
    state.editor.shortcuts.open();
    for (const [width, height] of [[32, 12], [64, 18], [79, 20], [80, 20], [120, 30]] as const) {
        const terminal = frame(state, width, height);
        const screen = terminal.rows.map(row => row.map(span => span.text).join(''));
        const title = screen.findIndex(row => row.includes('─') && row.includes(t('shortcuts.title', 'zh-CN')));
        const bottom = screen.findIndex(row => row.startsWith('└─'));
        const footer = screen.findIndex(row => row.includes('/ 筛选'));
        const suffix = width === 32 ? '-short' : '';
        assert.equal(title, 1);
        for (const key of ['save', 'restore-all', 'reload'])
            assert.ok(screen[title + 1]?.includes('[' + t('shortcuts.' + key + suffix, 'zh-CN') + ']'), key);
        const group = screen.findIndex(row => row.includes('─ 编辑器与草稿 ─'));
        assert.ok(group > title + 1 && group < footer);
        assert.ok(screen.slice(title + 2, group).some(row => row.includes('选项') && row.includes(width >= 80 ? '默认键' : '值')));
        assert.equal(screen.some(row => row.includes(t('ui.drawing.preview_sample_data', 'zh-CN'))), false);
        if (height >= 20) assert.equal(bottom, footer - 1);
        else assert.equal(bottom, -1);
        assert.ok(screen[(bottom < 0 ? footer : bottom) - 1]?.includes('内置 S [S]'));
        assert.ok(screen.slice(title + 1, group).some(row => row.includes('Tab 到操作区')));
        assert.ok(terminal.rows.slice(title + 1, group).flat().some(span => span.bold && span.text === 'Tab'));
        assert.ok(height - footer <= 2);
        if (width === 120) assert.equal(height - footer, 1);
        const help = terminal.rows.slice(footer).flat().filter(span => span.bold);
        for (const key of ['/', 'Enter', 'Delete', 'Ctrl+G']) assert.ok(help.some(span => span.text === key), key);
        assert.ok(help.every(span => !/筛选|改键|恢复|返回/u.test(span.text)));
        assert.ok(terminal.rows.every(row => displayWidth(row.map(span => span.text).join('')) === width));
    }
    state.key({ key: 'tab' }, 32, 12);
    state.key({ key: 'right' }, 32, 12);
    const toolbar = frame(state, 120, 30).rows[2]!;
    assert.ok(toolbar.some(span => span.reverse && span.text.trimStart() === '›[恢复全部预设]'));
    assert.ok(toolbar.some(span => !span.reverse && span.text.includes('[保存快捷键]')));
    assert.ok(plain(state, 120, 30)[2]?.includes('Tab 回列表'));
    state.key({ key: 'tab' }, 120, 30);
    state.key({ key: '/' }, 120, 30);
    state.key({ key: 'task-evidence', paste: true }, 120, 30);
    state.key({ key: 'return' }, 120, 30);
    const filtered = plain(state, 120, 30);
    assert.ok(filtered.some(row => row.includes('› 切换任务证据')));
    const bottom = filtered.findIndex(row => row.startsWith('└─'));
    assert.equal(bottom, 28);
    assert.ok(filtered[bottom - 1]?.includes('外部 E [E]'));
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
        for (const key of ['preset-apply', 'import-file', 'export-file', 'keyboard-shortcuts']) {
            state.editor.setting = key;
            const value = frame(state, 120, 30);
            const label = key === 'keyboard-shortcuts' ? t('shortcuts.title', language) : t('settings.' + key, language);
            const row = value.rows.find(row => row.some(span => span.reverse && span.text.includes(label)))!;
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
    assert.ok(plain(state, 80, 24).at(-2)!.includes('Ctrl+S ' + t('ui.hints.save_and_exit', 'zh-CN')));
    assert.ok(!plain(state, 80, 24).at(-2)!.includes('Enter'));
    assert.ok(plain(state).at(-1)!.includes('Ctrl+A/D/X'));
    state.search('git');
    assert.ok(!plain(state).at(-1)!.includes('←→'));
    state.key({ key: 'f', ctrl: true });
    assert.ok(plain(state)[3]!.includes(t('catalog.search.choose_category', 'zh-CN')));
    assert.ok(plain(state).at(-1)!.includes('Home/End'));
    assert.ok(!plain(state).at(-1)!.includes('Ctrl+U'));
    state.key({ key: 'escape' });
    state.key({ key: 'a', ctrl: true });
    assert.ok(plain(state).at(-2)!.includes('Enter/Space ' + t('ui.hints.add_enable', 'zh-CN')));
    assert.ok(plain(state).at(-2)!.includes('Ctrl+S ' + t('ui.hints.save_and_exit', 'zh-CN')));
    state.key({ key: 'escape' });
    state.editor.page = 'settings';
    state.editor.setting = 'padding';
    const beforeInput = plain(state);
    assert.ok(beforeInput.at(-2)!.includes('Ctrl+S ' + t('ui.hints.save_and_exit', 'zh-CN')));
    assert.ok(!beforeInput.at(-2)!.includes('Enter'));
    assert.ok(beforeInput.at(-1)!.includes('Enter ' + t('ui.hints.edit', 'zh-CN')));
    state.key({ key: '9' });
    const paddingRow = () => frame(state, 120, 30).rows.find(row => row.some(span => span.reverse && span.text.includes(t('settings.padding', 'zh-CN'))));
    assert(paddingRow()?.some((span, index, row) => !span.reverse && span.text === ' ' && row[index - 1]?.text.endsWith('9')));
    assert.ok(plain(state).at(-2)!.includes('Enter ' + t('ui.hints.accept', 'zh-CN')));
    assert.ok(!plain(state).at(-2)!.includes('Ctrl+S'));
    assert.ok(plain(state).at(-1)!.includes('Home/End'));
    assert.ok(plain(state).at(-1)!.includes('Ctrl+U'));
    state.key({ key: 'backspace' });
    assert(paddingRow()?.some(span => !span.reverse && span.text === ' '));
    state.key({ key: 'escape' });
    assert.equal(state.editor.draft.host.padding, 0);
});

test('Settings explains the selected action, including the effective refresh key at 64 columns', () => {
    for (const language of LANGUAGES) {
        const state = fixture(language), e = state.editor;
        e.page = 'settings';
        for (const [setting, action] of [['colors', 'toggle'], ['palette', 'adjust'], ['padding', 'edit']] as const) {
            e.setting = setting;
            assert.ok(plain(state, 64, 18).at(-1)!.includes('Enter ' + t('ui.hints.' + action, language)), language);
        }
        e.setting = 'refresh_interval';
        for (const key of ['E', 'Ctrl+Q']) {
            e.shortcuts.snapshot.bindings = key === 'E' ? {} : { 'event-refresh': key };
            const { rows } = frame(state, 64, 18);
            const help = rows.at(-1)!;
            assert.deepEqual(help.filter(span => span.bold).slice(0, 4).map(span => span.text), ['Tab', '↑↓', 'Enter', key], language);
            assert.ok(help.some(span => span.text.includes(t('values.event', language)) ||
                span.text.includes(t('shortcuts.action.event-refresh', language))), language);
        }
        state.key({ key: 'return' });
        const active = plain(state, 64, 18);
        assert.ok(active.at(-2)!.includes('Enter ' + t('ui.hints.accept', language)), language);
        assert.ok(!active.at(-2)!.includes('Ctrl+S'), language);
        assert.ok(!active.at(-1)!.includes('Ctrl+Q'), language);
        assert.ok(active.at(-1)!.includes('Ctrl+U'), language);
    }
});

test('navigation, switching, save and filtered list controls stay visible at 64 columns', () => {
    for (const language of LANGUAGES) {
        for (const page of ['main', 'subagents'] as const) {
            const state = fixture(language), e = state.editor;
            e.page = page;
            for (const category of e.categories(state.scope)) {
                e.chooseCategory(state.scope, category);
                for (const query of ['', 'model']) {
                    state.search(query);
                    const { rows } = frame(state, 64, 18);
                    const keys = (row: number) => rows[row]!.filter(span => span.bold).map(span => span.text);
                    const label = [language, page, category, query].join(' / ');
                    assert.deepEqual(keys(17).slice(0, 4), ['Tab', '↑↓', 'Enter/Space', '/'], label);
                    assert.deepEqual(keys(16).slice(0, 3), ['Ctrl+S', 'Esc', 'Ctrl+C'], label);
                    assert.ok(keys(3).includes('Ctrl+F'), label);
                    const clear = [...keys(3), ...keys(17)].filter(key => key === 'Ctrl+G');
                    assert.equal(clear.length, e.filtered(state.scope) ? 1 : 0, label);
                    if (category !== 'all') assert.ok(keys(3).includes('Ctrl+A'), label);
                }
            }
        }
    }
});

test('list hints show active remaps while the catalog retains its own activation', () => {
    const state = fixture(), e = state.editor;
    e.shortcuts.snapshot.bindings = { save: 'Z', close: 'M', 'toggle-item': 'T', search: '?', category: 'Ctrl+Q', 'add-item': 'O' };
    e.chooseCategory(state.scope, 'model');
    const output = plain(state, 64, 18);
    assert.match(output.at(-2)!, /^Z save and exit · M\/Esc close · Ctrl\+C interrupt/u);
    assert.match(output.at(-1)!, /^Tab page · ↑↓ select · T toggle · \? search/u);
    assert.match(output[3]!, /^Ctrl\+Q .*\bO catalog/u);
    assert.ok(!output.at(-1)!.includes('Enter/Space'));
    state.key({ key: 'o' });
    const catalog = plain(state, 80, 24);
    assert.match(catalog.at(-2)!, /^Enter\/Space add\/enable · Ctrl\+G\/Esc back · Z save and exit/u);
    assert.match(catalog.at(-1)!, /\? search · Ctrl\+Q category/u);
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
    state.key({ key: 'return' }, 64, 18);
    const path = '/tmp/目录 with spaces/'.repeat(4) + '输入 A.json';
    state.key({ key: 'u', ctrl: true }, 64, 18);
    state.key({ key: path, paste: true }, 64, 18);
    state.key({ key: 'left' }, 64, 18);
    const screen = frame(state, 64, 18);
    assert(screen.rows.some(row => row.some((span, index) =>
        !span.reverse && span.text === 'n' && row[index - 1]?.text.endsWith('输入 A.jso'))));
    assert.equal(state.modified, false);
    assert.equal(state.key({ key: 'return' }, 64, 18), 'transfer');
    assert.equal(state.editor.path, path);
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
