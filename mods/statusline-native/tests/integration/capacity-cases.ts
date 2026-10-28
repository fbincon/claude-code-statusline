import { expect, test } from 'claude-code/testing';
import { clientProps } from '../../lib/session.ts';
import { withinBudget, frameTree } from '../../ui/frame.ts';
import { CAPACITY_DESCRIPTION, CAPACITY_CASES } from '../generated-capacity-fixtures.ts';
import { capacityView } from '../capacity-fixtures.ts';
import { PANE } from '../fixtures.ts';

export function registerCapacityCases(start:number,end:number):void {
const selected=CAPACITY_CASES.slice(start,end);
for (const value of selected.filter(value => value.name !== 'extreme-10000x10000')) {
  test('production capacity / ' + value.name, { timeoutMs: 20000 }, async ($, on) => {
    const view = capacityView(value), before = JSON.stringify(view.editor), snapshot = clientProps(view, 1, 0, 1, value.columns, value.rows);
    expect(JSON.stringify(CAPACITY_DESCRIPTION).length > 70000).toBe(true);
    expect(withinBudget(snapshot)).toBe(true);
    expect(withinBudget(frameTree(snapshot.frame))).toBe(true);
    expect(Object.keys(snapshot)).not.toContain('view');
    const ui = await $.ui.mount({ ...PANE, requestId: 'capacity-fixture', viewport: { columns: value.columns + 28, rows: value.rows + 6 }, props: { ...PANE.props, bodyColumns: value.columns, scroll: { offset: 0, bodyRows: value.rows }, title: 'capacity:' + CAPACITY_CASES.indexOf(value) } });
    expect(await ui.find({ key: 'capacity-client' })).toBeDefined();
    expect((await ui.findAll({ in: 'capacity-client', type: 'Text' })).length > 5).toBe(true);
    await ui.key({ in: 'capacity-client', key: 'down' });
    const reply = (await ui.find({ key: 'capacity-client' }))!.props.props as { ack: number };
    expect(reply.ack).toBe(1);
    expect((await ui.findAll({ in: 'capacity-client', type: 'Text' })).length > 5).toBe(true);
    expect(JSON.stringify(view.editor)===before).toBe(true);
    await ui.unmount();
  });
}

if(selected.some(value=>value.name==='extreme-10000x10000'))test('extreme geometry reduces presentation without changing the draft or colors', () => {
  const value = CAPACITY_CASES.find(value => value.name === 'extreme-10000x10000')!;
  const view = capacityView(value), before = JSON.stringify(view);
  const projected = clientProps(view, 1, 0, 1, value.columns, value.rows);
  expect(projected.displayColumns < value.columns || projected.displayRows < value.rows).toBe(true);
  expect(withinBudget(projected)).toBe(true);
  expect(withinBudget(frameTree(projected.frame))).toBe(true);
  expect(projected.frame.some(node => typeof node[1].color === 'string' && node[1].color.startsWith('#'))).toBe(true);
  expect(JSON.stringify(view)===before).toBe(true);
});

}
