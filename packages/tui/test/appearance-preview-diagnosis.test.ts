import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, plain } from './fixtures.js';
import { LANGUAGES, t, text } from '@fbincon/statusline-core/i18n/messages';
import type { DiagnoseResult } from '@fbincon/statusline-core/contracts/ui';
import { BackendError } from '@fbincon/statusline-core/editor/backend';
import { openColors, colorsKey, colorDraft } from '@fbincon/statusline-core/editor/color-manager';
import { openDiagnosis, diagnosisKey, diagnosisRequest, receiveDiagnosis } from '@fbincon/statusline-core/editor/diagnosis-view';
import { THEME_IDS } from '@fbincon/statusline-core/editor/themes';
import { SetupState } from '@fbincon/statusline-core/editor/setup';
import { frame } from '../src/drawing.js';
import { dimensions } from '../src/layout.js';
import { Session, type Backend } from '../src/session.js';
import { paint } from '../src/theme.js';

const diagnosticReport = (source: string, lines: string[]): DiagnoseResult => ({
    sample: false, scope: 'main', width: 60, source, observed_at: null, diagnosed_at: '2026-11-01T10:00:00Z',
    session_id: null, prompt_id: null, host_version: null, include_local: false, instances: [],
    output: lines.map((line, index) => ({ id: String(index), spans: [paint(line)] })),
    host_fields: { worktree: { session_name: null, git_name: null, selected_source: null },
        cache_miss: { status: 'not_observed', causes: [], last_miss_at: null, tools_added: null, tools_removed: null, system_char_delta: null } },
});

test('diagnosis keeps the current field and grapheme caret visible on short terminals', () => {
    for (const language of ['en', 'zh-CN'] as const) {
        const s = fixture(language);
        s.key({ key: 'l', ctrl: true });
        s.key({ key: 'return' });
        const path = '目录/'.repeat(25) + '📁尾';
        s.key({ key: path, paste: true });
        for (const rows of [18, 19, 20, 24]) {
            const screen = frame(s, 64, rows);
            assert(screen.rows.some(row => row.some((span, index) => span.reverse && span.text === ' ' &&
                row[index - 1]?.text.endsWith('📁尾'))));
        }
        s.key({ key: 'left' });
        s.key({ key: 'left' });
        assert(frame(s, 64, 18).rows.some(row => row.some(span => span.reverse && span.text === '📁')));
        assert.equal(s.editor.diagnosis!.input?.value, path);
        s.key({ key: 'g', ctrl: true });
        s.key({ key: 'end' }, 64, 18);
        assert(plain(s, 64, 18).join('\n').includes('› ' + t('colors.cancel', language)));
        assert.equal(s.editor.diagnosis!.path, '');
    }
});

test('file diagnosis starts at the first output row and both panes scroll by their visible capacity', () => {
    const s = fixture();
    s.preview = { sample: true, main: [[paint('First sample row')], [paint('Second sample row')]], subagents: [] };
    s.key({ key: 'n', ctrl: true }, 64, 18);
    openDiagnosis(s.editor);
    receiveDiagnosis(s.editor.diagnosis!, diagnosticReport('test file', Array.from({ length: 40 }, (_, i) => 'report line ' + i)));
    assert(plain(s, 64, 18).some(row => row.includes('report line 0')));
    const window = (rows: number) => {
        const summary = plain(s, 80, rows).join('\n').match(/(\d+)–(\d+)\/(\d+)/u);
        assert(summary, 'missing page position');
        return summary.slice(1).map(Number);
    };
    s.key({ key: 'end' }, 80, 24);
    const [first, last, total] = window(24);
    assert.equal(last, total);
    s.key({ key: 'up' }, 80, 24);
    assert.deepEqual(window(24), [first! - 1, total! - 1, total]);
    const [resized] = window(18);
    s.key({ key: 'pageup' }, 80, 18);
    assert.equal(window(18)[0], Math.max(1, resized! - (dimensions(80, 18).content.innerHeight - 1)));
    s.key({ key: 'home' }, 80, 18);
    assert.equal(window(18)[0], 1);
    s.key({ key: 'tab' }, 64, 18);
    s.key({ key: 'end' }, 64, 18);
    assert(plain(s, 64, 18).some(row => row.includes('report line 39')));
    s.key({ key: 'up' }, 64, 18);
    assert(!plain(s, 64, 18).some(row => row.includes('report line 39')));
    s.key({ key: 'home' }, 64, 18);
    assert(plain(s, 64, 18).some(row => row.includes('report line 0')));
    assert.equal(s.editor.diagnosis!.scroll, 0);
    s.key({ key: 'g', ctrl: true }, 64, 18);
    s.key({ key: 'g', ctrl: true }, 64, 18);
    assert(plain(s, 64, 18).some(row => row.includes('Second sample row')));
});

