import { t } from '../../lib/i18n/index.ts';
import type { ClientSurface, RenderElement } from 'claude-code';
import type { ClientProps } from '../../lib/session.ts';
import { drawFrame, withinBudget, CapacityError } from '../frame.ts';
import {
  keyEvents,
  MAX_BATCH,
  MAX_PENDING,
  MAX_PENDING_TEXT,
} from '../../lib/client/messages.ts';
import type { KeyMessage } from '../../lib/client/messages.ts';
import { styles } from '../theme.ts';

interface State {
  epoch: number;
  next: number;
  pending: KeyMessage[];
  latest: ClientProps;
  viewportSent: string;
}

/** Surface input and drawing only: no process, filesystem or host API access. */
export default function StatuslineClient(
  props: ClientProps,
  surface: ClientSurface<State>,
): RenderElement {
  const tr = (key: string) => t(key, props.language);
  let state = surface.state;
  if (state && props.epoch < state.epoch) props = state.latest;
  if (!state || state.epoch !== props.epoch) {
    state = {
      epoch: props.epoch,
      next: props.ack + 1,
      pending: [],
      latest: props,
      viewportSent: '',
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
    const columns = surface.columns || active.latest.columns;
    const rows = surface.rows || active.latest.rows;
    const viewport = columns + ':' + rows;
    const changed = columns !== active.latest.columns || rows !== active.latest.rows;
    if (!active.pending.length && (!changed || active.viewportSent === viewport)) return;
    active.viewportSent = viewport;
    let budget=48000;
    const batch: KeyMessage[]=[];
    for(const item of active.pending.slice(0,MAX_BATCH)) {
      const size=JSON.stringify(item).length;
      if(size>budget) break;
      budget-=size;batch.push(item);
    }
    surface.post({
      epoch: active.epoch,
      columns,
      rows,
      events: batch.map(({ seq, event }) => ({
        seq,
        event: {
          key: event.key,
          ...(event.ctrl ? { ctrl: true } : {}),
          ...(event.shift ? { shift: true } : {}),
          ...(event.meta ? { meta: true } : {}),
          ...(event.text ? { text: true } : {}),
          ...(event.overflow ? { overflow: true } : {}),
        },
      })),
    });
  };
  surface.onKey((event) => {
    if (active.latest.busy) return;
    if (active.pending.length >= MAX_PENDING || active.pending.reduce((sum,item)=>sum+item.event.key.length,0)+event.key.length>MAX_PENDING_TEXT) {
      if (!active.pending.some(item => item.event.overflow)) active.pending.push({seq: active.next++, event: {key: 'input-overflow', overflow: true}});
      post(); return;
    }
    for (const key of keyEvents(event)) {
      active.pending.push({ seq: active.next++, event: key });
    }
    post();
  });
  // A post supersedes the previous one in the same frame. Each carries all
  // unacknowledged events; a fresh acknowledgement sends the next bounded batch.
  post();
  try {
    const tree = drawFrame(surface.elements, active.latest.frame);
    if (!withinBudget(tree)) throw new CapacityError();
    return tree;
  } catch (error) {
    surface.post({
      epoch: active.epoch,
      fault: String(error).slice(0, 200) || 'Client drawing failed',
    });
    return surface.elements.Text({
      ...styles.text,
      children: [tr("native.ui.client.surface.client_failed_use_retry_or_close_received_draft")],
    });
  }
}
