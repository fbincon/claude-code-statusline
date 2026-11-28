import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExplainInstance } from '@fbincon/statusline-core/contracts/ui';
import { LANGUAGES, t } from '@fbincon/statusline-core/i18n/messages';
import { displayWidth, graphemes } from '@fbincon/statusline-core/unicode/index';
import { ansiFrame, frame } from '../src/drawing.js';
import { dimensions } from '../src/layout.js';
import type { State } from '../src/state.js';
import { fixture, plain } from './fixtures.js';

function openItemPage(state: State, action: 'item-explain' | 'item-guidance') {
    state.key({ key: 'e', ctrl: true }, 64, 18);
    state.key({ key: 'home' }, 64, 18);
    if (action === 'item-guidance') state.key({ key: 'down' }, 64, 18);
    assert.equal(state.selectedRow().key, action);
    assert.equal(state.key({ key: 'return' }, 64, 18), action === 'item-explain' ? 'explain' : null);
}

function supplyExplanation(state: State, instances: ExplainInstance[]) {
    const { explanation, previewScenario } = state.editor;
    assert.ok(explanation);
    const preview = { ...state.preview!, scenario: previewScenario };
    explanation.result = { sample: true, scope: explanation.scope, width: 62, actual_availability: 'not_observed', preview, instances };
    state.preview = preview;
}

test('every picker type opens read-only guidance without requiring an instance', () => {
    for (const scope of ['main', 'subagent'] as const) {
        const state = fixture(), e = state.editor;
        e.page = scope === 'main' ? 'main' : 'subagents';
        const before = JSON.stringify(e.draft), preview = state.preview;
        state.key({ key: 'a', ctrl: true });
        for (const item of e.catalog(scope)) {
            e.selectItem(scope, item.id);
            state.key({ key: 'e', ctrl: true });
            assert.doesNotThrow(() => frame(state, 80, 24), `${scope}/${item.id}`);
            assert.deepEqual(state.rows().map(row => row.key), ['item-guidance']);
            assert.equal(e.detailItem?.id, item.id);
            assert.ok(plain(state).join('\n').includes(t('guidance.overview', 'en')));
            state.key({ key: 'escape' });
            assert.equal(e.detail, null);
            assert.equal(e.adding, true);
        }
        state.key({ key: 'escape' });
        assert.equal(e.adding, false);
        assert.equal(JSON.stringify(e.draft), before);
        assert.equal(state.preview, preview);
    }
});

test('picker guidance resolves catalog identity even when another instance uses that ID', () => {
    for (const language of LANGUAGES) {
        for (const scope of ['main', 'subagent'] as const) {
            const state = fixture(language), e = state.editor;
            e.page = scope === 'main' ? 'main' : 'subagents';
            const target = scope === 'main' ? 'task-active-timer' : 'status';
            const list = scope === 'main' ? e.draft.display.instances : e.draft.display.subagents.instances;
            const other = list.find(item => item.type_id !== target)!;
            other.id = target;
            const before = JSON.stringify(e.draft);
            state.key({ key: 'a', ctrl: true });
            e.selectItem(scope, target);
            state.key({ key: 'e', ctrl: true });
            for (const [columns, rows] of [[32, 12], [64, 18], [64, 19], [64, 20], [80, 24], [120, 30], [80, 48]] as const) {
                const output = plain(state, columns, rows);
                if (columns >= 64) {
                    assert.ok(output[1]!.includes(t(`items.${scope}.${target}.label`, language)));
                    assert.equal(e.detailItem?.id, target);
                    assert.ok(output.join('\n').includes(t('guidance.overview', language)));
                }
            }
            state.key({ key: 'escape' });
            assert.equal(JSON.stringify(e.draft), before);
        }
    }
});

