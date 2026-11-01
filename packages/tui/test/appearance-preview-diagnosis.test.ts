import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, plain } from './fixtures.js';
import { LANGUAGES, t } from '@fbincon/statusline-core/i18n/messages';
import { openColors, colorsKey, colorDraft } from '@fbincon/statusline-core/editor/color-manager';
import { openDiagnosis, diagnosisKey, diagnosisRequest } from '@fbincon/statusline-core/editor/diagnosis-view';
import { THEME_IDS } from '@fbincon/statusline-core/editor/themes';
import { SetupState } from '@fbincon/statusline-core/editor/setup';
import { frame } from '../src/drawing.js';
import { dimensions } from '../src/layout.js';

test('diagnosis keeps the current field and grapheme caret visible on short terminals', () => {
    for (const language of ['en', 'zh-CN'] as const) {
        const s = fixture(language);
        s.key({ key: 'l', ctrl: true });
        s.key({ key: 'return' });
        s.key({ key: '目录/'.repeat(25) + '📁尾', paste: true });
        for (const rows of [18, 19, 20, 24]) {
            const screen = plain(s, 64, rows).join('\n');
            assert(screen.includes('📁尾▏'));
        }
        s.key({ key: 'g', ctrl: true });
        s.key({ key: 'end' }, 64, 18);
        assert(plain(s, 64, 18).join('\n').includes('› ' + t('colors.cancel', language)));
        assert.equal(s.editor.diagnosis!.path, '');
    }
});

test('diagnosis End, Up and page movement follow the visible report after resizing', () => {
    const s = fixture();
    openDiagnosis(s.editor);
    const v = s.editor.diagnosis!;
    v.report = true;
    v.result = {
        sample: false, scope: 'main', width: 60, source: 'test file', observed_at: null, diagnosed_at: '2026-11-01T10:00:00Z',
        session_id: null, prompt_id: null, host_version: null, include_local: false, instances: [],
        output: Array.from({ length: 40 }, (_, i) => ({ id: String(i), spans: [{ text: 'report line ' + i, foreground: null, background: null, bold: false }] })),
        host_fields: { worktree: { session_name: null, git_name: null, selected_source: null },
            cache_miss: { status: 'not_observed', causes: [], last_miss_at: null, tools_added: null, tools_removed: null, system_char_delta: null } },
    };
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
    assert.equal(window(18)[0], resized! - (dimensions(80, 18).content.innerHeight - 1));
    s.key({ key: 'home' }, 80, 18);
    assert.equal(window(18)[0], 1);
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
