import type { AgentInfo, On, RenderInput } from 'claude-code';
import { expect, mock, test } from 'claude-code/testing';

const OPTIONS = { options: {
  backendExecutable: '/node with spaces/node', backendArgs: '["/entry 中文 & $`/main.js"]',
  configDir: '/different', backendVersion: 'test-version', installationId: 'test-installation',
} };
const START = { surface: 'terminal' as const, isInteractive: true, cwd: '/project' };
type Row = RenderInput<'AgentRow', 'terminal'>;
type Mode = 'mod' | 'standby' | 'pass';
interface Request {
  argv: readonly string[]; operation: string; data: {
    protocol: number; session_id: string; cwd: string; host_version: string; backend_version: string; installation_id: string;
    confirmation?: string; columns?: number; tasks?: { id: string; [key: string]: unknown }[];
  };
}
function agent(id: string, extra: Partial<AgentInfo> = {}): AgentInfo {
  return { id, description: 'Test', label: '文件', type: 'Explore', kind: 'local_agent', status: 'running',
    taskStatus: 'running', startTime: 100, tokenCount: 900, tokenSamples: [900], cwd: '/worktree', hasRow: true, ...extra };
}
function event(item: AgentInfo, rowIds: string[], extra: Partial<Row['props']> = {}): Row {
  return { component: 'AgentRow', surface: 'terminal', requestId: item.id,
    props: { ...item, columns: 42, rowIds, isHidden: false, ...extra } };
}
function setup(on: On) {
  const clock = mock.clock(on, { now: 1000 });
  mock.env(on, { CLAUDE_CONFIG_DIR: '/config 中文' });
  const parent = agent('a', { name: '父', model: 'sonnet', effort: 'high', contextWindowSize: 200000 });
  const child = agent('b', { parentId: 'a', status: 'waiting', taskStatus: 'completed' });
  const grandchild = agent('c', { parentId: 'b' });
  const controls = {
    mode: 'mod' as Mode, confirmation: undefined as string | undefined, session: 'session-1',
    loadedMode: undefined as Mode | undefined, readyMode: 'mod' as Mode,
    agents: [parent, child, grandchild], body: (id: string): string | undefined => id === 'b' ? '' : '中文 ' + id,
    batch: undefined as ((req: Request) => Promise<string> | string) | undefined,
    calls: [] as Request[], draws: [] as Row['props'][], invalidations: 0,
  };
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('session.end', ($, e) => ({ sessionId: e.sessionId }));
  on('session.id', () => ({ value: controls.session }));
  on('session.cwd', () => ({ value: '/project' }));
  on('session.version', () => ({ value: { version: '2.1.332' } }));
  on('agent.list', () => ({ value: controls.agents }));
  on('ui.invalidate', () => { controls.invalidations++; return { value: undefined }; });
  on('ui.render', { component: 'AgentRow' }, ($, e) => {
    controls.draws.push(e.props);
    return { type: 'Text', props: {}, children: [e.props.body ?? 'host'] };
  });
  on('process.run', async ($, e) => {
    const operation = e.argv.find(arg => arg.startsWith('--agent-row-'))!.slice('--agent-row-'.length);
    const req: Request = { argv: e.argv, operation, data: JSON.parse(e.init?.stdin ?? '{}') };
    controls.calls.push(req);
    const stdout = operation === 'batch' && controls.batch ? await controls.batch(req) : JSON.stringify({
      protocol: 1, mode: operation === 'ready' ? controls.readyMode : operation === 'loaded' ? controls.loadedMode ?? controls.mode : controls.mode,
      ...(operation === 'batch' ? { confirmation: controls.confirmation } : {}),
      rows: operation === 'batch' ? req.data.tasks!.map(t => ({ id: t.id, body: controls.body(t.id) })) : [],
    });
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } };
  });
  return { clock, controls, parent, child, grandchild };
}

