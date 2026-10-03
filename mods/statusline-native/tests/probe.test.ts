import { expect, test } from 'claude-code/testing';
import { MAIN_ITEM_IDS, SUBAGENT_ITEM_IDS } from '../lib/generated-contracts.ts';
import type { Draft } from '../lib/generated-contracts.ts';

const BASE: Draft = { display: { schema_version: 2, items: ['model-with-effort'], use_colors: true,
  palette: 'default', directory_style: 'full', separator_style: 'classic', scope_labels: 'when-subagents',
  subagents: { enabled: true, items: ['status-elapsed', 'name'] } },
  host: { padding: 0, refresh_interval: 1, hide_vim_mode_indicator: false } };

const START = { surface: 'terminal', isInteractive: true, cwd: '/work' } as const;
const RUN = { command: 'statusline-configure-native', args: '', origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 100 } } as const;
const PANE = { plugin: 'statusline-native', surface: 'terminal', component: 'Pane',
  requestId: 'statusline-native', viewport: { columns: 100, rows: 30 },
  props: { title: 'Probe', isFocused: true, bodyColumns: 60, placement: 'inline',
    scroll: { offset: 0, bodyRows: 10 }, view: {} } } as const;

test('the command requests focus and Esc close; toggles are transient', async ($, on) => {
  const opens: unknown[] = [];
  const processes: string[][] = [];
  on('session.start', () => ({ cwd: '/work' }));
  on('command.list', () => ({ value: [] }));
  on('command.register', () => ({ value: { command: 'statusline-configure-native' } }));
  on('ui.open', ($, e) => { opens.push(e); return { value: { isPlaced: true } }; });
  on('ui.close', () => ({ value: undefined }));
  on('env.get', ($, e) => ({ value: e.name === 'CLAUDE_CONFIG_DIR' ? '/tmp/config 中文 $`' : '/tmp/bin with spaces/claude-statusline' }));
  on('process.run', ($, e) => {
    processes.push([...e.argv]);
    const request = JSON.parse(e.init?.stdin || '{}');
    const result = request.operation === 'describe' ? { backend_version: 'test', operations: ['describe', 'read', 'preview'], options: {}, capabilities: {},
      catalog: [...MAIN_ITEM_IDS.map(id => ({ id, scope: 'main', label: id, description: id, default_enabled: false, excludes: [] })),
        ...SUBAGENT_ITEM_IDS.map(id => ({ id, scope: 'subagent', label: id, description: id, default_enabled: false, excludes: [] }))] } :
      request.operation === 'read' ? { backend_version: 'test', draft: BASE, revision: '0'.repeat(64), installed: true, installation: {}, capabilities: {} } :
      { sample: true, main: [[{ text: 'sample', bold: request.payload.draft.display.use_colors, foreground: null }]], subagents: [] };
    return { value: { exitCode: 0, stdout: JSON.stringify({ protocol_version: 1, result }), stderr: '',
      isStdoutTruncated: false, isStderrTruncated: false } };
  });
  await $.session.start(START);
  await $.command.run(RUN);
  expect(opens[0]).toEqual({ id: 'statusline-native', title: 'Statusline native probe', focus: true, closeOnEscape: true });
  const ui = await $.ui.mount(PANE);
  expect((await ui.find({ key: 'colors' }))?.props.label).toBe('Colors: on');
  expect(processes[0]).toEqual(['/tmp/bin with spaces/claude-statusline', 'ui', '--config-dir', '/tmp/config 中文 $`']);
  const beforeRedraw = processes.length;
  await ui.redraw(PANE.props);
  expect(processes.length).toBe(beforeRedraw);
  await ui.press({ key: 'colors' });
  expect((await ui.find({ key: 'colors' }))?.props.label).toBe('Colors: off');
  await ui.press({ key: 'close' });
  await ui.unmount();
  await $.command.run(RUN);
  const reopened = await $.ui.mount(PANE);
  expect((await reopened.find({ key: 'colors' }))?.props.label).toBe('Colors: on');
  await reopened.unmount();
});

test('a command collision passes through without registering or opening', async ($, on) => {
  let registered = false;
  on('session.start', () => ({ cwd: '/work' }));
  on('command.list', () => ({ value: [{ name: 'statusline-configure-native', description: 'Foreign', source: 'plugin', plugin: 'other' }] }));
  on('command.register', () => { registered = true; return { value: { command: RUN.command } }; });
  on('ui.log', () => ({ value: undefined }));
  on('command.run', () => ({ text: 'foreign command' }));
  await $.session.start(START);
  expect((await $.command.run(RUN)).text).toBe('foreign command');
  expect(registered).toBe(false);
});

test('another pane is passed through', async ($, on) => {
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['foreign pane'] }));
  const ui = await $.ui.mount({ ...PANE, requestId: 'foreign' });
  expect(await ui.find({ type: 'Text', text: 'foreign pane' })).toBeDefined();
  await ui.unmount();
});
