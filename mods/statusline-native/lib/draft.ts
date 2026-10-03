/** Transient probe state. Closing/reopening always starts a fresh draft. */
export function createDraft() {
  return { colors: true };
}
