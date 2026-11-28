import assert from 'node:assert/strict';
import test from 'node:test';
import { BY_SCOPE, ITEMS } from '../src/config/catalog.js';
import { defaultDisplay } from '../src/config/display.js';
import { DEFAULT_HOST } from '../src/config/draft.js';
import type { DescribeResult, ExplainInstance, ReadResult } from '../src/contracts/ui.js';
import { Editor } from '../src/editor/draft.js';
import { explanationRows, openExplanation } from '../src/editor/explanation.js';
import { guidanceRows } from '../src/editor/guidance.js';
import { itemDetailBullet, itemDetailWindow, wrapItemDetailRows } from '../src/editor/item-detail.js';
import type { PreviewScenario } from '../src/editor/preview-settings.js';
import { t } from '../src/i18n/messages.js';
import { displayWidth } from '../src/unicode/index.js';

test('detail bullets hang at grapheme boundaries and a viewport clamps to real rows', () => {
  const text = '中文 \u0301abc';
  const content = [itemDetailBullet(text)];
  const rows = wrapItemDetailRows(content, 7);
  assert.deepEqual(rows.map(row => row.text), ['• 中文 \u0301', '  abc']);
  assert.ok(wrapItemDetailRows(content, 2).every(row => displayWidth(row.text) <= 2));
  assert.deepEqual(itemDetailWindow(rows, 99, 1, 'up'), { start: 0, rows: [rows[0]], summary: '1–1/2' });
  assert.deepEqual(itemDetailWindow(rows, -99, 1, 'pagedown'), { start: 1, rows: [rows[1]], summary: '2–2/2' });
  assert.deepEqual(itemDetailWindow([], 99, 1, 'end'), { start: 0, rows: [], summary: '0–0/0' });
});

test('source guidance only includes applicable conditions, fields and setup', () => {
  const literal = guidanceRows(BY_SCOPE.main.get('text')!, 'en', 160);
  const headings = literal.filter(row => row.kind === 'heading').map(row => row.text);
  assert.deepEqual(headings, ['Static text', t('guidance.overview'), t('guidance.requirements')]);
  assert.ok(literal.some(row => row.text.includes(t('guidance.sources.configuration'))));
  assert.ok(literal.some(row => row.text.includes(t('guidance.requirements.text'))));

  const spacer = guidanceRows(BY_SCOPE.main.get('spacer')!, 'en', 160);
  assert.ok(spacer.some(row => row.text.includes(t('composition.errors.main_spacer'))));
  const agentSpacer = guidanceRows(BY_SCOPE.subagent.get('spacer')!, 'en', 160);
  assert.ok(agentSpacer.some(row => row.text.includes(t('agent_rows.reason.callback-gap'))));

  const external = guidanceRows(BY_SCOPE.subagent.get('external-value')!, 'en', 160);
  for (const copy of ['sources.json', 'sources.command', 'guidance.requirements.source_binding', 'guidance.requirements.subagent_rows']) {
    assert.ok(external.some(row => row.text.includes(t(copy))), copy);
  }
  assert.ok(external.some(row => row.kind === 'example' && row.text.trim() === 'claude-statusline source list'));

  const github = guidanceRows(BY_SCOPE.main.get('github-ci')!, 'en', 160);
  assert.ok(github.some(row => row.text.includes(t('sources.github'))));
  assert.ok(!github.some(row => row.text.includes(t('guidance.sources.local_state'))));
});

test('explanation distinguishes an unavailable response and each empty sample state', () => {
  const current: ReadResult = {
    draft: { display: defaultDisplay(), host: { ...DEFAULT_HOST } },
    revision: '0'.repeat(64), installed: true, installation: {}, backend_version: 'test',
    capabilities: { host_version: null, subagent_rows: 'unknown', native_mod: 'unknown', native_mod_loaded: null, data_observation: 'not_observed' },
  };
  const editor = new Editor({ catalog: [...ITEMS] } as DescribeResult, current);
  const { id, type_id } = editor.draft.display.subagents.instances[0]!;
  const view = openExplanation('subagent', id);
  editor.explanation = view;
  const rows = () => explanationRows(editor, 'en', 160);
  const instance: ExplainInstance = { id, type_id, enabled: true, reasons: [], samples: [] };
  const setResult = (scenario: PreviewScenario, instances: ExplainInstance[]) => {
    view.result = { scope: 'subagent', sample: true, actual_availability: 'not_observed', width: 80,
      preview: { sample: true, scenario, main: [], subagents: [] }, instances };
  };
  assert.equal(rows()[2]?.kind, 'example');
  assert.ok(rows().some(row => row.kind === 'note' && row.text === t('explain.loading')));
  setResult('normal', []);
  assert.ok(rows().some(row => row.kind === 'error' && row.text === t('explain.unavailable')));
  for (const [message, scenario, entry] of [
    ['no_sample', 'normal', { ...instance, enabled: false }],
    ['no_sample_scope_disabled', 'normal', { ...instance, reasons: [{ code: 'scope_disabled', origin: 'configuration' }] }],
    ['no_sample_agents', 'no-agents', instance],
    ['no_sample_agents', 'missing', instance],
    ['no_sample_result', 'normal', instance],
  ] satisfies [string, PreviewScenario, ExplainInstance][]) {
    setResult(scenario, [entry]);
    assert.ok(rows().some(row => row.kind === 'body' && row.text === t('explain.' + message)), message);
  }
  view.error = 'Could not load the sample';
  assert.ok(rows().some(row => row.kind === 'error' && row.text === view.error));
  assert.ok(!rows().some(row => row.text === t('explain.no_sample_result')));
  assert.deepEqual(editor.draft, current.draft);
  assert.deepEqual(editor.history.undo, []);
});
