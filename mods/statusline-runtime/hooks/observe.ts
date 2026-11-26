/** Passive observations only: every hook passes its original event/result on. */
import type { EngineInterface, Register, PluginOptions } from 'claude-code';
import { Queue, confirmedResponse } from '../lib/queue.ts';
import { PROTOCOL_VERSION } from '../lib/generated-contracts.ts';
import { checklist } from '../lib/checklists.ts';
import { tapStream, usage } from '../lib/streams.ts';
import { cost } from '../lib/costs.ts';
import { promptLink, reportAgent } from '../lib/identity.ts';
import { WaitCoverage } from '../lib/timing.ts';
import { binding } from '../lib/launch.ts';

type FlushEvent = { epoch: string; run: () => void };
type State = { endedSession: string | null; sourceSequence: number; sourceBusy: boolean; sourceEnded: boolean; queue: Queue; ready: boolean;
  binding: Promise<void> | null; flushing: { epoch: string; done: Promise<void> } | null; nextFlush: FlushEvent | null; retryAt: number;
  executable: string; args: readonly string[]; directory: string; hostVersion: string; turns: Record<string, string>; agentTypes: string[]; sourceAgents: Record<string,string> };

async function loadBinding($: EngineInterface, options: PluginOptions, state: State, session: string): Promise<void> {
  const launch = binding(options, await $.env.get('CLAUDE_STATUSLINE_RUNTIME_EXECUTABLE') || undefined);
  const directory = (await $.env.get('CLAUDE_CONFIG_DIR')) ||
    (typeof options.configDir === 'string' ? options.configDir : '');
  const hostVersion = (await $.session.version()).version;
  const now = await $.clock.now();
  if (state.endedSession === session) return;
  Object.assign(state, { executable: launch.executable, args: launch.args, directory, hostVersion, retryAt: 0, nextFlush: null });
  state.queue.bind(session, now);
  state.sourceSequence = 0; state.sourceEnded = false;
  state.turns = {};
  state.agentTypes = []; state.sourceAgents = {};
  state.queue.push('heartbeat', { host_version: hostVersion, loaded_at_ms: now }, now);
  state.ready = true;
}

async function bind($: EngineInterface, options: PluginOptions, state: State): Promise<string | null> {
  const session = await $.session.id();
  while (state.binding) await state.binding;
  if (state.endedSession === session) return null;
  if (!state.ready || state.queue.session !== session) {
    state.binding = loadBinding($, options, state, session).finally(() => { state.binding = null; });
    await state.binding;
  }
  return state.ready && state.queue.session === session ? state.queue.epoch : null;
}

async function eventTime($: EngineInterface, options: PluginOptions, state: State): Promise<number | null> {
  const epoch = await bind($, options, state), at = await $.clock.now();
  return epoch !== null && state.ready && epoch === state.queue.epoch ? at : null;
}

async function drain($: EngineInterface, options: PluginOptions, state: State, epoch: string, at: number): Promise<void> {
  const queue = state.queue;
  // The queue retains at most four full batches. Yield after that many writes
  // even when incoming events replenish it faster than the backend can drain it.
  for (let i = 0; i < 4 && epoch === queue.epoch && queue.pending.length; i++) {
    const batch = queue.batch();
    try {
      const argv = [state.executable, ...state.args, 'runtime', ...(state.directory ? ['--config-dir', state.directory] : [])];
      const result = await $.process.run(argv, {
        stdin: JSON.stringify({ protocol_version: PROTOCOL_VERSION, operation: 'observe', payload: { observations: batch } }),
        timeoutMs: 2000,
      });
      const expected = typeof options.backendVersion === 'string' ? options.backendVersion : '';
      if (result.exitCode === 0 && confirmedResponse(result.stdout, expected, batch.length)) {
        queue.acknowledge(batch);
        continue;
      }
    } catch { /* Keep exact identities for an idempotent retry. */ }
    let now = at;
    try { now = await $.clock.now(); } catch {}
    if (epoch === queue.epoch) state.retryAt = now + 1000;
    break;
  }
}

function flush($: EngineInterface, options: PluginOptions, state: State, at: number, force = false): Promise<void> {
  const epoch = state.queue.epoch;
  if (state.flushing) {
    if (state.flushing.epoch !== epoch) state.nextFlush = { epoch, run: () => { void flush($, options, state, at); } };
    return state.flushing.done;
  }
  if (!state.queue.pending.length || !force && at < state.retryAt) return Promise.resolve();
  const done = drain($, options, state, epoch, at).finally(() => {
    state.flushing = null;
    const next = state.nextFlush;
    state.nextFlush = null;
    if (next?.epoch === state.queue.epoch) next.run();
  });
  state.flushing = { epoch, done };
  return done;
}