test('item explanation puts a plain reference example under a bold heading and keeps the selected instance outcome', () => {
    for (const language of ['en', 'zh-CN'] as const) {
        for (const scope of ['main', 'subagent'] as const) {
            const state = fixture(language), e = state.editor;
            e.page = scope === 'main' ? 'main' : 'subagents';
            const original = e.selected[scope];
            state.key({ key: 'd', ctrl: true });
            const id = e.selected[scope], item = e.definition(scope, id)!;
            assert.notEqual(id, original);
            assert.equal(e.history.undo.length, 1);
            const before = structuredClone([e.draft, e.history]);
            openItemPage(state, 'item-explain');
            assert.deepEqual(e.detail, { scope, id });
            assert.equal(e.explanation?.id, id);
            const row_id = scope === 'main' ? 'main' : 'preview-running';
            supplyExplanation(state, [
                { id: original, type_id: item.id, enabled: true, reasons: [],
                    samples: [{ row_id, outcome: 'sample_priority_omitted', truncated: false }] },
                { id, type_id: item.id, enabled: true, reasons: [{ code: 'configured_on', origin: 'configuration' }],
                    samples: [{ row_id, outcome: 'sample_visible', truncated: true }] },
            ]);

            const narrow = frame(state, 64, 18);
            const { content, preview } = dimensions(64, 18);
            const body = narrow.rows.slice(content.innerY, content.innerY + content.innerHeight - 1).flat();
            const exampleTitle = t('explain.examples', language);
            const heading = body.find(span => span.text.includes(exampleTitle));
            assert.ok(heading?.bold, language);
            assert.deepEqual(heading.foreground, { kind: 'ansi', value: 6 });
            const example = body.find(span => span.text.includes(item.examples[0]!));
            assert.equal(example?.bold, false);
            assert.ok(ansiFrame(narrow, 0).includes('\x1b[0m\x1b[1m' + heading.text));
            assert.ok(narrow.rows[preview.innerY]!.some(span => span.text.includes(scope === 'main' ? '中文' : '代理')));

            const detail = plain(state, 120, 48).join('\n');
            const order = [exampleTitle, item.examples[0]!, t('explain.configuration', language),
                t('explain.sample_result', language, { scenario: t('preview.scenario.normal', language), width: 62 }),
                t('explain.reason.sample_visible', language), t('explain.reason.sample_truncated', language)];
            const positions = order.map(value => detail.indexOf(value));
            assert.ok(positions.every((position, index) => position > (positions[index - 1] ?? -1)), detail);
            assert.ok(!detail.includes(t('explain.reason.sample_priority_omitted', language)));

            state.key({ key: 't', ctrl: true });
            state.key({ key: 'g', ctrl: true });
            assert.equal(e.explanation, null);
            assert.equal(state.selectedRow().key, 'item-explain');
            assert.equal(e.changeReview, null);
            assert.deepEqual([e.draft, e.history], before);
        }
    }
});

for (const action of ['item-guidance', 'item-explain'] as const) {
    test(`${action} scrolls to a real endpoint and returns to the same format action after resize`, () => {
        const state = fixture(), e = state.editor;
        if (action === 'item-guidance') assert.ok(e.instanceAction('main', 'add', 'task-active-timer'));
        else {
            e.page = 'subagents';
            e.previewScenario = 'many-agents';
        }
        const before = structuredClone([e.draft, e.history]);
        openItemPage(state, action);
        const detail = e.detail;
        if (action === 'item-explain') {
            const id = e.selected.subagent;
            supplyExplanation(state, [{ id, type_id: e.definition('subagent', id)!.id, enabled: true,
                reasons: [{ code: 'configured_on', origin: 'configuration' }],
                samples: Array.from({ length: 24 }, (_, index) => ({
                    row_id: `preview-agent-${index}`, outcome: 'sample_visible', truncated: false,
                })),
            }]);
        }

        const page = (columns: number, rows: number) => {
            const { content } = dimensions(columns, rows);
            const output = plain(state, columns, rows);
            const match = /(\d+)–(\d+)\/(\d+)/u.exec(output[content.innerY + content.innerHeight - 1]!);
            assert.ok(match);
            return { start: Number(match[1]) - 1, end: Number(match[2]), total: Number(match[3]), output };
        };
        const key = (value: string, columns = 64, rows = 18) => state.key({ key: value }, columns, rows);
        const first = page(64, 18);
        assert.equal(first.start, 0);
        assert.equal(first.end, dimensions(64, 18).content.innerHeight - 1);
        assert.ok(first.total > first.end * 2);
        key('pagedown');
        assert.equal(page(64, 18).start, first.end);
        key('pageup');
        assert.equal(page(64, 18).start, 0);
        key('end');
        key('up');
        assert.equal(page(64, 18).end, first.total - 1);
        key('down');
        const last = page(64, 18);
        assert.equal(last.end, first.total);
        if (action === 'item-explain') {
            const output = last.output.join('\n');
            assert.ok(output.includes(t('explain.row.preview-agent', 'en', { number: 24 })));
            assert.ok(!output.includes('explain.row.'));
        }
        const scroll = () => e.explanation?.scroll ?? e.guidanceScroll;
        assert.equal(scroll(), last.start);
        const wider = page(80, 24);
        assert.equal(scroll(), last.start);
        key('up', 80, 24);
        assert.equal(page(80, 24).start, Math.max(0, wider.start - 1));
        const widerStart = scroll();
        key('pagedown', 32, 12);
        assert.equal(scroll(), widerStart);
        if (e.explanation) {
            e.explanation.error = 'Explanation unavailable after resize';
            const shortened = page(80, 24);
            assert.ok(shortened.total < wider.total);
            assert.ok(shortened.output.join('\n').includes(e.explanation.error));
            assert.equal(scroll(), widerStart);
        }
        key('home');
        assert.equal(page(64, 18).start, 0);
        key('escape');
        assert.equal(e.explanation, null);
        assert.equal(e.guidanceScroll, null);
        assert.equal(e.detail, detail);
        assert.equal(state.selectedRow().key, action);
        state.key({ key: 'g', ctrl: true }, 64, 18);
        assert.equal(e.detail, null);
        assert.deepEqual([e.draft, e.history], before);
    });
}

