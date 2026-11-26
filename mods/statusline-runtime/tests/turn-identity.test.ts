import { test, expect } from 'claude-code/testing';
import { register } from '../hooks/observe.ts';
import type { Observation } from '../lib/generated-contracts.ts';

/** Drive the shipped observer, including fields absent from older host engines. */
function observer(advanced: boolean, publish?: (batch: Observation[]) => Promise<void>, refused: readonly number[] = []) {
  type Handler = ($: unknown, event: any, next: any) => any;
  const handlers = new Map<string, Handler>(), ticks: (() => Promise<void>)[] = [];
  register(((name: string, ...args: unknown[]) => {
    handlers.set(name, args[args.length - 1] as Handler);
  }) as Parameters<typeof register>[0], { liveMetrics: advanced });
  const rows: Observation[] = [], periods: number[] = [];
  let now = 1000, session = 's';
  const $ = {
    session: { id: async () => session, version: async () => ({ version: '2.1.314' }), cwd: async () => '/work' },
    env: { get: async () => '' },
    clock: { now: async () => now++, every: (ms: number, callback: () => Promise<void>) => {
      periods.push(ms);
      if (refused.includes(ms)) throw new Error('clock period refused');
      if (ms === 1000) ticks.push(callback);
    } },
    process: { run: async (_argv: unknown, options: { stdin: string }) => {
      const batch = JSON.parse(options.stdin).payload.observations as Observation[];
      if (publish) await publish(batch);
      rows.push(...batch);
      return { exitCode: 0, stdout: JSON.stringify({ protocol_version: 3, result: {
        backend_version: 'test', enabled: true, accepted: batch.length, ignored: 0,
      } }) };
    } },
  };
  const emit = (kind: string, event: any, result: any = event) => {
    const next = Object.assign(async (received: unknown) => {
      expect(received).toBe(event);
      return result;
    }, { signal: { aborted: false } });
    return handlers.get(kind)!($, event, next);
  };
  return { rows, periods, emit, flush: () => ticks[0]!(), advance: (ms: number) => { now += ms; }, session: (id: string) => { session = id; },
    async step(turnId: string, agentId?: string) {
      const event = { turnId, agentId, index: 0, model: 'test', messageCount: 1 };
      const answer = { answer: 'unchanged' };
      const chunks = [{ ref: 1, kind: 'text', text: 'unchanged' }, { ref: 2, kind: 'stop', usage: {
        input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
      } }];
      const next = Object.assign(async function* (received: unknown) {
        expect(received).toBe(event);
        yield* chunks;
        return answer;
      }, { signal: { aborted: false } });
      const stream = handlers.get('turn.step')!($, event, next);
      for (const chunk of chunks) expect((await stream.next()).value).toBe(chunk);
      expect((await stream.next()).value).toBe(answer);
    },
  };
}

