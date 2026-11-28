import test from 'node:test';
import assert from 'node:assert/strict';
import { createReview } from '@fbincon/statusline-core/editor/import-review';
import { differences } from '@fbincon/statusline-core/editor/import-differences';
import { IMPORT_FIELDS } from '@fbincon/statusline-core/editor/import-selection';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { displayWidth } from '@fbincon/statusline-core/unicode/index';
import { frame } from '../src/drawing.js';
import { defaultItem } from '@fbincon/statusline-core/config/display';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { Session, type Backend } from '../src/session.js';
import { BackendError } from '@fbincon/statusline-core/editor/backend';
import { fixture, plain } from './fixtures.js';

test('Settings file transfers retain the reason, path and caret until a retry succeeds', async () => {
  for (const action of ['import', 'export'] as const) {
    const state = fixture(), e = state.editor;
    e.toggle('main', e.selected.main);
    e.page = 'settings';
    e.setting = action + '-file';
    const original = structuredClone(e.draft), history = structuredClone(e.history);
    const operation = action === 'import' ? 'review_import' : 'export';
    const reason = action === 'import' ? 'Missing file' : 'Destination exists';
    const paths: string[] = [];
    const backend = { request(request: string, payload: { path: string; draft: typeof original; overwrite?: boolean }) {
      if (request === 'preview') return state.preview;
      assert.equal(request, operation);
      assert.deepEqual(payload.draft, original);
      if (action === 'export') assert.equal(payload.overwrite, false);
      paths.push(payload.path);
      if (paths.length === 1) throw new BackendError('io_error', reason);
      return action === 'import' ? { draft: original, changes: [] } : { path: payload.path };
    } } as Backend;
    const session = new Session(state, backend);
    state.key({ key: 'return' }, 64, 18);
    state.key({ key: 'u', ctrl: true }, 64, 18);
    state.key({ key: '/draft.json', paste: true }, 64, 18);
    state.key({ key: 'home' }, 64, 18);
    state.key({ key: 'right' }, 64, 18);
    const input = state.input;
    assert.equal(input?.kind, 'path');
    const caret = input.edit!.cursor;
    await session.key({ key: 'return' }, 64, 18);
    assert.equal(state.input, input);
    assert.equal(input.edit!.cursor, caret);
    const failed = plain(state, 64, 18).join('\n');
    assert.ok(failed.includes(reason));
    assert.ok(failed.includes('Enter ' + t(action === 'import' ? 'ui.hints.read_file' : 'ui.hints.export_new_file', 'en')));
    assert.deepEqual(e.draft, original);
    assert.deepEqual(e.history, history);
    state.key({ key: 'x' }, 64, 18);
    await session.key({ key: 'return' }, 64, 18);
    assert.deepEqual(paths, ['/draft.json', '/xdraft.json']);
    assert.equal(state.input, null);
    assert.equal(!!e.review, action === 'import');
    assert.deepEqual(e.draft, original);
    assert.deepEqual(e.history, history);
  }
});

test('external review selects, previews, cancels and accepts without invoking Save', () => {
  for (const language of LANGUAGES) {
    const state = fixture(language), base = structuredClone(state.editor.draft), incoming = structuredClone(base);
    incoming.display.theme = 'light'; incoming.host.padding = 7;
    const open = () => { state.editor.review = createReview({ draft: incoming, changes: differences(base, incoming) }, base); };
    open(); state.key({ key: 's' }, 80, 24);
    assert.deepEqual(state.editor.review!.result.draft, base);
    for (let i=0; i<IMPORT_FIELDS.indexOf('theme'); i++) state.key({ key: 'down' }, 80, 24);
    state.key({ key: 'space' }, 80, 24);
    assert.equal(state.editor.review!.result.draft.display.theme, 'light');
    assert.equal(state.key({ key: 'a' }), null); assert(state.editor.review);
    for (const [width,height] of [[32,12],[40,16],[80,24],[120,30]])
      assert(frame(state,width!,height!).rows.every(row=>displayWidth(row.map(span=>span.text).join(''))===width));
    state.key({ key: 'g', ctrl: true }); assert.deepEqual(state.editor.draft, base);
    open(); state.key({ key: 's' });
    for (let i=0; i<IMPORT_FIELDS.indexOf('theme'); i++) state.key({ key: 'down' });
    state.key({ key: 'space' }); state.key({ key: 'return' });
    assert.equal(state.key({ key: 'a' }), null);
    assert.equal(state.editor.review, null); assert.equal(state.editor.draft.display.theme, 'light');
    assert.equal(state.editor.draft.host.padding, base.host.padding);
    assert.deepEqual(state.editor.baseline.draft, base);
  }
});

test('expanded import describes added components and an empty selection cannot change the draft', () => {
  for (const language of ['en', 'zh-CN'] as const) {
    const state = fixture(language), e = state.editor;
    const base = structuredClone(e.draft), incoming = structuredClone(e.draft);
    incoming.display.instances.push({ id: 'test-text', type_id: 'text', enabled: true, options: defaultItem(), text: 'Build queue' });
    e.review = createReview({ draft: incoming, changes: differences(base, incoming) }, base);
    const key = (key: string) => state.key({ key }, 64, 18);
    const screen = () => plain(state, 64, 18).join('\n');
    key('return');
    assert(screen().includes(t('review.value.absent', language)));
    assert(screen().includes('Build queue'));
    assert(!screen().includes('"type_id"'));
    key('s'); key('return'); key('a');
    assert(e.review);
    assert(screen().includes(t('review.empty_selection', language)));
    assert.deepEqual(e.draft, base);
    assert.equal(e.history.undo.length, 0);
    key('f'); key('a');
    assert.equal(e.review, null);
    assert.equal(e.history.undo.length, 1);
    assert.equal(e.draft.display.instances.at(-1)!.text, 'Build queue');
    assert.deepEqual(e.baseline.draft, base);
  }
});
