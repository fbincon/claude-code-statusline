import type { Actions, Controls } from '../controls.ts';
import { pageWindow } from '../../lib/editor/navigation.ts';

export function pagination(
  ui: Controls,
  keys: string[],
  selected: string,
  capacity: number,
  actions: Actions,
) {
  const window = pageWindow(keys, selected, capacity);
  return ui.Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      ui.Button({
        key: 'previous',
        label: 'Prev',
        plain: true,
        hotkey: 'p',
        onPress: () => actions.paginate(-1),
      }),
      ui.Button({
        key: 'next',
        label: 'Next',
        plain: true,
        hotkey: 'n',
        onPress: () => actions.paginate(1),
      }),
      ui.Text({ dimColor: true, children: [`${window.page}/${window.pages}`] }),
    ],
  });
}
