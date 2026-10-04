import { expect, test } from 'claude-code/testing';
import type { ClientKeyEvent, ClientSurface } from 'claude-code';
import { Editor } from '../../lib/editor/draft.ts';
import { clientProps } from '../../lib/session.ts';
import type { View } from '../../lib/session.ts';
import { keyEvents, parseBatch, MAX_BATCH } from '../../lib/client/messages.ts';
import StatuslineClient from '../../ui/client/surface.ts';
import { description, readResult } from '../fixtures.ts';

function view(): View {
  return {
    editor: new Editor(description(), readResult()),
    input: null,
    preview: null,
    preferences: [],
    preferencesError: '',
    error: '',
    previewError: '',
    previewBusy: false,
    message: '',
    busy: '',
    uncertain: false,
  };
}

test('printable chunks split without treating named or modified keys as text', () => {
  expect(keyEvents({ key: '/git' }).map((event) => event.key)).toEqual([
    '/',
    'g',
    'i',
    't',
  ]);
  expect(keyEvents({ key: '中文😀' }).map((event) => event.key)).toEqual([
    '中',
    '文',
    '😀',
  ]);
  for (const key of ['return', 'pageup', 'f12', 'escape']) {
    expect(keyEvents({ key })).toEqual([{ key }]);
  }
  expect(keyEvents({ key: 'u', ctrl: true })).toEqual([
    { key: 'u', ctrl: true },
  ]);
});

test('port snapshots can be deeply frozen without freezing the live draft', () => {
  const live = view();
  const snapshot = clientProps(live, 1, 0, 1, 60, 24);
  const freeze = (value: any) => {
    if (!value || typeof value !== 'object') return;
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  };
  freeze(snapshot);
  live.editor!.toggle('main', 'git');
  live.editor!.filter('main', 'git');
  expect(live.editor!.draft.display.items).toContain('git');
  expect(snapshot.view.editor!.draft.display.items).not.toContain('git');
  expect(snapshot.view.editor!.search.main).toBe('');
});

test('strict batches reject unbounded, malformed and non-increasing input', () => {
  const good = {
    epoch: 1,
    columns: 32,
    rows: 12,
    events: [{ seq: 1, event: { key: 'u', ctrl: true } }],
  };
  expect(parseBatch(good)).toEqual(good);
  for (const bad of [
    null,
    [],
    { ...good, extra: true },
    { ...good, epoch: -1 },
    { ...good, columns: 10001 },
    { ...good, events: Array(MAX_BATCH + 1).fill(good.events[0]) },
    { ...good, events: [...good.events, ...good.events] },
    { ...good, events: [{ seq: 1, event: { key: '\u001b' } }] },
    { ...good, events: [{ seq: 1, event: { key: 's', ctrl: false } }] },
    { ...good, events: [{ seq: 1, event: { key: 's', command: 'save' } }] },
  ])
    expect(parseBatch(bad)).toBeNull();
});

test('same-frame coalescing keeps every pending key; acknowledgements send the next bounded batch', () => {
  let stored: any;
  let listener!: (event: ClientKeyEvent) => void;
  const sent: any[] = [];
  const surface: ClientSurface<any> = {
    get state() {
      return stored;
    },
    setState: (next) => {
      stored = next;
    },
    columns: 60,
    rows: 24,
    elements: {
      Box: (props: any) => ({
        type: 'Box',
        props,
        children: props.children || [],
      }),
      Text: (props: any) => ({
        type: 'Text',
        props,
        children: props.children || [],
      }),
    } as any,
    onKey: (next) => {
      listener = next;
      return () => {};
    },
    onPointer: () => () => {},
    every: () => () => {},
    post: (data) => {
      sent.push(data);
    },
  };
  const live = view();
  const first = clientProps(live, 1, 0, 1, 60, 24);
  StatuslineClient(first, surface);
  for (let i = 0; i < 180; i++)
    listener({ key: String.fromCharCode(97 + (i % 26)) });
  expect(sent[sent.length - 1].events).toHaveLength(MAX_BATCH);
  expect(sent[sent.length - 1].events[0].seq).toBe(1);
  StatuslineClient(first, surface); // Old epochs cannot replace a recovered region.
  listener({ key: 's' });
  expect(sent[sent.length - 1].epoch).toBe(2);
  expect(sent[sent.length - 1].events[1].seq).toBe(2);
  StatuslineClient(clientProps(live, 1, MAX_BATCH, 2, 60, 24), surface);
  expect(sent[sent.length - 1].events).toHaveLength(52);
  expect(sent[sent.length - 1].events[0].seq).toBe(129);
  StatuslineClient(clientProps(live, 1, 180, 3, 60, 24), surface);
  StatuslineClient(first, surface); // A late older props delivery cannot rewind.
  listener({ key: 's' });
  expect(sent[sent.length - 1].events[0].seq).toBe(181);
  StatuslineClient(clientProps(live, 2, 0, 4, 60, 24), surface);
  listener({ key: 'q' });
  expect(sent[sent.length - 1].epoch).toBe(2);
  expect(sent[sent.length - 1].events[0].seq).toBe(1);
});