test('file diagnosis isolates empty output and keeps the failed path available for correction', async () => {
    for (const language of ['en', 'zh-CN'] as const) {
        const state = fixture(language), editor = state.editor, before = JSON.stringify(editor.draft);
        state.preview = null;
        state.previewError = 'OLD TEST SAMPLE ERROR';
        const session = new Session(state, { request(operation: string, payload: { path: string }) {
            assert.equal(operation, 'diagnose_file');
            if (payload.path === '/missing.json') throw new BackendError('io_error', text('diagnose.error.file', { value: payload.path }));
            return diagnosticReport(payload.path, []);
        } } as Backend);
        const key = (key: string, ctrl = false, paste = false) => state.key({ key, ctrl, paste }, 64, 18);
        const screen = () => plain(state, 64, 18).join('\n');
        key('l', true);
        const pathAndRun = async (path: string) => {
            key('home'); key('return'); key('u', true); key(path, false, true); key('return');
            for (let row = 0; row < 4; row++) key('down');
            await session.key({ key: 'return' }, 64, 18);
        };
        await pathAndRun('/ok.json');
        assert(screen().includes(t('diagnosis.no_output', language)));
        assert(!screen().includes('OLD TEST SAMPLE ERROR'));
        key('g', true);
        await pathAndRun('/missing.json');
        assert(screen().includes(t('diagnose.error.file', language, { value: '/missing.json' })));
        assert.equal(editor.diagnosis!.path, '/missing.json');
        assert.equal(editor.diagnosis!.cursor, 0);
        assert.equal(editor.diagnosis!.result?.source, '/ok.json');
        assert.equal(editor.diagnosis!.report, false);
        assert.equal(JSON.stringify(editor.draft), before);
    }
});

test('sample preview positions follow scope and workflow, while empty states follow the current draft and scenario', () => {
    for (const language of ['en', 'zh-CN'] as const) {
        const state = fixture(language), editor = state.editor, before = JSON.stringify(editor.draft);
        const screen = () => plain(state, 64, 18).join('\n');
        state.preview = { sample: true, scenario: 'normal', main: [[paint('main A')], [paint('main B')]],
            subagents: [[paint('agent A')], [paint('agent B')]] };
        state.key({ key: 'n', ctrl: true }, 64, 18);
        assert(!screen().includes('main A') && screen().includes('main B'));
        state.key({ key: 'tab' }, 64, 18);
        assert(screen().includes('agent A'));
        state.key({ key: 'p', ctrl: true }, 64, 18);
        assert(editor.quick);
        assert(screen().includes('main A'));
        state.key({ key: 'g', ctrl: true }, 64, 18);
        assert.equal(JSON.stringify(editor.draft), before);

        editor.previewScenario = 'no-agents';
        state.preview = { ...state.preview, scenario: 'no-agents', subagents: [] };
        assert(screen().includes(t('preview.empty_no_agents', language)));
        assert(!screen().includes(t('ui.drawing.no_enabled_items', language)));
        editor.draft.display.subagents.enabled = false;
        assert(screen().includes(t('preview.empty_subagents_off', language)));
    }
});
test('selected theme bands retain their actual colors while their labels remain highlighted', () => {
    const s = fixture();
    openColors(s.editor, 'field:theme');
    s.editor.colors!.cursor = 4;
    const selected = frame(s, 120, 30).rows.find(row => row.some(span => span.text.includes('› ')) && row.some(span => span.text.includes('Ocean')))!;
    assert(selected);
    const bands = selected.filter(span => span.text.includes('██'));
    assert(bands.length > 0);
    assert(bands.every(span => span.foreground !== null && !span.reverse));
    assert(selected.some(span => span.text.includes('Ocean') && span.reverse));
});

