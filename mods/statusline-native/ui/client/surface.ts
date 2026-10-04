import type { ClientSurface, RenderElement } from 'claude-code';
import type { ClientProps } from '../../lib/session.ts';
import { clientView } from '../../lib/session.ts';
import {
  keyEvents,
  MAX_BATCH,
  MAX_PENDING,
} from '../../lib/client/messages.ts';
import type { KeyMessage } from '../../lib/client/messages.ts';
import { draw } from './draw.ts';

interface State {
  epoch: number;
  next: number;
  pending: KeyMessage[];
  latest: ClientProps;
}

/** Surface input and drawing only: no process, filesystem or host API access. */
export default function StatuslineClient(
  props: ClientProps,
  surface: ClientSurface<State>,
): RenderElement {
  let state = surface.state;
  if (state && props.epoch < state.epoch) props = state.latest;
  if (!state || state.epoch !== props.epoch) {
    state = {
      epoch: props.epoch,
      next: props.ack + 1,
      pending: [],
      latest: props,
    };
    surface.setState(state);
  }
  const active = state;
  if (props.generation >= active.latest.generation) active.latest = props;
  active.next = Math.max(active.next, active.latest.ack + 1);
  active.pending = active.pending.filter(
    (item) => item.seq > active.latest.ack,
  );
  const post = () => {
    if (!active.pending.length) return;
    surface.post({
      epoch: active.epoch,
      columns: surface.columns || active.latest.columns,
      rows: surface.rows || active.latest.rows,
      events: active.pending.slice(0, MAX_BATCH).map(({ seq, event }) => ({
        seq,
        event: {
          key: event.key,
          ...(event.ctrl ? { ctrl: true } : {}),
          ...(event.shift ? { shift: true } : {}),
          ...(event.meta ? { meta: true } : {}),
        },
      })),
    });
  };
  surface.onKey((event) => {
    if (active.latest.view.busy || active.pending.length >= MAX_PENDING) return;
    for (const key of keyEvents(event)) {
      if (active.pending.length >= MAX_PENDING) break;
      active.pending.push({ seq: active.next++, event: key });
    }
    post();
  });
  // A post supersedes the previous one in the same frame. Each carries all
  // unacknowledged events; a fresh acknowledgement sends the next bounded batch.
  post();
  try {
    return draw(
      surface.elements,
      clientView(active.latest),
      surface.columns || active.latest.columns,
      surface.rows || active.latest.rows,
    );
  } catch (error) {
    surface.post({
      epoch: active.epoch,
      fault: String(error).slice(0, 200) || 'Client drawing failed',
    });
    return surface.elements.Text({
      children: ['Client failed. Use Retry or Close; received draft kept.'],
    });
  }
}