for (const advanced of [false, true]) test(`turn starts retain main, parallel and nested loop identity: metrics=${advanced}`, async () => {
  const f = observer(advanced);
  await f.emit('session.start', {});
  const main = { turnId: 'main-turn', text: 'private prompt' };
  expect(await f.emit('turn.start', main)).toBe(main);
  await f.emit('turn.start', { turnId: 'child-a', text: 'private agent prompt', agentId: 'a' });
  await f.emit('turn.start', { turnId: 'child-b', text: '', agentId: 'b' });
  await f.emit('agent.spawn', { parentAgentId: 'a', subagentType: 'test' }, { agentId: 'nested' });
  await f.emit('turn.start', { turnId: 'nested-turn', text: '', agentId: 'nested' });
  await f.emit('tool.call', { tool: 'Bash', tool_use_id: 'main-tool' }, { result: 'unchanged' });
  await f.emit('tool.call', { tool: 'Bash', tool_use_id: 'child-tool', agentId: 'a' }, { result: 'unchanged' });
  await f.emit('classic.Elicitation', {});
  for (const [turnId, agentId] of [['child-a', 'a'], ['child-b', 'b'], ['nested-turn', 'nested'], ['main-turn', undefined]] as const) {
    await f.step(turnId, agentId);
    await f.emit('turn.complete', { turnId, agentId, durationMs: 10, reason: 'end_turn', usage: {
      input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
    } });
  }
  await f.flush();
  const starts = f.rows.filter(row => row.kind === 'turn_start');
  expect(starts.filter(row => row.agent_id === null).every(row => row.turn_id === 'main-turn')).toBe(true);
  for (const [turn, agent] of [['main-turn', null], ['child-a', 'a'], ['child-b', 'b'], ['nested-turn', 'nested']]) {
    expect(starts.filter(row => row.turn_id === turn).every(row => row.agent_id === agent)).toBe(true);
    expect(f.rows.some(row => row.kind === 'turn_end' && row.turn_id === turn && row.agent_id === agent)).toBe(true);
    expect(f.rows.some(row => row.kind === 'wait_unknown' && row.turn_id === turn && row.agent_id === agent)).toBe(true);
  }
  const nested = f.rows.find(row => row.kind === 'agent_start' && row.agent_id === 'nested');
  expect(nested?.turn_id).toBe('child-a');
  expect(nested?.parent_agent_id).toBe('a');
  if (advanced) {
    expect(f.rows.find(row => row.kind === 'tool_start' && row.request_id === 'main-tool')?.turn_id).toBe('main-turn');
    expect(f.rows.find(row => row.kind === 'tool_start' && row.request_id === 'child-tool')?.turn_id).toBe('child-a');
    expect(f.rows.filter(row => row.kind === 'request_end').length).toBe(4);
  } else expect(f.rows.some(row => row.kind === 'request_end')).toBe(false);
  expect(f.rows.every((row, index) => row.seq === index)).toBe(true);
  expect(JSON.stringify(f.rows).includes('private')).toBe(false);
});

const prompt = (uuid: string) => ({ uuid, message: { type: 'user' }, origin: { kind: 'composer' } });
const settle = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

test('native events drain promptly after both timer registrations are refused and a write is busy', async () => {
  let release!: () => void, inFlight = 0, highWater = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  const f = observer(true, async rows => {
    highWater = Math.max(highWater, ++inFlight);
    if (rows.some(row => row.kind === 'prompt')) await held;
    inFlight--;
  }, [1000, 5000]);
  await f.emit('session.start', {});
  expect(f.periods).toEqual([1000, 5000]);
  const nextPrompt = prompt('message');
  expect(await f.emit('session.append', nextPrompt)).toBe(nextPrompt);
  await f.emit('turn.start', { turnId: 't' });
  const answer = { result: 'original result' };
  expect(await f.emit('tool.call', { tool: 'Read', tool_use_id: 'r' }, answer)).toBe(answer);
  await f.emit('turn.complete', { turnId: 't', durationMs: 5, reason: 'answer' });
  expect(f.rows.map(row => row.kind)).toEqual(['heartbeat']);
  release();
  await settle();
  expect(f.rows.map(row => row.kind)).toEqual(['heartbeat', 'prompt', 'turn_start', 'tool_start', 'tool_end', 'turn_end', 'turn_usage']);
  expect(highWater).toBe(1);
});

test('an unacknowledged write retries the same identities without leaking them to a rebound session', async () => {
  const attempts: Observation[][] = [];
  let fail = true, release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const f = observer(true, async rows => {
    attempts.push(rows);
    if (rows.some(row => row.kind === 'prompt' && row.prompt_id === 'first') && fail) {
      fail = false;
      throw new Error('timeout after possible commit');
    }
    if (rows.some(row => row.kind === 'prompt' && row.prompt_id === 'held')) await held;
  }, [1000, 5000]);
  await f.emit('session.start', {});
  await f.emit('session.append', prompt('first'));
  await settle();
  f.advance(1500);
  await f.emit('turn.start', { turnId: 't' });
  await settle();
  expect(attempts[2]?.[0]).toEqual(attempts[1]?.[0]);
  expect(f.rows.filter(row => row.prompt_id === 'first').length).toBe(1);
  await f.emit('session.append', prompt('held'));
  f.session('new-session');
  await f.emit('session.append', prompt('new-message'));
  release();
  await settle();
  const newRows = f.rows.filter(row => row.session_id === 'new-session');
  expect(newRows.map(row => [row.seq, row.kind, row.prompt_id])).toEqual([[0, 'heartbeat', null], [1, 'prompt', 'new-message']]);
  expect(newRows[0]?.epoch === attempts[1]?.[0]?.epoch).toBe(false);
});