test('source guidance keeps condition headings and literal commands visually distinct', () => {
    const state = fixture('zh-CN');
    assert.ok(state.editor.instanceAction('main', 'add', 'task-active-timer'));
    openItemPage(state, 'item-guidance');
    const { content } = dimensions(80, 48);
    const body = frame(state, 80, 48).rows.slice(content.innerY, content.innerY + content.innerHeight - 1).flat();
    const sections = ['overview', 'requirements', 'reasons', 'details', 'setup'].map(key =>
        body.findIndex(span => span.bold && span.text.includes(t(`guidance.${key}`, 'zh-CN'))));
    assert.ok(sections.every((position, index) => position > (sections[index - 1] ?? -1)));
    for (const text of ['native_task_timing', 'Claude Code 2.1.289+', 'claude-statusline install --native-timing', 'claude-statusline doctor']) {
        assert.equal(body.find(span => span.text.includes(text))?.bold, false, text);
    }
});

test('long reference examples wrap at terminal cells without splitting graphemes', () => {
    const state = fixture('zh-CN'), e = state.editor;
    const id = e.selected.main, index = e.description.catalog.findIndex(item => item.scope === 'main' && item.id === id);
    const example = '样👩🏽‍💻e\u0301'.repeat(72);
    e.description.catalog[index] = { ...e.description.catalog[index]!, examples: [example] };
    openItemPage(state, 'item-explain');
    supplyExplanation(state, [{ id, type_id: id, enabled: true, reasons: [], samples: [] }]);
    const { content } = dimensions(64, 48);
    const fragments = plain(state, 64, 48).slice(content.innerY, content.innerY + content.innerHeight - 1)
        .map(line => line.replace(/^│\s*|\s*│$/gu, '')).filter(line => /^[样👩🏽‍💻e\u0301]+$/u.test(line));
    assert.ok(fragments.length > 1);
    assert.equal(fragments.join(''), example);
    for (const fragment of fragments) {
        assert.ok(displayWidth(fragment) <= content.innerWidth - 2);
        assert.ok(graphemes(fragment).every(cluster => ['样', '👩🏽‍💻', 'e\u0301'].includes(cluster)));
    }
});

test('new text instances edit their body first and preserve raw Unicode', () => {
    const content = '中文 日本語 한글 e\u0301 👩🏽‍💻';
    for (const scope of ['main', 'subagent'] as const) {
        const state = fixture(), e = state.editor;
        e.page = scope === 'main' ? 'main' : 'subagents';
        state.key({ key: 'a', ctrl: true });
        e.selectItem(scope, 'text');
        state.key({ key: 'return' });
        state.key({ key: 'g', ctrl: true });
        const id = e.selected[scope];
        state.key({ key: 'e', ctrl: true });
        assert.equal(e.setting, 'item:text');
        state.key({ key: 'return' });
        state.key({ key: 'u', ctrl: true });
        for (const key of content) state.key({ key });
        assert.equal(e.instance(scope, id)!.text, '');
        assert.equal(state.modified, true);
        assert.ok(plain(state).some(line => line.includes(content)));
        state.key({ key: 'return' });
        assert.equal(e.instance(scope, id)!.text, content);
        assert.equal(e.instance(scope, id)!.options.label, null);
        state.key({ key: 'g', ctrl: true });
        state.key({ key: 'e', ctrl: true });
        assert.equal(e.setting, 'item:text');
        assert.equal(state.selectedRow().value, content);
    }
});

test('metric instances continue to start at the label field', () => {
    for (const scope of ['main', 'subagent'] as const) {
        const state = fixture();
        state.editor.page = scope === 'main' ? 'main' : 'subagents';
        state.key({ key: 'e', ctrl: true });
        assert.equal(state.editor.setting, 'item:label');
    }
});