test('compact color selection separates the cursor, candidate, display draft and saved value', () => {
    for (const language of ['en', 'zh-CN'] as const) {
        const state = fixture(language), e = state.editor;
        e.page = 'settings';
        openColors(e, 'field:theme');
        const screen = () => plain(state, 64, 18).join('\n');
        const label = (name: string, theme: string) => t('colors.' + name, language, { value: t('values.' + theme, language) });
        state.key({ key: 'down' }, 64, 18);
        assert(screen().includes('› ' + t('values.dark', language)));
        assert(screen().includes(label('saved', 'classic')));
        assert(screen().includes(label('draft', 'classic')));
        assert(screen().includes(label('candidate', 'classic')));
        state.key({ key: 'return' }, 64, 18);
        assert(screen().includes('› ' + t('values.dark', language) + ' ✓'));
        assert(screen().includes(label('candidate', 'dark')));
        assert.equal(e.draft.display.theme, 'classic');
        assert.equal(e.history.undo.length, 0);
        state.key({ key: 's', ctrl: true }, 64, 18);
        assert.equal(e.colors, null);
        assert.equal(e.draft.display.theme, 'dark');
        assert.equal(e.baseline.draft.display.theme, 'classic');
        assert.equal(e.history.undo.length, 1);
        assert(screen().includes(t('colors.staged', language, { save: e.shortcuts.hint('settings', 'save') })));
        openColors(e, 'field:theme');
        assert(screen().includes(label('saved', 'classic')));
        assert(screen().includes(label('draft', 'dark')));
        assert(screen().includes(label('candidate', 'dark')));
        state.key({ key: 's', ctrl: true }, 64, 18);
        assert.equal(e.history.undo.length, 1);
        assert(screen().includes(t('colors.no_changes', language)));
    }
});
test('the terminal color panel shows its active apply key and both ways to cancel an edit', () => {
    for (const language of ['en', 'zh-CN'] as const) {
        const state = fixture(language), editor = state.editor;
        editor.shortcuts.snapshot.bindings = { 'apply-color': 'J' };
        state.key({ key: 'e', ctrl: true });
        openColors(editor, 'item:foreground');
        const screen = () => plain(state).join('\n');
        const help = t('shortcuts.color-help', language, { enter: 'Enter', apply: 'J', back: 'Esc/Ctrl+G' });
        assert(screen().includes(help));
        for (const key of ['end', 'up', 'up', 'return']) state.key({ key });
        assert(screen().includes(t('shortcuts.color-input-help', language, { enter: 'Enter', back: 'Esc/Ctrl+G', clear: 'Ctrl+U' })));
        state.key({ key: 'escape' });
        state.key({ key: 's', ctrl: true });
        assert(screen().includes(help));
        state.key({ key: 'j' });
        assert.equal(editor.colors, null);
    }
});
test('six-language color candidates cancel, apply only to the draft and preserve unknown-save protection', () => {
    for (const language of LANGUAGES) {
        const s = fixture(language), e = s.editor, baseline = JSON.stringify(e.draft);
        openColors(e, 'field:theme');
        e.colors!.cursor = 4;
        colorsKey(e, { key: 'return' }, language);
        assert.equal(colorDraft(e).display.theme, 'ocean');
        assert.equal(e.draft.display.theme, 'classic');
        assert(plain(s).join('\n').includes(t('colors.title', language)));
        colorsKey(e, { key: 'escape' }, language);
        assert.equal(JSON.stringify(e.draft), baseline);
        openColors(e, 'field:theme');
        e.colors!.cursor = 5;
        colorsKey(e, { key: 'return' }, language);
        colorsKey(e, { key: 's', ctrl: true }, language);
        assert.equal(e.draft.display.theme, 'ember');
        assert.equal(e.baseline.draft.display.theme, 'classic');
        openColors(e, 'field:theme');
        e.colors!.cursor = 6;
        colorsKey(e, { key: 'return' }, language);
        e.setSaveState('unknown');
        colorsKey(e, { key: 's', ctrl: true }, language);
        assert.equal(e.draft.display.theme, 'ember');
        assert(e.colors);
        colorsKey(e, { key: 'escape' }, language);
    }
});
test('preview controls preserve the entire draft in normal, quick and review contexts and diagnosis defaults to explicit input only', () => {
    const s = fixture(), e = s.editor, before = JSON.stringify(e.draft);
    s.key({ key: 'v', ctrl: true });
    s.key({ key: 'w', ctrl: true });
    assert.equal(e.previewScenario, 'warning');
    assert.equal(e.previewWidth, '40');
    assert.equal(JSON.stringify(e.draft), before);
    openDiagnosis(e);
    assert.equal(e.diagnosis!.includeLocal, false);
    e.diagnosis!.path = '/tmp/中文 input.json';
    const request = diagnosisRequest(e, 80);
    assert.equal(request.path, e.diagnosis!.path);
    assert.equal(request.include_local, false);
    assert.deepEqual(request.draft, e.draft);
    diagnosisKey(e, { key: 'escape' });
    assert.equal(e.diagnosis, null);
    assert.equal(JSON.stringify(e.draft), before);
    assert.equal(THEME_IDS.length, 8);
});
test('gradient candidates reverse and edit individual RGB stops, bound stop counts and retain the component form on acceptance', () => {
    const s = fixture(), e = s.editor;
    e.detail = { scope: 'main', id: e.draft.display.instances[0]!.id };
    const detail = { ...e.detail };
    openColors(e, 'item:background_gradient');
    const m = e.colors!;
    m.cursor = 1;
    colorsKey(e, { key: 'return' }, 'en');
    assert.equal((m.candidate as string[]).length, 2);
    const before = [...(m.candidate as string[])];
    m.cursor = 13;
    colorsKey(e, { key: 'return' }, 'en');
    assert.deepEqual(m.candidate, before.reverse());
    m.cursor = 14;
    colorsKey(e, { key: 'return' }, 'en');
    colorsKey(e, { key: 'u', ctrl: true }, 'en');
    colorsKey(e, { key: '#123456', text: true }, 'en');
    colorsKey(e, { key: 'return' }, 'en');
    assert.equal(m.candidate![0], '#123456');
    for (let i = 0; i < 4; i++) {
        m.cursor = 14 + (m.candidate as string[]).length;
        colorsKey(e, { key: 'return' }, 'en');
    }
    assert.equal((m.candidate as string[]).length, 5);
    for (let i = 0; i < 5; i++) {
        m.cursor = 15 + (m.candidate as string[]).length;
        colorsKey(e, { key: 'return' }, 'en');
    }
    assert.equal((m.candidate as string[]).length, 2);
    colorsKey(e, { key: 's', ctrl: true }, 'en');
    assert.deepEqual(e.detail, detail);
    assert.equal(e.instance(detail.scope, detail.id)!.options.background_gradient![0], '#123456');
});
test('standalone setup shares temporary preview controls without changing its candidate or integration choices', () => {
    const draft = fixture().editor.draft, state = new SetupState({ checks: [], resources: [], notes: [], draft, hasDisplay: true, canSave: true, canIntegrate: true }, 'en'), before = JSON.stringify(state.candidate);
    state.key('preview-scenario');
    state.key('preview-width');
    state.key('preview-next');
    assert.equal(state.previewScenario, 'warning');
    assert.equal(state.previewWidth, '40');
    assert.equal(JSON.stringify(state.candidate), before);
    assert.equal(state.phase, 'checks');
});

test('literal escape is editable text in color and file diagnosis fields', () => {
    const s=fixture(), e=s.editor;
    openColors(e,'field:powerline.row_background_gradient');
    e.colors!.input={value:'',cursor:0,scroll:0};
    for(const flag of ['text','paste']) colorsKey(e,{key:'escape',[flag]:true},'en');
    assert.equal(e.colors!.input?.value,'escapeescape');
    colorsKey(e,{key:'escape'},'en'); assert.equal(e.colors!.input,null);
    openDiagnosis(e); diagnosisKey(e,{key:'return'});
    for(const flag of ['text','paste']) diagnosisKey(e,{key:'escape',[flag]:true});
    assert.equal(e.diagnosis!.input?.value,'escapeescape');
    diagnosisKey(e,{key:'escape'}); assert.equal(e.diagnosis!.input,null); assert.equal(e.diagnosis!.path,'');
});
