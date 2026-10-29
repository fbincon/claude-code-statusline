import { displayWidth } from '@fbincon/statusline-core/rendering/layout';
import { SCENARIO_SCHEMES } from '@fbincon/statusline-core/config/scenario-presets';
import { applyPreset } from '@fbincon/statusline-core/config/presets';
import test from 'node:test';
import { setup, assert, join, writeFileSync, readFileSync } from './final-support.js';
import { defaultDisplay, defaultItem, validateDisplay } from '@fbincon/statusline-core/config/display';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { THEME_IDS, themeDefinition } from '@fbincon/statusline-core/editor/themes';
import { SCENARIO_IDS } from '@fbincon/statusline-core/editor/preview-settings';
import { GRADIENT_PRESETS } from '@fbincon/statusline-core/editor/gradients';
import { previewAdapter } from '@fbincon/statusline-cli/rendering/preview';
import { diagnosisAdapter } from '@fbincon/statusline-cli/diagnostics/service';
import { ConfigurationProtocol } from '@fbincon/statusline-cli/ui/protocol';
import { parseResponse } from '@fbincon/statusline-core/editor/backend';
import { PROTOCOL_VERSION, type ExplainResult, type DiagnoseResult } from '@fbincon/statusline-core/contracts/ui';
import { sampleAgents } from '@fbincon/statusline-core/rendering/sample-scenarios';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
test('all themes share registration, preserve old identities and require schema 16 only for new values', () => {
    assert.equal(THEME_IDS.length, 8);
    assert.equal(Object.keys(GRADIENT_PRESETS).length, 11);
    for (const theme of THEME_IDS) {
        const d = defaultDisplay();
        d.theme = theme;
        assert.deepEqual(validateDisplay(d), d);
        assert.equal(themeDefinition(theme).foreground.length, 6);
        assert.equal(themeDefinition(theme).backgrounds.length, 6);
        if (THEME_IDS.indexOf(theme) >= 4)
            assert.throws(() => validateDisplay({ ...d, schema_version: 15 }));
        else
            assert.equal(validateDisplay({ ...d, schema_version: 15 }).theme, theme);
    }
});
test('scenario previews are deterministic, isolated and explain identical production decisions', async (t) => {
    const f = setup(t), draft = { display: defaultDisplay(), host: { ...DEFAULT_HOST } };
    draft.display.instances = [{ id: 'context', type_id: 'context-used', enabled: true, text: null, options: { ...defaultItem(), foreground_gradient: [...GRADIENT_PRESETS.ocean] } }, { id: 'source', type_id: 'external-value', enabled: true, text: null, options: defaultItem() }];
    draft.display.formatting.thresholds.enabled = true;
    draft.display.subagents.hide_completed = false;
    draft.display.subagents.row_limit = null;
    const before = JSON.stringify(draft), adapter = await previewAdapter('/sample');
    for (const scenario of SCENARIO_IDS)
        for (const width of [40, 80, 120]) {
            const result = f.call('explain', { draft, scope: 'main', width, scenario }).response.result as ExplainResult;
            assert.deepEqual(result.preview, adapter(draft, width, undefined, scenario));
            assert.equal(result.preview.scenario, scenario);
            parseResponse('explain', { exitCode: 0, stderr: '', stdout: JSON.stringify({ protocol_version: PROTOCOL_VERSION, result }) });
            const styles = result.instances[0]!.samples.flatMap(row => row.style_reasons?.map(r => r.code) ?? []);
            if (scenario === 'warning')
                assert(styles.includes('threshold_warning'));
            if (scenario === 'critical')
                assert(styles.includes('threshold_critical'));
            if (scenario === 'zero')
                assert(!styles.some(s => s.startsWith('threshold_')));
        }
    assert.equal(JSON.stringify(draft), before);
    assert.equal(sampleAgents('no-agents').length, 0);
    assert.equal(sampleAgents('few-agents').length, 2);
    assert.equal(sampleAgents('many-agents').length, 24);
    assert.equal(f.call('preview', { draft, width: 80, scenario: 'invented' }).status, 2);
});
test('style explanations identify inactive gradients, disabled colors, shared owners and ANSI conversion', t => {
    const f = setup(t), display = defaultDisplay();
    display.instances = [{ id: 'one', type_id: 'model', enabled: true, text: null, options: { ...defaultItem(), background_gradient: [...GRADIENT_PRESETS.lagoon] } }, { id: 'two', type_id: 'text', enabled: true, text: 'World', options: { ...defaultItem(), background: '#123456' } }];
    display.layout = { mode: 'explicit', rows: [['one', 'two']] };
    const explain = () => f.call('explain', { draft: { display, host: { ...DEFAULT_HOST } }, scope: 'main', width: 120 }).response.result as ExplainResult;
    const codes = (r: ExplainResult, id: string) => r.instances.find(n => n.id === id)!.samples.flatMap(row => row.style_reasons ?? []);
    assert(codes(explain(), 'one').some(r => r.code === 'background_gradient_requires_powerline'));
    display.separator_style = 'powerline';
    display.groups = [{ id: 'shared', primary_id: 'one', member_ids: ['one', 'two'], link_visibility: false, shared_powerline: true }];
    assert(codes(explain(), 'two').some(r => r.code === 'group_background_owned' && r.owner_id === 'one'));
    display.palette = 'ansi';
    assert(codes(explain(), 'one').some(r => r.code === 'color_quantized'));
    display.use_colors = false;
    assert(codes(explain(), 'one').some(r => r.code === 'colors_disabled'));
});
test('file diagnosis uses the current draft, strict file parsing and input-only default without writes', async (t) => {
    const f = setup(t, true), file = join(f.root, '输入 $` draft.json'), bytes = '\ufeff' + JSON.stringify({ session_id: 'session', version: '2.1.310', context_window: { used_percentage: 95, remaining_percentage: 5 } });
    writeFileSync(file, bytes);
    const fail = () => assert.fail('diagnosis attempted a configuration write, lock or repair');
    f.io.lock = fail;
    f.io.write = fail;
    f.io.backup = fail;
    f.io.remove = fail;
    const protocol = new ConfigurationProtocol(f.service, await previewAdapter('/sample'), undefined, await diagnosisAdapter(f.service));
    const display = defaultDisplay();
    display.theme = 'ocean';
    display.instances = [{ id: 'draft-context', type_id: 'context-used', enabled: true, text: null, options: defaultItem() }];
    display.formatting.thresholds.enabled = true;
    const payload = { draft: { display, host: { ...DEFAULT_HOST } }, path: file, scope: 'main', width: 80 };
    const response = f.call('diagnose_file', payload, protocol);
    assert.equal(response.status, 0);
    const report = response.response.result as DiagnoseResult;
    assert.equal(report.sample, false);
    assert.equal(report.include_local, false);
    assert.equal(report.source, file);
    assert.equal(report.observed_at, null);
    assert.equal(report.instances[0]!.id, 'draft-context');
    assert(report.instances[0]!.rows.some(row => row.style_reasons?.some(r => r.code === 'threshold_critical')));
    parseResponse('diagnose_file', { exitCode: 0, stderr: '', stdout: JSON.stringify(response.response) });
    assert.equal(readFileSync(file, 'utf8'), bytes);
    assert.equal(f.call('diagnose_file', { ...payload, scope: 'subagent' }, protocol).response.error.code, 'invalid_request');
    for (const raw of ['{"x":1,"x":2}', '[]', '{"x":NaN}', 'invalid']) {
        writeFileSync(file, raw);
        assert.equal(f.call('diagnose_file', payload, protocol).status, 2);
    }
    assert.equal(f.call('diagnose_file', { ...payload, path: file + '.absent' }, protocol).response.error.code, 'io_error');
    writeFileSync(file, bytes);
    assert.equal(f.call('diagnose_file', { ...payload, observed_at: 'bad-time' }, protocol).status, 2);
    for (const language of LANGUAGES) {
        display.statusline_language = language;
        assert.equal(f.call('diagnose_file', payload, protocol).status, 0);
    }
});
test('new theme foregrounds and Powerline blocks come from the registry in both scopes with plain and ANSI fallbacks', async () => {
    const preview = await previewAdapter('/sample'), display = defaultDisplay(), draft = { display, host: { ...DEFAULT_HOST } };
    display.scope_labels = 'off';
    display.groups = [];
    display.subagents.groups = [];
    display.instances = [{ id: 'model', type_id: 'model', enabled: true, text: null, options: defaultItem() }];
    display.subagents.instances = [{ id: 'name', type_id: 'name', enabled: true, text: null, options: defaultItem() }];
    for (const theme of THEME_IDS.slice(4)) {
        display.theme = theme;
        display.palette = 'default';
        display.use_colors = true;
        display.separator_style = 'classic';
        const definition = themeDefinition(theme), ordinary = preview(draft, 120);
        for (const rows of [ordinary.main, ordinary.subagents])
            assert(rows.flat().some(span => span.foreground?.value === definition.foreground[0]));
        display.separator_style = 'powerline';
        const blocks = preview(draft, 120);
        // Preserve the existing semantic block roles: main model / agent identity.
        for (const [rows,index] of [[blocks.main,0],[blocks.subagents,5]] as const)
            assert(rows.flat().some(span => span.background?.value === definition.backgrounds[index]));
        display.palette = 'ansi';
        const ansi = preview(draft, 120);
        assert([...ansi.main, ...ansi.subagents].flat().every(span => [span.foreground, span.background].every(color => color === null || color.kind === 'ansi' && Number(color.value) < 16)));
        display.use_colors = false;
        const plain = preview(draft, 120);
        assert([...plain.main, ...plain.subagents].flat().every(span => span.foreground === null && span.background === null));
    }
});


