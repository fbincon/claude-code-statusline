import { expect, test } from 'claude-code/testing';
import type { ProcessRunResult } from 'claude-code';
import { BASE, START, RUN, PANE, description, readResult, output, reply, sample } from './fixtures.ts';

test('the command requests focus and Esc close; toggles are transient', async ($, on) => {
  const opens: unknown[] = [];
  const processes: string[][] = [];
  const operations: string[] = [];
  on('session.start', () => ({ cwd: '/work' }));
  on('command.list', () => ({ value: [] }));
  on('command.register', () => ({ value: { command: 'statusline-configure-native' } }));
  on('ui.open', ($, e) => { opens.push(e); return { value: { isPlaced: true } }; });
  on('ui.close', () => ({ value: undefined }));
  on('env.get', ($, e) => ({ value: e.name === 'CLAUDE_CONFIG_DIR' ? '/tmp/config 中文 $`' : '/tmp/bin with spaces/claude-statusline' }));
  on('process.run', ($, e) => {
    processes.push([...e.argv]);
    expect(e.init?.timeoutMs).toBe(30000);
    const request = JSON.parse(e.init?.stdin || '{}');
    operations.push(request.operation);
    const result = request.operation === 'describe' ? description() : request.operation === 'read' ? readResult() :
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
  expect(operations.includes('apply')).toBe(false);
  await reopened.unmount();
});

test('backend failures are shown in the pane and reopening recovers', async ($, on) => {
  let failure: Error | ProcessRunResult | null = null;
  const processes: string[][] = [];
  on('session.start', () => ({ cwd: '/work' }));
  on('command.list', () => ({ value: [] }));
  on('command.register', () => ({ value: { command: RUN.command } }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('ui.close', () => ({ value: undefined }));
  on('env.get', () => ({ value: undefined }));
  on('process.run', ($, e) => {
    processes.push([...e.argv]);
    if (failure instanceof Error) return { deny: failure.message };
    if (failure) return { value: failure };
    const request = JSON.parse(e.init?.stdin || '{}');
    return { value: reply(request.operation === 'describe' ? description() :
      request.operation === 'read' ? readResult() : sample('recovered sample')) };
  });
  await $.session.start(START);
  const cases = [
    { failure: new Error('spawn ENOENT'), message: 'spawn ENOENT' },
    { failure: new Error('Process timed out'), message: 'Process timed out' },
    { failure: output('old CLI usage', 2), message: 'exited with status 2' },
    { failure: output('{'), message: 'complete JSON' },
    { failure: output(JSON.stringify({ protocol_version: 2, result: {} })), message: 'protocol versions' },
  ];
  for (const item of cases) {
    failure = item.failure;
    await $.command.run(RUN);
    const ui = await $.ui.mount(PANE);
    expect(await ui.find({ type: 'Text', text: item.message })).toBeDefined();
    expect(await ui.find({ key: 'colors' })).toBeUndefined();
    await ui.press({ key: 'close' });
    await ui.unmount();
  }
  expect(processes[0]).toEqual(['claude-statusline', 'ui']);
  failure = null;
  await $.command.run(RUN);
  const recovered = await $.ui.mount(PANE);
  expect((await recovered.find({ key: 'colors' }))?.props.label).toBe('Colors: on');
  expect(await recovered.find({ type: 'Text', text: 'recovered sample' })).toBeDefined();
  await recovered.unmount();
});

test('a failed preview retries the same draft without rereading or saving', async ($, on) => {
  const operations: string[] = [];
  let previewRequests = 0;
  on('session.start', () => ({ cwd: '/work' }));
  on('command.list', () => ({ value: [] }));
  on('command.register', () => ({ value: { command: RUN.command } }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('env.get', () => ({ value: undefined }));
  on('process.run', ($, e) => {
    const request = JSON.parse(e.init?.stdin || '{}');
    operations.push(request.operation);
    if (request.operation === 'preview' && ++previewRequests === 1) return { deny: 'Preview timed out' };
    return { value: reply(request.operation === 'describe' ? description() :
      request.operation === 'read' ? readResult() : sample('preview recovered')) };
  });
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  expect(await ui.find({ type: 'Text', text: 'Preview timed out' })).toBeDefined();
  await ui.press({ key: 'retry' });
  expect(await ui.find({ type: 'Text', text: 'preview recovered' })).toBeDefined();
  expect(operations).toEqual(['describe', 'read', 'preview', 'preview']);
  expect((await ui.find({ key: 'colors' }))?.props.label).toBe('Colors: on');
  await ui.unmount();
});

test('an older preview cannot replace the result for the current width', async ($, on) => {
  let resolveOld!: (value: ProcessRunResult) => void;
  let started!: () => void;
  const oldStarted = new Promise<void>(resolve => { started = resolve; });
  const old = new Promise<ProcessRunResult>(resolve => { resolveOld = resolve; });
  on('session.start', () => ({ cwd: '/work' }));
  on('command.list', () => ({ value: [] }));
  on('command.register', () => ({ value: { command: RUN.command } }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('env.get', () => ({ value: undefined }));
  on('process.run', async ($, e) => {
    const request = JSON.parse(e.init?.stdin || '{}');
    if (request.operation === 'preview' && request.payload.width === 40) {
      started();
      return { value: await old };
    }
    return { value: reply(request.operation === 'describe' ? description() :
      request.operation === 'read' ? readResult() : sample('current width ' + request.payload.width)) };
  });
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  const older = ui.redraw({ ...PANE.props, bodyColumns: 40 });
  await oldStarted;
  await ui.redraw({ ...PANE.props, bodyColumns: 30 });
  resolveOld(reply(sample('stale width 40')));
  await older;
  expect(await ui.find({ type: 'Text', text: 'current width 30' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: 'stale width 40' })).toBeUndefined();
  await ui.unmount();
});

test('a read finishing after close cannot restore a discarded draft', async ($, on) => {
  let finish!: (value: ProcessRunResult) => void;
  let started!: () => void;
  const readStarted = new Promise<void>(resolve => { started = resolve; });
  const delayed = new Promise<ProcessRunResult>(resolve => { finish = resolve; });
  on('session.start', () => ({ cwd: '/work' }));
  on('command.list', () => ({ value: [] }));
  on('command.register', () => ({ value: { command: RUN.command } }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('ui.close', () => ({ value: undefined }));
  on('env.get', () => ({ value: undefined }));
  on('process.run', async ($, e) => {
    const request = JSON.parse(e.init?.stdin || '{}');
    if (request.operation === 'read') { started(); return { value: await delayed }; }
    return { value: reply(description()) };
  });
  await $.session.start(START);
  const opening = $.command.run(RUN);
  await readStarted;
  const ui = await $.ui.mount(PANE);
  await ui.press({ key: 'close' });
  finish(reply(readResult(BASE)));
  await opening;
  await ui.redraw();
  expect(await ui.find({ key: 'colors' })).toBeUndefined();
  await ui.unmount();
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
