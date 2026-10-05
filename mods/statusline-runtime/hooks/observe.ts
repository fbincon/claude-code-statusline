/** Passive observations only: every hook passes its original event/result on. */
import type { EngineInterface, Register, PluginOptions } from 'claude-code';
import { Queue, confirmedResponse } from '../lib/queue.ts';
import { PROTOCOL_VERSION } from '../lib/generated-contracts.ts';
import { checklist } from '../lib/checklists.ts';

type State = { queue: Queue; ready: boolean; busy: boolean; executable: string; directory: string; hostVersion: string; turns: Record<string, string> };

async function bind($: EngineInterface, options: PluginOptions, state: State): Promise<void> {
  const queue = state.queue;
  const session = await $.session.id();
  if (state.ready && queue.session === session) return;
  state.executable = (await $.env.get('CLAUDE_STATUSLINE_RUNTIME_EXECUTABLE')) ||
    (typeof options.backendExecutable === 'string' ? options.backendExecutable : 'claude-statusline');
  state.directory = (await $.env.get('CLAUDE_CONFIG_DIR')) ||
    (typeof options.configDir === 'string' ? options.configDir : '');
  state.hostVersion = (await $.session.version()).version;
  const now = await $.clock.now();
  queue.bind(session, now);
  state.turns = {};
  queue.push('heartbeat', { host_version: state.hostVersion, loaded_at_ms: now }, now);
  state.ready = true;
}

async function flush($: EngineInterface, options: PluginOptions, state: State): Promise<void> {
  const queue = state.queue;
  if (state.busy || !queue.pending.length) return;
  state.busy = true;
  const batch = queue.batch();
  try {
    const argv = state.directory ? [state.executable, 'runtime', '--config-dir', state.directory] : [state.executable, 'runtime'];
    const result = await $.process.run(argv, {
      stdin: JSON.stringify({ protocol_version: PROTOCOL_VERSION, operation: 'observe', payload: { observations: batch } }),
      timeoutMs: 2000,
    });
    const expected = typeof options.backendVersion === 'string' ? options.backendVersion : '';
    if (result.exitCode === 0 && confirmedResponse(result.stdout, expected, batch.length)) queue.acknowledge(batch);
  } catch { /* Keep exact identities for an idempotent retry. */ }
  finally { state.busy = false; }
}


export const register: Register = (on, options: PluginOptions) => {
  const state: State = { queue: new Queue(), ready: false, busy: false, executable: '', directory: '', hostVersion: '', turns: {} };
  const queue = state.queue;
  on('session.start', async ($, e, next) => {
    try {
      await bind($, options, state);
      await flush($, options, state);
      $.clock.every(1000, async () => { try { await bind($, options, state); await flush($, options, state); } catch {} });
      $.clock.every(5000, async () => {
        try {
          await bind($, options, state);
          const now = await $.clock.now();
          queue.push('heartbeat', { host_version: state.hostVersion, loaded_at_ms: queue.loadedAt }, now);
          const agents = await $.agent.list();
          queue.push('agents', { agents: agents.slice(0, 256).map(agent => ({
            id: agent.id, parent_id: agent.parentId ?? null, status: agent.status,
            local: !agent.teammateId || Boolean(state.turns[agent.id]),
          })) }, now);
          await flush($, options, state);
        } catch {}
      });
    } catch { /* A refused API cannot change the session start. */ }
    return next(e);
  });

  on('classic.UserPromptSubmit', async ($, e, next) => {
    try {
      await bind($, options, state);
      const now = await $.clock.now();
      if (e.prompt_id && !e.agent_id && !/^\s*<(?:command-|local-command-|bash-)/.test(e.prompt))
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
      queue.push('agent_end', { ended_at_ms: now, status: 'completed' }, now,
                 { prompt_id: e.prompt_id ?? null, agent_id: e.agent_id }, 'classic_hook');
    } catch {}
    return next(e);
  });

  on('turn.start', async ($, e, next) => {
    try {
      await bind($, options, state);
      state.turns.main = e.turnId;
      queue.push('turn_start', {}, await $.clock.now(), { turn_id: e.turnId });
    } catch {}
    return next(e);
  });

  on('agent.spawn', async ($, e, next) => {
    const loop = e.parentAgentId ?? 'main';
    const turn = state.turns[loop];
    const epoch = queue.epoch;
    const result = await next(e);
    try {
      if (result.agentId && epoch === queue.epoch) {
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
      await bind($, options, state);
      const now = await $.clock.now();
      const status = e.isAborted ? 'interrupted' : e.reason === 'error' || e.reason === 'refusal' ? 'failed' : 'completed';
      queue.push('turn_end', { status }, now, { agent_id: e.agentId ?? null, turn_id: e.turnId });
      if (e.agentId)
        queue.push('agent_end', { ended_at_ms: now, status }, now, { agent_id: e.agentId, turn_id: e.turnId });
    } catch {}
    return next(e);
  });

  on('tool.call', async ($, e, next) => {
    const identity = { agent_id: e.agentId ?? null, turn_id: state.turns[e.agentId ?? 'main'] ?? null, request_id: e.tool_use_id };
    const epoch = queue.epoch;
    try { queue.push('tool_start', { name: e.tool }, await $.clock.now(), identity); } catch {}
    try {
      const result = await next(e);
      try {
        if (epoch === queue.epoch) {
          const now = await $.clock.now();
          queue.push('tool_end', { name: e.tool, status: result.deny !== undefined ? 'denied' : result.isError ? 'error' : 'success' }, now, identity);
          if (result.deny === undefined && !result.isError) {
            const change = checklist(e.tool, e, result.result);
            if (change) queue.push(change.kind, change.payload, now, identity);
          }
        }
      } catch {}
      return result;
    } catch (error) {
      try {
        if (epoch === queue.epoch)
          queue.push('tool_end', { name: e.tool, status: next.signal.aborted ? 'interrupted' : 'error' }, await $.clock.now(), identity);
      } catch {}
      throw error;
    }
  });

  on('session.end', async ($, e, next) => {
    try {
      queue.push('invalidate', { reason: 'session_' + e.reason }, await $.clock.now());
      await flush($, options, state);
    } catch {}
    state.ready = false;
    return next(e);
  });
};
