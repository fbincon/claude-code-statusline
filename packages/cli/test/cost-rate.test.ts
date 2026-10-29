import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, existsSync } from 'node:fs';
import { defaultDisplay, validateDisplay } from '@fbincon/statusline-core/config/display';
import { edit } from '@fbincon/statusline-core/config/instances';
import { itemFields, setField } from '@fbincon/statusline-core/config/editor-fields';
import { costRateValue } from '@fbincon/statusline-core/rendering/metrics';
import { isDraft } from '@fbincon/statusline-core/editor/backend';
import { Editor } from '@fbincon/statusline-core/editor/draft';
import { formRows, setFormValue } from '@fbincon/statusline-core/editor/forms';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { Presentation } from '@fbincon/statusline-core/rendering/language';
import { inputEvidence } from '@fbincon/statusline-core/rendering/diagnose';
import { configurationReasons } from '@fbincon/statusline-core/rendering/explain';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { config, rendered } from './render-support.js';
import { setup, join, readFileSync } from './final-support.js';
import { exportFile, importFile } from '../src/config/transfer.js';

test('hourly rates use only the selected official duration and require one observed minute', () => {
    const cost = { total_cost_usd: 2, total_duration_ms: 3600000, total_api_duration_ms: 600000 };
    assert.equal(costRateValue(cost, 'session'), 2); assert.equal(costRateValue(cost, 'api'), 12);
    assert.equal(costRateValue({ total_cost_usd: 0, total_duration_ms: 60000 }, 'session'), 0);
    assert.equal(costRateValue({ total_cost_usd: 1, total_duration_ms: 59999 }, 'session'), null);
    assert.equal(costRateValue({ total_cost_usd: 1, total_duration_ms: 60000 }, 'session'), 60);
    assert.equal(costRateValue({ total_cost_usd: 1, total_api_duration_ms: 60000, total_duration_ms: -1 }, 'api'), 60);
    for (const invalid of [null, undefined, -1, NaN, Infinity, '1', true, {}, []]) {
        assert.equal(costRateValue({ ...cost, total_cost_usd: invalid }, 'session'), null);
        assert.equal(costRateValue({ ...cost, total_duration_ms: invalid }, 'session'), null);
        assert.equal(costRateValue({ ...cost, total_api_duration_ms: invalid }, 'api'), null);
    }
    assert.equal(costRateValue({ total_cost_usd: 1, total_duration_ms: 0 }, 'session'), null);
    assert.equal(costRateValue({ total_cost_usd: 1e308, total_duration_ms: 60000 }, 'session'), null);
    assert.equal(costRateValue({ total_cost_usd: 1e308, total_duration_ms: 1e308 }, 'session'), 3600000);
    assert(!defaultDisplay().instances.some(n => n.type_id === 'session-cost-rate'));
});

test('rate instances keep independent denominators, estimate markers and six-language units with labels off', async () => {
    let display = config(['session-cost-rate']);
    display = edit(display, 'main', { action: 'copy', id: 'session-cost-rate' }, () => 'api-rate').config;
    display = setField(display, 'cost_rate_basis', 'api', 'main', 'api-rate');
    for (const node of display.instances) node.options.formatting.labels = 'off';
    for (const lang of LANGUAGES) {
        const { MESSAGES } = await import('@fbincon/statusline-core/i18n/statusline/' + lang);
        const language = new Presentation(lang, MESSAGES);
        const value = rendered({ cost: { total_cost_usd: 2, total_duration_ms: 3600000, total_api_duration_ms: 600000 } }, display, { language });
        assert(value.includes('~$2.00')); assert(value.includes('~$12.00')); assert(value.includes('API'));
        const expected = language.text('cost.rate_session', { value: '2.00' }).slice(language.prefix('main', 'session-cost-rate').length).trim();
        assert(value.includes(expected)); assert(!value.includes('statusline.'));
        assert(rendered({ cost: { total_cost_usd: 0, total_duration_ms: 60000 } }, display, { language }).includes('0.00'));
    }
    const evidence = inputEvidence({ cost: { total_cost_usd: 2, total_api_duration_ms: 600000 } }, 'main', 'session-cost-rate', null, display.instances.find(n => n.id === 'api-rate')!.options);
    assert.deepEqual(evidence[0]!.fields.map(f => f.path), ['cost.total_cost_usd', 'cost.total_api_duration_ms']);
    const reasons = configurationReasons({ display, host: DEFAULT_HOST }, 'main', display.instances.find(n => n.id === 'api-rate')!, { installation: { main: 'owned', subagent: 'absent' }, host_version: null, runtime: { native_timing: false, live_metrics: false } });
    assert(reasons.some(r => r.code === 'cost_rate_api'));
});

