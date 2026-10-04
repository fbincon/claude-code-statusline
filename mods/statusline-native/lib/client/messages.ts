import type { ClientKeyEvent } from 'claude-code';

export const MAX_BATCH = 128;
export const MAX_PENDING = 512;
export interface KeyMessage {
  seq: number;
  event: ClientKeyEvent;
}
export interface Batch {
  epoch: number;
  columns: number;
  rows: number;
  events: KeyMessage[];
}

const SPECIAL_KEYS = new Set([
  'up',
  'down',
  'left',
  'right',
  'return',
  'tab',
  'backspace',
  'delete',
  'pageup',
  'pagedown',
  'home',
  'end',
  'insert',
  'escape',
  'esc',
  'space',
  'clear',
  'capslock',
  'numlock',
  'scrolllock',
  'pause',
  'printscreen',
]);

/** The terminal may deliver a fast printable run as a single input chunk. */
export function keyEvents(event: ClientKeyEvent): ClientKeyEvent[] {
  if (
    event.ctrl ||
    event.meta ||
    [...event.key].length <= 1 ||
    SPECIAL_KEYS.has(event.key) ||
    /^f\d{1,2}$/i.test(event.key) ||
    /[\x00-\x1f\x7f]/.test(event.key)
  )
    return [event];
  return [...event.key].map((key) => ({ ...event, key }));
}

/** Posts are input, including when our own module is their usual sender. */
export function parseBatch(value: unknown): Batch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (Object.keys(b).sort().join(',') !== 'columns,epoch,events,rows')
    return null;
  for (const field of ['epoch', 'columns', 'rows']) {
    if (!Number.isSafeInteger(b[field]) || Number(b[field]) < 0) return null;
  }
  if (
    Number(b.columns) > 10000 ||
    Number(b.rows) > 10000 ||
    !Array.isArray(b.events) ||
    b.events.length > MAX_BATCH
  )
    return null;
  let previous = 0;
  for (const message of b.events) {
    if (
      !message ||
      typeof message !== 'object' ||
      Array.isArray(message) ||
      Object.keys(message).sort().join(',') !== 'event,seq' ||
      !Number.isSafeInteger(message.seq) ||
      message.seq <= previous
    )
      return null;
    previous = message.seq;
    const e = message.event;
    if (
      !e ||
      typeof e !== 'object' ||
      Array.isArray(e) ||
      typeof e.key !== 'string' ||
      !e.key.length ||
      e.key.length > 64 ||
      /[\x00-\x1f\x7f]/.test(e.key) ||
      Object.keys(e).some(
        (key) =>
          !['key', 'ctrl', 'shift', 'meta'].includes(key) ||
          (key !== 'key' && e[key] !== true),
      )
    )
      return null;
  }
  return value as Batch;
}
