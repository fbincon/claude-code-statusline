import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDisplay, defaultItem, validateDisplay } from '../src/config/display.js';
import { DEFAULT_HOST } from '../src/config/draft.js';
import { IMPORT_FIELDS, selectImport } from '../src/editor/import-selection.js';
import { differences } from '../src/editor/import-differences.js';
import { createReview, navigateReview, reviewRows } from '../src/editor/import-review.js';
import { LANGUAGES } from '../src/i18n/registry.js';
import type { Draft } from '../src/contracts/ui.js';

const fixture = (): Draft => ({ display: defaultDisplay(), host: { ...DEFAULT_HOST } });
test('selective import preserves every unselected field and clears only imported scope bindings', () => {
  const base = fixture(), incoming = fixture();
  base.display.instances.push({ id: 'local', type_id: 'external-value', enabled: true, options: defaultItem(), text: null, source: { binding: 'local-main', hint: 'main' } });
  base.display.subagents.instances.push({ id: 'local', type_id: 'external-value', enabled: true, options: defaultItem(), text: null, source: { binding: 'local-agent', hint: 'agent' } });
  Object.assign(incoming.display, { theme: 'light', statusline_language: 'ja', formatting: { ...incoming.display.formatting, number_format: 'full' } });
  incoming.host.padding = 7;
  incoming.display.formatting.thresholds = { enabled: true, warning: 60, critical: 80 };
  incoming.display.metrics.branch_diff_base_ref = 'release';
  incoming.display.instances = [{ id: 'local', type_id: 'external-value', enabled: true, options: defaultItem(), text: null, source: { binding: 'foreign', hint: 'import' } }];
  const snapshot = JSON.stringify([base, incoming]);
  for (const selection of [[], ['theme'], ['main'], ['subagent'], ['main','subagent'], ['theme','statusline_language','formatting.number_format'], [...IMPORT_FIELDS]]) {
    const value = selectImport(base, incoming, selection);
    assert.deepEqual(value.host, base.host);
    assert.deepEqual(validateDisplay(value.display), value.display);
    if (!selection.includes('main')) assert.deepEqual(value.display.instances, base.display.instances);
    else assert.equal(value.display.instances[0]!.source!.binding, null);
    if (!selection.includes('subagent')) assert.deepEqual(value.display.subagents, base.display.subagents);
    if (!selection.includes('formatting.thresholds')) assert.deepEqual(value.display.formatting.thresholds, base.display.formatting.thresholds);
  }
  assert.equal(JSON.stringify([base, incoming]), snapshot);
  assert.throws(() => selectImport(base, incoming, ['theme','theme']));
  assert.throws(() => selectImport(base, incoming, ['host']));
  assert.throws(() => selectImport(base, incoming, ['formatting']));
});
test('complete main selection keeps groups, explicit rows and repeated-instance references together', () => {
  const base = fixture(), incoming = fixture();
  incoming.display.instances = [
    { id: 'label', type_id: 'text', enabled: true, options: defaultItem(), text: '中文 👩‍💻' },
    ...['one','two'].map(id => ({ id, type_id: 'model', enabled: true, options: defaultItem(), text: null })),
  ];
  incoming.display.layout = { mode: 'explicit', rows: [['label','one'], ['two']] };
  incoming.display.groups = [{ id: 'group', member_ids: ['label','one'], primary_id: 'one', link_visibility: true, shared_powerline: true }];
  const result = selectImport(base, incoming, ['main']);
  assert.deepEqual(validateDisplay(result.display), result.display);
  assert.deepEqual(result.display.layout, incoming.display.layout);
  assert.deepEqual(result.display.groups, incoming.display.groups);
  assert.deepEqual(result.display.subagents, base.display.subagents);
});
test('shared review starts selection empty, previews toggles and returns to full import without rereading', () => {
  for (const language of LANGUAGES) {
    const base = fixture(), incoming = fixture(); incoming.display.theme = 'light'; incoming.host.padding = 7;
    const review = createReview({ draft: incoming, changes: differences(base, incoming) }, base);
    navigateReview(review, 's', language, 40, 5);
    assert.deepEqual(review.result.draft, base);
    assert.deepEqual(review.selection, []);
    for (let i=0; i<IMPORT_FIELDS.indexOf('theme'); i++) navigateReview(review, 'down', language, 40, 5);
    navigateReview(review, 'space', language, 40, 5);
    assert.equal(review.result.draft.display.theme, 'light');
    assert.equal(review.result.draft.host.padding, 0);
    assert(reviewRows(review, language, 40).every(row => !row.text.includes('fields.global.')));
    navigateReview(review, 'return', language, 40, 5);
    assert.equal(review.choosing, false);
    assert.equal(review.result.changes.length, 1);
    navigateReview(review, 'f', language, 40, 5);
    assert.equal(review.result.draft.host.padding, 7);
  }
});