test('new display scenarios preview all six languages and preserve configuration round trips', async t => {
    const f=setup(t,true), adapter=await previewAdapter('/sample');
    for(const name of SCENARIO_SCHEMES) for(const language of LANGUAGES) {
        const base=defaultDisplay();base.statusline_language=language;base.subagents.enabled=false;
        const display=applyPreset(base,name,()=> 'unused');assert.equal(display.subagents.enabled,false);assert.equal(display.statusline_language,language);
        assert.deepEqual(validateDisplay(JSON.parse(JSON.stringify(display))),display);
        const draft={display,host:{...DEFAULT_HOST}};
        for(const scenario of ['normal','warning','critical','missing','many-agents'] as const) for(const width of [40,80,120]) {
            const result=adapter(draft,width,undefined,scenario);assert.equal(result.sample,true);assert.equal(result.scenario,scenario);
            if(name==='narrow-terminal'&&language==='en'&&scenario==='normal'&&width===40){const text=result.main.flat().map(s=>s.text).join(' ');assert(text.includes('src'));assert(!text.includes('Directory…'));}
            assert(result.main.every(row=>displayWidth(row.map(s=>s.text).join(''))<=width));
            assert.equal(f.call('preview',{draft,width,scenario}).status,0);
        }
        const current=f.read(), saved=f.call('apply',{draft,expected_revision:current.revision});assert.equal(saved.status,0,JSON.stringify(saved));
        assert.deepEqual(f.read().draft.display,display);
    }
});