test('rate validation, legacy migration and portable persistence retain optional choices', () => {
    let display = config(['session-cost-rate']);
    assert(itemFields('main', 'session-cost-rate').some(f => f.key === 'cost_rate_basis'));
    assert(!itemFields('main', 'session-cost').some(f => f.key === 'cost_rate_basis'));
    for (const value of ['active', '', null, true]) assert.throws(() => setField(display, 'cost_rate_basis', value, 'main', 'session-cost-rate'));
    const invalid = defaultDisplay(); invalid.instances[0]!.options.cost_rate_basis = 'api';
    assert.throws(() => validateDisplay(invalid)); assert(!isDraft({ display: invalid, host: DEFAULT_HOST }));
    display = setField(display, 'cost_rate_basis', 'api', 'main', 'session-cost-rate');
    assert.deepEqual(validateDisplay(JSON.parse(JSON.stringify(display))), display);
    const old = { ...defaultDisplay(), schema_version: 12 }, bytes = JSON.stringify(old);
    assert.equal(validateDisplay(old).schema_version, 17); assert.equal(JSON.stringify(old), bytes);
});

test('both editors preview and persist rates without changing metric collection or existing session fields', t => {
    const f = setup(t, true), initial = f.read(); initial.draft.display = config(['session-cost-rate', 'session-cost']);
    assert.equal(f.save(initial).status, 0);
    for (const language of LANGUAGES) {
        const current = f.read(), bytes = readFileSync(f.displayPath), editor = new Editor(f.call('describe').response.result, current);
        editor.detail = { scope: 'main', id: 'session-cost-rate' };
        const view = { editor, language, message: '' }, row = formRows(view).find(r => r.spec.key === 'cost_rate_basis')!;
        assert(row); assert(setFormValue(view, row, 'api')); assert.deepEqual(readFileSync(f.displayPath), bytes);
        const preview = f.call('preview', { draft: editor.draft, width: 120 }); assert.equal(preview.status, 0);
        assert(JSON.stringify(preview.response.result).includes('API'));
        assert.equal(f.save({ ...current, draft: editor.draft }).status, 0);
        assert.equal(f.read().draft.display.instances.find((n: {id:string}) => n.id === 'session-cost-rate').options.cost_rate_basis, 'api');
        const file = join(f.root, language + '.json'); exportFile(file, editor.draft, f.root);
        assert.deepEqual(importFile(file, current.draft).display, editor.draft.display);
        assert.equal(rendered({ cost: { total_cost_usd: 2 } }, editor.draft.display), 'Cost $2.00');
    }
    const project = join(f.root, 'project'); mkdirSync(project);
    const library = f.call('profiles_read').response.result;
    assert.equal(f.call('profiles_apply', { action: 'save', name: 'Rates', display: f.read().draft.display, bind_path: project, expected_revision: library.revision }).status, 0);
    const selected = f.call('read', { target: { kind: 'project', path: project } }).response.result;
    assert.equal(selected.draft.display.instances.find((n: {id:string}) => n.id === 'session-cost-rate').options.cost_rate_basis, 'api');
    assert(!existsSync(join(f.root, 'claude-statusline-runtime.json')));
});