async function sourceLifecycle($: EngineInterface, options: PluginOptions, state: State, event: 'tick' | 'end'): Promise<void> {
  if (options.sourceRefresh !== true || state.sourceEnded || event === 'tick' && state.sourceBusy) return;
  if (event === 'end') state.sourceEnded = true;
  state.sourceBusy = true;
  const sequence = state.sourceSequence++;
  try {
    await $.process.run([state.executable, ...state.args, 'runtime', ...(state.directory ? ['--config-dir', state.directory] : [])], {
      stdin: JSON.stringify({ protocol_version: PROTOCOL_VERSION, operation: 'source_lifecycle', payload: {
        session_id: state.queue.session, epoch: state.queue.epoch, seq: sequence,
        project: await $.session.cwd(), host_version: state.hostVersion, event,
        agents: event==='end'?[]:Object.entries(state.sourceAgents).slice(0,256).map(([id,project])=>({id,project})),
      } }), timeoutMs: 2000,
    });
  } catch { /* A missed heartbeat expires its lease; it cannot affect the host. */ }
  finally { state.sourceBusy = false; }
}


export const register: Register = (on, options: PluginOptions) => {
  const state: State = { endedSession: null, sourceSequence: 0, sourceBusy: false, sourceEnded: false, queue: new Queue(), ready: false,
    binding: null, flushing: null, nextFlush: null, retryAt: 0, executable: '', args: [], directory: '', hostVersion: '', turns: {}, agentTypes: [], sourceAgents: {} };
  const queue = state.queue;
  queue.timing = options.nativeTiming !== false;
  queue.metrics = options.liveMetrics === true;
  const waitCoverage = new WaitCoverage();
  const unknownWait = (reason: string, at: number, agent?: string) => {
    for (const [loop, turn] of Object.entries(state.turns)) {
      if (agent && loop !== agent) continue;
      waitCoverage.mark(loop, turn);
      queue.push('wait_unknown', { reason }, at, { turn_id: turn, agent_id: loop === 'main' ? null : loop });
    }
  };
  on('session.start', async ($, e, next) => {
    try {
      const now = await eventTime($, options, state);
      if (now !== null) {
        await sourceLifecycle($, options, state, 'tick');
        await flush($, options, state, now);
      }
    } catch { /* A refused API cannot change the session start. */ }
    try {
      $.clock.every(1000, async () => {
        try {
          const now = await eventTime($, options, state);
          if (now !== null) await flush($, options, state, now);
        } catch {}
      });
    } catch {}
    try {
      $.clock.every(5000, async () => {
        try {
          const now = await eventTime($, options, state);
          if (now === null) return;
          const epoch = queue.epoch;
          queue.push('heartbeat', { host_version: state.hostVersion, loaded_at_ms: queue.loadedAt }, now);
          void flush($, options, state, now);
          if(options.sourceRefresh===true&&Object.keys(state.sourceAgents).length){try{const agents=await $.agent.list();const active=new Set(agents.filter(a=>!a.teammateId&&!['completed','failed','killed'].includes(a.status)).map(a=>a.id));for(const id of Object.keys(state.sourceAgents))if(!active.has(id))delete state.sourceAgents[id];}catch{state.sourceAgents={};}}
          if (epoch !== queue.epoch || !state.ready) return;
          await sourceLifecycle($, options, state, 'tick');
          if (!queue.timing && !queue.metrics) return;
          const agents = await $.agent.list();
          if (epoch !== queue.epoch || !state.ready) return;
          queue.push('agents', { agents: agents.slice(0, 256).map(agent => ({
            id: agent.id, parent_id: agent.parentId ?? null, status: agent.status,
            local: !agent.teammateId || Boolean(state.turns[agent.id]),
          })) }, now);
          await flush($, options, state, now);
        } catch {}
      });
    } catch { /* A refused API cannot change the session start. */ }
    return next(e);
  });

  on('classic.UserPromptSubmit', async ($, e, next) => {
    try {
      await bind($, options, state);
      const now = await $.clock.now();
      const report = reportAgent(e.prompt);
      if (report && e.prompt_id)
        queue.push('prompt_alias', { agent_id: report }, now, { prompt_id: e.prompt_id }, 'classic_hook');
      if (e.prompt_id && !e.agent_id && !report && !/^\s*<(?:command-|local-command-|bash-)/.test(e.prompt))
        queue.push('prompt', {}, now, { prompt_id: e.prompt_id }, 'classic_hook');
      if (e.prompt_id && e.agent_id)
        queue.push('prompt_alias', { agent_id: e.agent_id }, now, { prompt_id: e.prompt_id, agent_id: e.agent_id }, 'classic_hook');
      if (e.permission_mode)
        queue.push('permission', { mode: e.permission_mode, live: false }, now,
                   { prompt_id: e.prompt_id ?? null, agent_id: e.agent_id ?? null }, 'classic_hook');
    } catch {}
    return next(e);
  });

  on('classic.SubagentStart', async ($, e, next) => {
    try {
      await bind($, options, state);
      const now = await $.clock.now();
      queue.push('agent_start', { started_at_ms: now }, now,
                 { prompt_id: e.prompt_id ?? null, agent_id: e.agent_id }, 'classic_hook');
    } catch {}
    return next(e);
  });

  on('classic.SubagentStop', async ($, e, next) => {
    try {
      await bind($, options, state);
      const now = await $.clock.now();
      delete state.sourceAgents[e.agent_id];
      queue.push('agent_end', { ended_at_ms: now, status: 'completed' }, now,
                 { prompt_id: e.prompt_id ?? null, agent_id: e.agent_id }, 'classic_hook');
    } catch {}
    return next(e);
  });

  on('turn.start', async ($, e, next) => {
    try {
      const now = await eventTime($, options, state);
      if (now !== null) {
        const agent = 'agentId' in e && typeof e.agentId === 'string' ? e.agentId : null;
        state.turns[agent ?? 'main'] = e.turnId;
        queue.push('turn_start', {}, now, { turn_id: e.turnId, agent_id: agent });
        void flush($, options, state, now);
      }
    } catch {}
    return next(e);
  });

  on('session.append', { door: 'prompt' }, async ($, e, next) => {
    try {
      const now = await eventTime($, options, state);
      if (now !== null) {
        if (e.agentId)
          queue.push('prompt_alias', { agent_id: e.agentId }, now, { prompt_id: e.uuid, agent_id: e.agentId });
        else if (e.message.type === 'user' && ['composer', 'bridge', 'sdk'].includes(e.origin.kind))
          queue.push('prompt', {}, now, { prompt_id: e.uuid });
        void flush($, options, state, now);
      }
    } catch {}
    return next(e);
  });

  on('agent.spawn', async ($, e, next) => {
    const loop = e.parentAgentId ?? 'main';
    const turn = state.turns[loop];
    const epoch = queue.epoch;
    let project:string|undefined;
    if(options.sourceRefresh===true)try{project=('cwd' in e&&typeof e.cwd==='string'?e.cwd:undefined)??(e.parentAgentId?state.sourceAgents[e.parentAgentId]:await $.session.cwd());}catch{/* Unknown ownership cannot start commands. */}
    const result = await next(e);
    try {
      if (result.agentId && epoch === queue.epoch) {
        if(project&&!('teammateId' in result&&result.teammateId))state.sourceAgents[result.agentId]=project;
        if (!state.agentTypes.includes(e.subagentType)) state.agentTypes.push(e.subagentType);
        const now = await $.clock.now();
        queue.push('agent_start', { started_at_ms: now }, now, {
          agent_id: result.agentId, parent_agent_id: e.parentAgentId ?? null, turn_id: turn ?? null,
        });
      }
    } catch {}
    return result;
  });

  on('turn.complete', async ($, e, next) => {
    try {
      const now = await eventTime($, options, state);
      if (now !== null) {
        const loop = e.agentId ?? 'main';
        const status = e.isAborted ? 'interrupted' : e.reason === 'error' || e.reason === 'refusal' ? 'failed' : 'completed';
        queue.push('turn_end', { status, duration_ms: e.durationMs, wait_coverage: waitCoverage.finish(loop, e.turnId) }, now, { agent_id: e.agentId ?? null, turn_id: e.turnId });
        queue.push('turn_usage', { usage: usage(e.usage) }, now, { agent_id: e.agentId ?? null, turn_id: e.turnId });
        if (e.agentId) {
          delete state.sourceAgents[e.agentId];
          queue.push('agent_end', { ended_at_ms: now, status }, now, { agent_id: e.agentId, turn_id: e.turnId });
        }
        if (state.turns[loop] === e.turnId) delete state.turns[loop];
        void flush($, options, state, now);
      }
    } catch {}
    return next(e);
  });

  on('turn.step', async function* ($, e, next) {
    const identity = { agent_id: e.agentId ?? null, turn_id: e.turnId, request_id: (e.agentId ?? 'main') + ':' + e.turnId + ':' + String(e.index) };
    let epoch = queue.epoch;
    let first = false;
    let native = false;
    let counted: Record<string, number> | null = null;
    let status = 'interrupted';
    try {
      const now = await eventTime($, options, state);
      if (now !== null) {
        epoch = queue.epoch;
        state.turns[e.agentId ?? 'main'] = e.turnId;
        queue.push('turn_start', {}, now, identity);
        queue.push('request_start', {}, now, identity);
        void flush($, options, state, now);
      }
    } catch {}
    if (!queue.metrics) return yield* next(e);
    const observed = tapStream(next(e), async (item, operation) => {
      if (epoch !== queue.epoch) return;
      if (item.done) { if (operation !== 'return') status = 'completed'; return; }
      const chunk = item.value;
      if (typeof chunk.ref === 'number') {
        native = true;
        const content = chunk.kind === 'tool' || ((chunk.kind === 'text' || chunk.kind === 'thinking') && chunk.text.length > 0);
        if (content && !first) {
          first = true;
          queue.push('request_first', {}, await $.clock.now(), identity);
        }
        if (chunk.kind === 'stop') counted = usage(chunk.usage);
      }
    });
    try {
      return yield* observed;
    } catch (error) {
      status = next.signal.aborted ? 'interrupted' : 'failed';
      throw error;
    } finally {
      try {
        if (epoch === queue.epoch)
          queue.push('request_end', { native, usage: native ? counted : null, status }, await $.clock.now(), identity);
      } catch {}
    }
  });

  on('telemetry.log', { to: 'collector' }, async ($, e, next) => {
    try {
      const link = promptLink(e, queue.session);
      if (link) queue.push('prompt_link', link.payload, await $.clock.now(), link.identity, 'otel');
      const row = queue.metrics ? cost(e, queue.session, state.agentTypes) : null;
      if (row) queue.push('request_cost', row.payload, await $.clock.now(), row.identity, 'otel');
    } catch {}
    return next(e);
  });

  // A declarative 'ask' does not expose when the actual approval dialog
  // opens/closes. Preserve that uncertainty instead of subtracting tool time.
  on('tool.check', async ($, e, next) => {
    const result = await next(e);
    if (e.tool_use_id && result.decision === 'ask') {
      try { unknownWait('permission_wait_unobserved', await $.clock.now()); } catch {}
    }
    return result;
  });
  on('classic.Elicitation', async ($, e, next) => {
    try { unknownWait('mcp_wait_unobserved', await $.clock.now()); } catch {}
    return next(e);
  });
  on('tool.call', async ($, e, next) => {
    const identity = { agent_id: e.agentId ?? null, turn_id: state.turns[e.agentId ?? 'main'] ?? null, request_id: e.tool_use_id };
    const epoch = queue.epoch;
    if (e.tool === 'AskUserQuestion' || e.tool.startsWith('mcp__')) {
      try { unknownWait('question_wait_unobserved', await $.clock.now(), e.agentId); } catch {}
    }
    try {
      const now = await $.clock.now();
      if (state.ready && epoch === queue.epoch) {
        queue.push('tool_start', { name: e.tool }, now, identity);
        void flush($, options, state, now);
      }
    } catch {}
    try {
      const result = await next(e);
      try {
        const now = await $.clock.now();
        if (state.ready && epoch === queue.epoch) {
          queue.push('tool_end', { name: e.tool, status: result.deny !== undefined ? 'denied' : result.isError ? 'error' : 'success' }, now, identity);
          if (queue.metrics && result.deny === undefined && !result.isError) {
            const change = checklist(e.tool, e, result.result);
            if (change) queue.push(change.kind, change.payload, now, identity);
          }
          void flush($, options, state, now);
        }
      } catch {}
      return result;
    } catch (error) {
      try {
        const now = await $.clock.now();
        if (state.ready && epoch === queue.epoch) {
          queue.push('tool_end', { name: e.tool, status: next.signal.aborted ? 'interrupted' : 'error' }, now, identity);
          void flush($, options, state, now);
        }
      } catch {}
      throw error;
    }
  });

  on('session.end', async ($, e, next) => {
    if (state.queue.session !== e.sessionId) return next(e);
    state.endedSession = e.sessionId;
    state.ready = false;
    const epoch = queue.epoch;
    try {
      await sourceLifecycle($, options, state, 'end');
      const now = await $.clock.now();
      if (epoch === queue.epoch) {
        queue.push('invalidate', { reason: 'session_' + e.reason }, now);
        await flush($, options, state, now, true);
      }
    } catch {}
    return next(e);
  });
};
