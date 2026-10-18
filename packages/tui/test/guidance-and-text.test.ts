import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, t } from '@fbincon/statusline-core/i18n/messages';
import { guidanceLines } from '@fbincon/statusline-core/editor/guidance';
import { frame } from '../src/drawing.js';
import { fixture, plain } from './fixtures.js';

test('every picker type opens read-only guidance without requiring an instance', () => {
    for (const scope of ['main', 'subagent'] as const) {
        const state = fixture(), e = state.editor;
        e.page = scope === 'main' ? 'main' : 'subagents';
        const before = JSON.stringify(e.draft), preview = state.preview;
        state.key({ key: 'a', ctrl: true });
        for (const item of e.catalog(scope)) {
            e.selected[scope] = item.id;
            state.key({ key: 'e', ctrl: true });
            assert.doesNotThrow(() => frame(state, 80, 24), `${scope}/${item.id}`);
            assert.deepEqual(state.rows().map(row => row.key), ['item-guidance']);
            assert.ok(plain(state).join('\n').includes(guidanceLines(item, 'en', 116)[0]!));
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
            e.selected[scope] = target;
            state.key({ key: 'e', ctrl: true });
            for (const [columns, rows] of [[32, 12], [64, 18], [64, 19], [64, 20], [80, 24], [120, 30], [80, 48]] as const) {
                const output = plain(state, columns, rows);
                if (columns >= 64) {
                    assert.ok(output[1]!.includes(t(`items.${scope}.${target}.label`, language)));
                    const item = e.catalog(scope).find(item => item.id === target)!;
                    assert.ok(output.join('\n').includes(guidanceLines(item, language, columns - (rows >= 20 ? 4 : 2))[0]!));
                }
            }
            state.key({ key: 'escape' });
            assert.equal(JSON.stringify(e.draft), before);
        }
    }
});

test('new text instances edit their body first and preserve raw Unicode', () => {
    const content = '中文 日本語 한글 e\u0301 👩🏽‍💻';
    for (const scope of ['main', 'subagent'] as const) {
        const state = fixture(), e = state.editor;
        e.page = scope === 'main' ? 'main' : 'subagents';
        state.key({ key: 'a', ctrl: true });
        e.selected[scope] = 'text';
        state.key({ key: 'return' });
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
