/** Dedicated acceptance Mod entry, installed only in a disposable test copy. */
import type { Register } from 'claude-code';
import { clientProps } from '../lib/session.ts';
import type { View } from '../lib/session.ts';
import { parseBatch } from '../lib/client/messages.ts';
import { CAPACITY_CASES } from './generated-capacity-fixtures.ts';
import { capacityView } from './capacity-fixtures.ts';

export const register: Register = on => {
  let view: View | null = null, index = -1, ack = 0, generation = 0;
  on('ui.render', { component: 'Pane', requestId: 'capacity-fixture' }, ($, e) => {
    if (e.surface !== 'terminal') throw new Error('Terminal fixture required');
    const requested = Number(e.props.title.slice('capacity:'.length));
    if (!Number.isInteger(requested) || !CAPACITY_CASES[requested]) throw new Error('Unknown capacity case');
    if (requested !== index) { index = requested; view = capacityView(CAPACITY_CASES[index]!); ack = 0; }
    const value = CAPACITY_CASES[index]!;
    return $.ui.resolve(e).Client({ key: 'capacity-client', module: '../ui/client/surface.ts', width: value.columns, height: value.rows,
      props: clientProps(view!, 1, ack, ++generation, value.columns, value.rows) });
  });
  on('ui.message', { requestId: 'capacity-fixture' }, ($, e) => {
    const batch = parseBatch(e.data);
    if (!batch || !view) throw new Error('Unexpected Client failure or invalid input: ' + JSON.stringify(e.data));
    ack = Math.max(ack, ...batch.events.map(item => item.seq));
    const value = CAPACITY_CASES[index]!;
    $.ui.invalidate('ui.render');
    return { props: clientProps(view, 1, ack, ++generation, value.columns, value.rows) };
  });
};