test('batches concurrent rows in host order and computes per-level budgets with the classic fields', OPTIONS, async ($, on) => {
  const { controls, parent, child, grandchild } = setup(on);
  await $.session.start(START);
  const ids = ['b', 'a', 'c'];
  await Promise.all([$.ui.render(event(grandchild, ids)), $.ui.render(event(parent, ids)), $.ui.render(event(child, ids))]);
  expect(controls.calls.map(c => c.operation)).toEqual(['loaded', 'batch']);
  const batch = controls.calls[1]!;
  expect(batch.argv).toEqual(['/node with spaces/node', '/entry 中文 & $`/main.js', 'render-subagents', '--agent-row-batch', '--config-dir', '/config 中文']);
  expect([batch.data.protocol, batch.data.session_id, batch.data.cwd, batch.data.host_version, batch.data.backend_version, batch.data.installation_id])
    .toEqual([1, 'session-1', '/project', '2.1.332', 'test-version', 'test-installation']);
  const tasks = batch.data.tasks!;
  expect(tasks.map(t => [t.id, t._row_columns])).toEqual([['b', 40], ['a', 42], ['c', 38]]);
  expect([tasks[0]!.type, tasks[0]!.agentType, tasks[0]!.status]).toEqual(['local_agent', 'Explore', 'completed']);
  expect('model' in tasks[0]!).toBe(false);
  expect([tasks[1]!.model, tasks[1]!.effort, tasks[1]!.tokenCount, tasks[1]!.contextWindowSize, tasks[1]!.cwd])
    .toEqual(['sonnet', 'high', 900, 200000, '/worktree']);
  expect(controls.draws.find(p => p.id === 'b')?.isHidden).toBe(true);
  expect(controls.draws.find(p => p.id === 'a')?.body).toBe('中文 a');
  await $.ui.render(event(parent, ids, { columns: 2 }));
  expect(controls.calls.at(-1)?.data.tasks?.map(t => t._row_columns)).toEqual([0, 2, 0]);
  await $.ui.render(event(parent, ['a'], { columns: 0 }));
  expect(controls.calls.at(-1)?.data.columns).toBe(0);
  await $.ui.render(event(parent, ['a'], { columns: undefined }));
  expect(controls.calls.at(-1)?.data.columns).toBe(80);
});

test('passes pre-existing bodies, hidden rows, missing bodies, disabled mode, and unsupported surfaces through', OPTIONS, async ($, on) => {
  const { controls, parent } = setup(on);
  await $.session.start(START);
  await $.ui.render(event(parent, ['a'], { body: 'foreign' }));
  await $.ui.render(event(parent, ['a'], { body: '', isHidden: true }));
  await $.ui.render(event(parent, ['a'], { isHidden: true }));
  expect(controls.draws.map(p => [p.body, p.isHidden])).toEqual([['foreign', false], ['', true], [undefined, true]]);
  controls.body = () => undefined;
  await $.ui.render(event(parent, ['a'], { columns: 20 }));
  expect(controls.draws.at(-1)?.body).toBeUndefined();
  controls.mode = 'pass';
  controls.body = () => 'ignore';
  await $.ui.render(event(parent, ['a'], { columns: 21 }));
  expect(controls.draws.at(-1)?.body).toBeUndefined();
  const count = controls.calls.length;
  await $.ui.render({ ...event(parent, ['a']), surface: 'vscode' });
  await $.ui.render(event(parent, ['not-this-row']));
  expect(controls.calls.length).toBe(count);
});

test('a real standby row, including a hidden result, passes through before lifecycle confirmation', OPTIONS, async ($, on) => {
  const { clock, controls, child } = setup(on);
  controls.mode = 'standby'; controls.confirmation = 'proof';
  await $.session.start(START);
  await $.session.start(START);
  await clock.advance(1);
  expect(controls.calls.map(c => c.operation)).toEqual(['loaded']);
  await $.ui.render(event(child, ['b'], { body: 'old command' }));
  expect(controls.draws.at(-1)?.body).toBe('old command');
  expect(controls.calls.map(c => c.operation)).toEqual(['loaded', 'batch']);
  await clock.advance(1);
  expect(controls.calls.map(c => c.operation)).toEqual(['loaded', 'batch', 'ready']);
  const ack = controls.calls.at(-1)!;
  expect(ack.data.confirmation).toBe('proof');
  expect(ack.data.session_id).toBe('session-1');
  await $.ui.render(event(child, ['b'], { body: 'old command' }));
  await clock.advance(1);
  expect(controls.calls.filter(c => c.operation === 'ready').length).toBe(1);
});

test('hot load is scheduled outside paint; invalid output, missing roster and unavailable proof preserve the row', OPTIONS, async ($, on) => {
  const { clock, controls, parent } = setup(on);
  await $.ui.render(event(parent, ['a']));
  expect(controls.calls.length).toBe(0);
  expect(controls.draws.at(-1)?.body).toBeUndefined();
  await clock.advance(1);
  expect(controls.calls.map(c => c.operation)).toEqual(['loaded']);
  controls.batch = () => '{"protocol":1,"mode":"mod","confirmation":"bad","rows":[{"id":"else","body":"wrong"}]}';
  await $.ui.render(event(parent, ['a']));
  await $.ui.render(event(parent, ['a']));
  expect(controls.calls.map(c => c.operation)).toEqual(['loaded', 'batch']);
  expect(controls.draws.at(-1)?.body).toBeUndefined();
  controls.batch = undefined;
  await clock.advance(5000);
  await $.ui.render(event(parent, ['a']));
  expect(controls.draws.at(-1)?.body).toBe('中文 a');
  await $.ui.render(event(parent, ['a','unseen']));
  expect(controls.draws.at(-1)?.body).toBeUndefined();
  expect(controls.calls.filter(c => c.operation === 'ready').length).toBe(0);
});

