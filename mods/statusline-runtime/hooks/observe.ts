/** Passive observations only: every hook passes its original event/result on. */
import type { EngineInterface, Register, PluginOptions } from 'claude-code';
import { Queue, confirmedResponse } from '../lib/queue.ts';
import { PROTOCOL_VERSION } from '../lib/generated-contracts.ts';

type State = { queue: Queue; ready: boolean; busy: boolean; executable: string; directory: string; hostVersion: string };

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
  const state: State = { queue: new Queue(), ready: false, busy: false, executable: '', directory: '', hostVersion: '' };
  const queue = state.queue;
  on('session.start', async ($, e, next) => {
    try {
      await bind($, options, state);
      await flush($, options, state);
      $.clock.every(1000, async () => { try { await bind($, options, state); await flush($, options, state); } catch {} });
      $.clock.every(5000, async () => {
        try {
          await bind($, options, state);
          queue.push('heartbeat', { host_version: state.hostVersion, loaded_at_ms: queue.loadedAt }, await $.clock.now());
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

  on('session.end', async ($, e, next) => {
    try {
      queue.push('invalidate', { reason: 'session_' + e.reason }, await $.clock.now());
      await flush($, options, state);
    } catch {}
    state.ready = false;
    return next(e);
  });
};
