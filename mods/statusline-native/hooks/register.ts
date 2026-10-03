import type { Register, EngineInterface } from 'claude-code';
import { parseResponse, processFailure, requestText, spanColor } from '../lib/backend.ts';
import { copyDraft } from '../lib/draft.ts';
import type { Draft, Operation, PreviewResult, ResultFor } from '../lib/generated-contracts.ts';

const PANE = 'statusline-native';
const COMMAND = 'statusline-configure-native';

async function callBackend<O extends Operation>($: EngineInterface, operation: O, payload: unknown = {}): Promise<ResultFor<O>> {
  try {
    const executable = await $.env.get('CLAUDE_STATUSLINE_NATIVE_EXECUTABLE') || 'claude-statusline';
    const directory = await $.env.get('CLAUDE_CONFIG_DIR');
    const argv = directory ? [executable, 'ui', '--config-dir', directory] : [executable, 'ui'];
    const output = await $.process.run(argv, { stdin: requestText(operation, payload), timeoutMs: 30000 });
    return parseResponse(operation, output);
  } catch (error) {
    throw processFailure(error);
  }
}

export const register: Register = (on) => {
  let ownsCommand = false;
  let draft: Draft | null = null;
  let preview: PreviewResult | null = null;
  let error: string | null = null;
  let epoch = 0;
  let previewKey = '';
  let catalogCount = 0;

  const discardDraft = () => {
    epoch += 1;
    draft = null;
    preview = null;
    previewKey = '';
    error = null;
  };

  on('session.start', async ($, e, next) => {
    ownsCommand = false;
    discardDraft();
    error = 'Close and reopen /statusline-configure-native to load a fresh draft.';
    const commands = await $.command.list();
    const collision = commands.find(command => command.name === COMMAND);
    if (collision && collision.plugin !== 'statusline-native') {
      $.ui.log('/statusline-configure-native already belongs to another command; the probe is inactive.');
      return next(e);
    }
    await $.command.register({ name: 'statusline-configure-native', description: 'Open the experimental statusline integration probe' });
    ownsCommand = true;
    return next(e);
  });

  on('command.run', { command: 'statusline-configure-native' }, async ($, e, next) => {
    if (!ownsCommand) return next(e);
    const opening = ++epoch;
    draft = null;
    preview = null;
    error = null;
    previewKey = '';
    const opened = await $.ui.open({ id: PANE, title: 'Statusline native probe', focus: true, closeOnEscape: true });
    if (!opened.isPlaced) return { text: opened.reason };
    try {
      const description = await callBackend($, 'describe');
      const current = await callBackend($, 'read');
      if (epoch !== opening) return {};
      catalogCount = description.catalog.length;
      draft = copyDraft(current.draft);
    } catch (failure) {
      if (epoch !== opening) return {};
      error = failure instanceof Error ? failure.message : 'Backend failure';
    }
    $.ui.invalidate('ui.render');
    return {};
  });

  on('ui.close', { id: 'statusline-native' }, ($, e, next) => {
    discardDraft();
    return next(e);
  });

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE || !ownsCommand) return next(e);
    const { Box, Text, Button } = $.ui.resolve(e);
    const width = Math.max(2, Math.min(10000, e.props.bodyColumns));
    const key = `${epoch}:${width}`;
    if (draft && previewKey !== key) {
      previewKey = key;
      const requestedEpoch = epoch;
      try {
        const rendered = await callBackend($, 'preview', { draft: copyDraft(draft), width });
        if (epoch === requestedEpoch && previewKey === key) { preview = rendered; error = null; }
      } catch (failure) {
        if (epoch === requestedEpoch && previewKey === key) {
          preview = null;
          error = failure instanceof Error ? failure.message : 'Preview failure';
        }
      }
    }
    return Box({ flexDirection: 'column', children: [
      Text({ children: ['Statusline native integration probe'] }),
      Text({ children: ['Draft only. Esc closes the pane; nothing is saved.'] }),
      ...(draft ? [
        Text({ children: [`Shared catalog: ${catalogCount} scoped items`] }),
        Button({ key: 'colors', label: `Colors: ${draft.display.use_colors ? 'on' : 'off'}`, hotkey: 'c', onPress: () => {
          if (!draft) return;
          draft.display.use_colors = !draft.display.use_colors;
          epoch += 1;
          $.ui.invalidate('ui.render');
        } }),
      ] : []),
      ...(error ? [Text({ color: 'red', children: [error] })] : []),
      ...(error && draft ? [Button({ key: 'retry', label: 'Retry preview', onPress: () => {
        previewKey = ''; $.ui.invalidate('ui.render');
      } })] : []),
      ...(!draft && !error ? [Text({ children: ['Loading backend...'] })] : []),
      ...(preview ? [Text({ children: ['Sample preview'] }), ...preview.main.map(row => Box({ flexDirection: 'row', children:
        row.map(span => Text({ bold: span.bold, color: spanColor(span), children: [span.text] })) }))] : []),
      Button({ key: 'close', label: 'Close', hotkey: 'q', onPress: async () => {
        discardDraft();
        await $.ui.close({ id: PANE });
      } }),
    ] });
  });
};