test('an old in-flight width cannot replace a new frame or confirm an earlier candidate', OPTIONS, async ($, on) => {
  const { clock, controls, parent } = setup(on);
  await $.session.start(START);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  controls.batch = async () => {
    await pending;
    return '{"protocol":1,"mode":"mod","confirmation":"old","rows":[{"id":"a","body":"stale"}]}';
  };
  const first = $.ui.render(event(parent, ['a']));
  await clock.settle();
  expect(controls.calls.at(-1)?.operation).toBe('batch');
  const second = $.ui.render(event(parent, ['a'], { columns: 24 }));
  await clock.settle();
  release();
  await Promise.all([first, second]);
  expect(controls.draws.some(p => p.body === 'stale')).toBe(false);
  controls.batch = undefined;
  await $.ui.render(event(parent, ['a'], { columns: 24 }));
  await clock.advance(1);
  expect(controls.draws.at(-1)?.body).toBe('中文 a');
  expect(controls.calls.filter(c => c.operation === 'ready').length).toBe(0);
});

test('ending a session cancels timers and old proof; a new session independently loads', OPTIONS, async ($, on) => {
  const { clock, controls, parent } = setup(on);
  await $.session.start(START);
  controls.confirmation = 'abandoned'; controls.mode = 'standby';
  await $.ui.render(event(parent, ['a']));
  await $.session.end({ sessionId: controls.session, resume: { id: controls.session }, reason: 'other' });
  await clock.advance(5000);
  await $.ui.render(event(parent, ['a']));
  expect(controls.calls.map(c => c.operation)).toEqual(['loaded','batch']);
  controls.session = 'session-2';
  await $.session.start(START);
  expect(controls.calls.at(-1)?.data.session_id).toBe('session-2');
  expect(controls.calls.at(-1)?.operation).toBe('loaded');
});

test('transient pass replies do not mark loading or automatic handoff successful', OPTIONS, async ($, on) => {
  const { clock, controls, parent } = setup(on);
  controls.loadedMode = 'pass';
  await $.session.start(START);
  controls.loadedMode = 'standby'; controls.mode = 'standby'; controls.readyMode = 'pass';
  controls.confirmation = 'same-proof';
  await $.ui.render(event(parent, ['a'], { body: 'legacy' }));
  expect(controls.draws.at(-1)?.body).toBe('legacy');
  await clock.advance(1);
  await $.ui.render(event(parent, ['a'], { body: 'legacy' }));
  await clock.advance(1);
  expect(controls.calls.map(c => c.operation)).toEqual(['loaded','loaded','batch','ready']);
  await $.ui.render(event(parent, ['a'], { body: 'legacy' }));
  await clock.advance(1);
  expect(controls.calls.filter(c => c.operation === 'ready').length).toBe(1);
  controls.readyMode = 'mod';
  await clock.advance(5000);
  await $.ui.render(event(parent, ['a'], { body: 'legacy' }));
  await clock.advance(1);
  expect(controls.calls.filter(c => c.operation === 'ready').map(c => c.data.confirmation)).toEqual(['same-proof','same-proof']);
  controls.mode = 'mod';
  await $.ui.render(event(parent, ['a']));
  await clock.advance(1);
  expect(controls.draws.at(-1)?.body).toBe('中文 a');
  expect(controls.calls.filter(c => c.operation === 'ready').length).toBe(2);
});

test('slow batches release the host row before its first-paint deadline and redraw the current result', OPTIONS, async ($, on) => {
  const { clock, controls, parent } = setup(on);
  await $.session.start(START);
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  controls.batch = async () => {
    await delayed;
    return '{"protocol":1,"mode":"mod","rows":[{"id":"a","body":"ready"}]}';
  };
  const first = $.ui.render(event(parent, ['a']));
  await clock.settle();
  await clock.advance(175);
  await first;
  expect(controls.draws.at(-1)?.body).toBeUndefined();
  await $.ui.render(event(parent, ['a'], { body: 'foreign' }));
  expect(controls.draws.at(-1)?.body).toBe('foreign');
  expect(controls.calls.filter(c => c.operation === 'batch').length).toBe(1);
  release();
  await clock.settle();
  expect(controls.invalidations).toBeGreaterThan(0);
  await $.ui.render(event(parent, ['a']));
  expect(controls.draws.at(-1)?.body).toBe('ready');
});

test('a batch denied after loading re-registers its live session outside paint', OPTIONS, async ($, on) => {
  const { clock, controls, parent } = setup(on);
  await $.session.start(START);
  controls.mode = 'pass';
  await $.ui.render(event(parent, ['a']));
  controls.mode = 'mod';
  await $.ui.render(event(parent, ['a']));
  expect(controls.calls.map(c => c.operation)).toEqual(['loaded', 'batch']);
  await clock.advance(5000);
  await $.ui.render(event(parent, ['a']));
  expect(controls.calls.map(c => c.operation)).toEqual(['loaded', 'batch', 'loaded', 'batch']);
  expect(controls.draws.at(-1)?.body).toBe('中文 a');
});
