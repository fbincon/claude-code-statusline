import { expect, test } from 'claude-code/testing';
import { component, description, readResult } from '../fixtures.ts';
import { Editor } from '../../lib/editor/draft.ts';
import { openGroups, groupsKey, groupsView } from '../../lib/editor/group-manager.ts';
import { isDraft } from '../../lib/backend.ts';
import { LANGUAGES } from '../../lib/i18n/index.ts';

test('native grouping uses the same draft-only create, cancel and copy operations', () => {
  for (const language of LANGUAGES) {
    const current = readResult(), decoration = component('text'); decoration.text = 'DECOR';
    current.draft.display.instances = [decoration, component('context-used')];
    const e = new Editor(description(), current);
    openGroups(e); e.groupManager!.cursor = 1; groupsKey(e, { key: 'enter' });
    e.groupManager!.cursor = 5; groupsKey(e, { key: 'enter' });
    expect(e.draft.display.groups.length).toBe(1);
    expect(isDraft(e.draft)).toBe(true);
    expect(current.draft.display.groups.length).toBe(0);
    expect(groupsView(e, language, 30, 5).length <= 5).toBe(true);
    e.groupManager!.cursor = 1; groupsKey(e, { key: 'enter' });
    e.groupManager!.cursor = 3; groupsKey(e, { key: 'enter' });
    expect(e.draft.display.groups.length).toBe(2);
    expect(e.draft.display.groups[1]!.primary_id !== e.draft.display.groups[0]!.primary_id).toBe(true);
    expect(isDraft(e.draft)).toBe(true);
    groupsKey(e, { key: 'escape' }); expect(e.groupManager).toBe(null);
  }
});
