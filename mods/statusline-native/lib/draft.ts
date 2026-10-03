import type { Draft } from './generated-contracts.ts';

/** Copy wire data so toggling a draft cannot change the read baseline. */
export function copyDraft(draft: Draft): Draft {
  return { display: { ...draft.display, items: [...draft.display.items],
    subagents: { ...draft.display.subagents, items: [...draft.display.subagents.items] } }, host: { ...draft.host } };
}
