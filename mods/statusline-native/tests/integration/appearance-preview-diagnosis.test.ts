import { t } from '../../lib/i18n/index.ts';
import { expect, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, keys, selectSetting, previewDraft, clientKey, reply } from '../fixtures.ts';
import { withinBudget } from '../../ui/frame.ts';
import { Editor } from '../../lib/editor/draft.ts';
import { openColors, colorsKey, colorDraft } from '../../lib/editor/color-manager.ts';
import { description, readResult } from '../fixtures.ts';
import { LANGUAGES } from '../../lib/i18n/index.ts';
import { clientProps } from '../../lib/session.ts';
import type { View } from '../../lib/session.ts';
import type { ProcessRunResult } from 'claude-code';
test('new color pages retain complete candidates outside bounded visible projections in six languages', () => {
    for (const language of LANGUAGES)
        for (const key of ['field:powerline.row_background_gradient','field:theme', 'item:foreground', 'item:background_gradient']) {
            const e = new Editor(description(), readResult());
            e.detail = { scope: 'main', id: e.draft.display.instances[0]!.id };
            openColors(e, key);
            if (key === 'field:theme') {
                e.colors!.cursor = 4;
                colorsKey(e, { key: 'return' }, language);
                expect(colorDraft(e).display.theme).toBe('ocean');
            }
            const view: View = { editor: e, language, input: null, preview: null, preferences: [], preferencesError: '', error: '', previewError: '', previewBusy: false, message: '', busy: '', uncertain: false };
            for (const [columns, rows] of [[32, 12], [72, 213], [200, 50]]) {
                const projected = clientProps(view, 1, 0, 1, columns!, rows!);
                expect(withinBudget(projected)).toBe(true);
                expect(JSON.stringify(projected).includes('"candidate":')).toBe(false);
                expect(projected.frame.some(node => typeof node[1].color === 'string')).toBe(true);
            }
            colorsKey(e, { key: 'escape' }, language);
            expect(e.draft.display.theme).toBe('classic');
        }
});
test('native color selector, temporary scenario controls and cancel preserve the saved display', { timeoutMs: 20000 }, async ($, on) => {
    const f = setup(on);
    await $.session.start(START);
    await $.command.run(RUN);
    const ui = await $.ui.mount(PANE), before = JSON.stringify(f.store.draft);
    await keys(ui, '3');
    await selectSetting(ui, 'field:theme');
    await keys(ui, 'return', 'down', 'down', 'down', 'down', 'return');
    expect(previewDraft(f).display.theme).toBe('ocean');
    expect(JSON.stringify(f.store.draft)).toBe(before);
    await keys(ui, { key: 'g', ctrl: true }, { key: 'v', ctrl: true }, { key: 'w', ctrl: true });
    const preview = f.calls.filter(c => c.operation === 'preview').at(-1)!;
    expect(preview.payload.scenario).toBe('warning');
    expect(preview.payload.width <= 40).toBe(true);
    expect(f.calls.some(c => c.operation === 'apply')).toBe(false);
    await ui.unmount();
});
test('native explicit file diagnosis retains a large report in the host and returns to the same unsaved draft', { timeoutMs: 20000 }, async ($, on) => {
    const f = setup(on);
    f.behavior.process = (request, next) => request.operation === 'diagnose_file' ? { value: reply({ sample: false, scope: 'main', width: request.payload.width, source: '/tmp/input 中文.json', observed_at: null, diagnosed_at: '2026-10-28T12:00:00Z', session_id: 'session', prompt_id: null, host_version: '2.1.310', include_local: false,
            output: Array.from({ length: 64 }, (_, i) => ({ id: 'main:' + i, spans: [{ text: 'Actual input ' + i, bold: false, foreground: { kind: 'rgb', value: '#67e8f9' }, background: null }] })),
            instances: [{ id: request.payload.draft.display.instances[0].id, type_id: request.payload.draft.display.instances[0].type_id, enabled: true, reasons: [], evidence: [], rows: Array.from({ length: 512 }, (_, i) => ({ row_id: 'agent:' + i, outcome: 'visible', truncated: false, style_reasons: [{ code: 'color_quantized', owner_id: null }] })) }], host_fields: { worktree: { session_name: null, git_name: null, selected_source: null }, cache_miss: { status: 'not_observed', causes: [], last_miss_at: null, tools_added: null, tools_removed: null, system_char_delta: null } } }) } : next();
    await $.session.start(START);
    await $.command.run(RUN);
    const ui = await $.ui.mount(PANE), before = JSON.stringify(f.store.draft);
    await keys(ui, '3');
    await selectSetting(ui, 'diagnose-file');
    await keys(ui, 'return', 'return', '/tmp/input 中文.json', 'return', 'down', 'down', 'down', 'down', 'return');
    const call = f.calls.find(c => c.operation === 'diagnose_file')!;
    expect(call.payload.include_local).toBe(false);
    expect(call.payload.path).toBe('/tmp/input 中文.json');
    expect(await ui.find({ in: await clientKey(ui), type: 'Text', text: /Actual input/ })).toBeDefined();
    const client = await ui.find({ key: await clientKey(ui) });
    expect(withinBudget(client!.props.props)).toBe(true);
    expect(JSON.stringify(client!.props.props).includes('style_reasons')).toBe(false);
    await keys(ui, 'pagedown', { key: 'g', ctrl: true }, { key: 'g', ctrl: true });
    expect(JSON.stringify(f.store.draft)).toBe(before);
    expect(f.calls.some(c => c.operation === 'apply')).toBe(false);
    await ui.unmount();
});
test('closing a pending file diagnosis keeps the editor responsive and rejects its late report', { timeoutMs: 20000 }, async ($, on) => {
    const f = setup(on);
    let finish!: (value: ProcessRunResult) => void, started!: () => void;
    const pending = new Promise<ProcessRunResult>(resolve => { finish = resolve; }), begun = new Promise<void>(resolve => { started = resolve; });
    f.behavior.process = async (request, next) => { if (request.operation !== 'diagnose_file')
        return next(); started(); return { value: await pending }; };
    await $.session.start(START);
    await $.command.run(RUN);
    const ui = await $.ui.mount(PANE), before = JSON.stringify(f.store.draft);
    const diagnosing = keys(ui, { key: 'l', ctrl: true }, 'return', '/tmp/explicit.json', 'return', 'down', 'down', 'down', 'down', 'return');
    await begun;
    await keys(ui, { key: 'g', ctrl: true });
    finish(reply({ sample: false, scope: 'main', width: 60, source: 'late input report', observed_at: null, diagnosed_at: '2026-10-28T12:00:00Z', session_id: null, prompt_id: null, host_version: null, include_local: false, output: [], instances: [], host_fields: { worktree: { session_name: null, git_name: null, selected_source: null }, cache_miss: { status: 'not_observed', causes: [], last_miss_at: null, tools_added: null, tools_removed: null, system_char_delta: null } } }));
    await diagnosing;
    await ui.redraw();
    expect(await ui.find({ in: await clientKey(ui), type: 'Text', text: /late input report/ })).toBeUndefined();
    expect(JSON.stringify(f.store.draft)).toBe(before);
    await ui.unmount();
});


for(const language of LANGUAGES) test('localized actual settings entries / '+language,{timeoutMs:20000},async($,on)=>{
    const f=setup(on);f.store.uiLanguage=language;
    await $.session.start(START);await $.command.run(RUN);const ui=await $.ui.mount(PANE);
    await keys(ui,{key:'e',ctrl:true});await selectSetting(ui,'reuse-style');
    expect(await ui.find({in:await clientKey(ui),type:'Text',text:new RegExp(t('settings.reuse-style',language))})).toBeDefined();
    await keys(ui,'escape','3');
    for(const key of ['change-history','reuse-groups']){await selectSetting(ui,key);expect(await ui.find({in:await clientKey(ui),type:'Text',text:new RegExp(t('settings.'+key,language))})).toBeDefined();}
    expect(f.calls.some(c=>c.operation==='apply')).toBe(false);await ui.unmount();
});
