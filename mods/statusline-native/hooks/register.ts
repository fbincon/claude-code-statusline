import type { Register } from 'claude-code';
import { createDraft } from '../lib/draft.ts';

const PANE = 'statusline-native';
const COMMAND = 'statusline-configure-native';

export const register: Register = (on) => {
  let ownsCommand = false;
  let draft = createDraft();

  on('session.start', async ($, e, next) => {
    ownsCommand = false;
    const commands = await $.command.list();
    const collision = commands.find(command => command.name === COMMAND);
    if (collision && collision.plugin !== 'statusline-native') {
      $.ui.log('/statusline-configure-native already belongs to another command; the probe is inactive.');
      return next(e);
    }
    await $.command.register({
      name: 'statusline-configure-native',
      description: 'Open the experimental statusline integration probe',
    });
    ownsCommand = true;
    return next(e);
  });

  on('command.run', { command: 'statusline-configure-native' }, async ($, e, next) => {
    if (!ownsCommand) return next(e);
    draft = createDraft();
    const opened = await $.ui.open({ id: PANE, title: 'Statusline native probe', focus: true, closeOnEscape: true });
    if (!opened.isPlaced) return { text: opened.reason };
    return {};
  });

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    if (e.requestId !== PANE || !ownsCommand) return next(e);
    const { Box, Text, Button } = $.ui.resolve(e);
    return Box({
      flexDirection: 'column',
      children: [
        Text({ children: ['Statusline native integration probe'] }),
        Text({ children: ['Draft only. Esc closes the pane; nothing is saved.'] }),
        Button({
          key: 'colors', label: `Colors: ${draft.colors ? 'on' : 'off'}`, hotkey: 'c',
          onPress: () => { draft.colors = !draft.colors; $.ui.invalidate('ui.render'); },
        }),
        Text({ bold: draft.colors, color: draft.colors ? 'green' : undefined,
          children: ['claude-opus high | sample-project | Context 73% left'] }),
        Button({ key: 'close', label: 'Close', hotkey: 'q', onPress: async () => {
          draft = createDraft();
          await $.ui.close({ id: PANE });
        } }),
      ],
    });
  });
};
