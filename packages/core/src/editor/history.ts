/** Session-only snapshots. These are host state, never presentation props or disk data. */
import type { Draft } from '../contracts/ui.js';
import type { LocalizedText } from '../i18n/messages.js';

export const HISTORY_STEPS = 100;
export const HISTORY_BYTES = 16 * 1024 * 1024;
export interface HistoryEntry { draft: Draft; label: LocalizedText; bytes: number }
export interface DraftHistory { undo: HistoryEntry[]; redo: HistoryEntry[]; trimmed: boolean }
export const emptyHistory = (): DraftHistory => ({ undo: [], redo: [], trimmed: false });
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function semantic(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(semantic).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + semantic((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
/** Count UTF-8 without depending on Node or a host-specific TextEncoder. */
export function snapshot(draft: Draft, label: LocalizedText): HistoryEntry {
  const raw = JSON.stringify(draft); let bytes = 0;
  for (const c of raw) { const n = c.codePointAt(0)!; bytes += n < 128 ? 1 : n < 2048 ? 2 : n < 65536 ? 3 : 4; }
  return { draft: clone(draft), label: clone(label), bytes };
}
export function boundHistory(history: DraftHistory): void {
  let bytes = [...history.undo, ...history.redo].reduce((sum, entry) => sum + entry.bytes, 0);
  while (history.undo.length + history.redo.length > HISTORY_STEPS || bytes > HISTORY_BYTES) {
    const removed = history.undo.length ? history.undo.shift() : history.redo.shift();
    if (!removed) break;
    bytes -= removed.bytes; history.trimmed = true;
  }
}
export function remember(history: DraftHistory, before: Draft, label: LocalizedText): void {
  history.redo = []; history.undo.push(snapshot(before, label)); boundHistory(history);
}
