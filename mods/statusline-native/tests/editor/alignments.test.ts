import { expect, test } from 'claude-code/testing';
import { component, description, readResult, nodeText } from '../fixtures.ts';
import { Editor } from '../../lib/editor/draft.ts';
import { openAlignments, alignmentsKey, alignmentsView } from '../../lib/editor/alignment-manager.ts';
import { isDraft } from '../../lib/backend.ts';
import { LANGUAGES } from '../../lib/i18n/index.ts';
import { clientProps, type View } from '../../lib/session.ts';

test('native alignment manager survives the frozen Client port and keeps pending edits local', () => {
  for (const language of LANGUAGES) {
    const current = readResult();
    current.draft.display.instances = ['a', 'b'].map(id => ({ ...component('text'), id, text: id }));
    current.draft.display.layout = { mode: 'explicit', rows: [['a'], ['b']] };
    const e = new Editor(description(), current);
    openAlignments(e);
    for (const key of ['enter', 'down', 'right', 'down', 'right', 'end', 'enter']) alignmentsKey(e, { key });
    expect(isDraft(e.draft)).toBe(true);
    expect(e.draft.display.layout.alignments!.length).toBe(1);
    expect(current.draft.display.layout.alignments).toBeUndefined();
    const view: View = { editor: e, language, input: null, preview: null, preferences: [], preferencesError: '', error: '', previewError: '', previewBusy: false, message: '', busy: '', uncertain: false };
    const props = clientProps(view, 1, 1, 1, 80, 24);
    const snapshot = JSON.stringify(props);
    expect(nodeText(props.frame, props.frame.length - 1)).toContain(e.draft.display.layout.alignments![0]!.id);
    e.alignmentManager!.cursor = 1;
    expect(JSON.stringify(props)).toBe(snapshot);
    alignmentsKey(e, { key: 'escape' });
    expect(e.instanceAction('main', 'remove')).toBe(false);
    expect(e.compositionError.key).toBe('alignment.references');
  }
});
