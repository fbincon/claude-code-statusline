import type { EngineInterface, PluginOptions, Register, Timer } from 'claude-code';
import { binding, type LaunchSpec } from '../lib/launch';
import { columnsOf, replyOf, Roster, usable, type Reply, type RowProps } from '../lib/rows';

const REFRESH_MS = 5000;
const MAX_BYTES = 8 * 1024 * 1024;
// The terminal waits up to 300 ms for a new agent row before showing an empty body.
const FIRST_PAINT_MS = 150;
type Operation = 'loaded' | 'batch' | 'ready';
interface Connection {
  launch: LaunchSpec;
  directory: string;
  host_version: string;
  backend_version: string;
  installation_id: string;
}
interface Frame {
  roster: Roster;
  revision: number;
  cwd: string;
  reply: Reply;
}
interface Session {
  id: string;
  active: boolean;
  connection?: Connection;
  loading?: Promise<void>;
  bootstrap?: Timer;
  retryLoad?: boolean;
  roster?: Roster;
  frame?: Frame;
  attempted?: { roster: Roster; revision: number };
  pending?: Promise<void>;
  refresh?: Timer;
  handoff?: Timer;
  attemptedHandoff?: Frame;
  confirming?: string;
  confirmed?: string;
}
interface Sessions {
  active?: Session;
  ended?: string;
  calls: number;
  adopted: number;
}

function invalidate($: EngineInterface) {
  try { $.ui.invalidate('ui.render'); } catch { /* The surface may have detached. */ }
}

function close(session: Session) {
  session.active = false;
  session.bootstrap?.cancel();
  session.refresh?.cancel();
  session.handoff?.cancel();
}

function fitsPipe(text: string) {
  // Each UTF-16 code unit takes at most three UTF-8 bytes. Most frames need no second buffer.
  return text.length <= MAX_BYTES / 3 || (text.length <= MAX_BYTES && new TextEncoder().encode(text).length <= MAX_BYTES);
}

async function run($: EngineInterface, session: Session, connection: Connection, cwd: string,
                   operation: Operation, extra: Record<string, unknown> = {}, ids: readonly string[] = []) {
  const { launch, directory, host_version, backend_version, installation_id } = connection;
  const argv = [launch.executable, ...launch.args, 'render-subagents', '--agent-row-' + operation];
  if (directory) argv.push('--config-dir', directory);
  const stdin = JSON.stringify({ protocol: 1, session_id: session.id, cwd, host_version, backend_version, installation_id, ...extra });
  if (!fitsPipe(stdin)) return null;
  const result = await $.process.run(argv, { stdin, timeoutMs: 3000 });
  if (result.exitCode !== 0 || result.isStdoutTruncated || !fitsPipe(result.stdout)) return null;
  return replyOf(result.stdout, ids);
}

async function load($: EngineInterface, options: PluginOptions, session: Session) {
  if (!session.active || session.connection) return;
  if (!session.loading) {
    session.loading = (async () => {
      if (typeof options.installationId !== 'string' || !options.installationId ||
          typeof options.backendVersion !== 'string' || !options.backendVersion) return;
      const [host, configured, cwd] = await Promise.all([$.session.version(), $.env.get('CLAUDE_CONFIG_DIR'), $.session.cwd()]);
      const connection: Connection = {
        launch: binding(options), directory: configured || (typeof options.configDir === 'string' ? options.configDir : ''),
        host_version: host.version, backend_version: options.backendVersion, installation_id: options.installationId,
      };
      if (!session.active) return;
      const ack = await run($, session, connection, cwd, 'loaded');
      if (ack && ack.mode !== 'pass' && session.active) {
        session.connection = connection;
        if (session.roster) session.roster.revision++;
      }
    })().finally(() => { session.loading = undefined; });
  }
  await session.loading;
}

/** One wake-up per active roster. A layout that stops asking for rows goes idle. */
function scheduleRefresh($: EngineInterface, session: Session) {
  if (session.refresh || !session.active) return;
  session.refresh = $.clock.after(REFRESH_MS, () => {
    session.refresh = undefined;
    if (!session.active || !session.roster) return;
    session.roster.revision++;
    invalidate($);
  });
}

function valid(session: Session, roster: Roster, revision: number) {
  return session.active && session.roster === roster && roster.revision === revision;
}

async function collect($: EngineInterface, session: Session, roster: Roster) {
  const connection = session.connection!;
  const [agents, cwd] = await Promise.all([$.agent.list().catch(() => []), $.session.cwd()]);
  if (!session.active || session.roster !== roster) return;
  // Include sibling renders received while the engine was retrieving the list.
  const revision = roster.revision;
  session.attempted = { roster, revision };
  const tasks = roster.snapshot(agents);
  if (!tasks) return;
  const reply = await run($, session, connection, cwd, 'batch', { columns: roster.columns, tasks }, roster.ids);
  if (!reply || !valid(session, roster, revision)) return;
  if (reply.mode === 'pass') {
    // The bounded backend ledger can evict a long-running session. Re-register on a later paint.
    session.connection = undefined;
    session.frame = undefined;
    session.confirmed = undefined;
    session.retryLoad = true;
    return;
  }
  session.frame = { roster, revision, cwd, reply };
}

async function frameFor($: EngineInterface, session: Session, props: RowProps) {
  const columns = columnsOf(props);
  if (!session.roster?.matches(props.rowIds, columns)) {
    session.roster = new Roster(props.rowIds, columns);
    session.frame = undefined;
  }
  const roster = session.roster;
  roster.observe(props);
  scheduleRefresh($, session);
  if (session.frame && valid(session, session.frame.roster, session.frame.revision)) return session.frame;
  if (!session.pending) {
    if (session.attempted && valid(session, session.attempted.roster, session.attempted.revision)) return;
    const initialRevision = roster.revision;
    let timedOut = false;
    let release!: () => void;
    const fallback = new Promise<void>(resolve => { release = resolve; });
    const timer = $.clock.after(FIRST_PAINT_MS, () => { timedOut = true; release(); });
    const work = collect($, session, roster).finally(() => {
      timer.cancel();
      session.pending = undefined;
      const fresh = session.frame && valid(session, session.frame.roster, session.frame.revision);
      if (session.active && (timedOut && fresh || !fresh && !valid(session, roster, initialRevision))) invalidate($);
    });
    // All paints share both the process and its first-paint deadline, even after it expired.
    session.pending = Promise.race([work, fallback]);
  }
  await session.pending;
  const frame = session.frame;
  return frame && frame.roster === roster && valid(session, roster, frame.revision) ? frame : undefined;
}

/** A checked batch can authorize one separate lifecycle call after the host drew its fallback. */
function confirmAfterRender($: EngineInterface, session: Session, frame: Frame, rowId: string) {
  const confirmation = frame.reply.confirmation;
  if (!confirmation || frame.reply.mode === 'pass' || frame.reply.rows.get(rowId) === undefined ||
      !valid(session, frame.roster, frame.revision) || session.confirmed === confirmation ||
      session.confirming || session.handoff || session.attemptedHandoff === frame) return;
  session.handoff = $.clock.after(0, async () => {
    session.handoff = undefined;
    if (!valid(session, frame.roster, frame.revision)) return;
    session.attemptedHandoff = frame;
    session.confirming = confirmation;
    try {
      const ack = await run($, session, session.connection!, frame.cwd, 'ready', { confirmation });
      if (ack?.mode === 'mod' && session.active) {
        session.confirmed = confirmation;
        if (valid(session, frame.roster, frame.revision)) {
          frame.roster.revision++;
          invalidate($);
        }
      }
    } catch { /* A new validated batch may retry the handoff. */ }
    finally { session.confirming = undefined; }
  });
}

async function current($: EngineInterface, options: PluginOptions, sessions: Sessions, started = false) {
  const sequence = ++sessions.calls;
  const id = await $.session.id();
  if (!id || (sequence < sessions.adopted && sessions.active?.id !== id)) return;
  if (started && id === sessions.ended) sessions.ended = undefined;
  if (id === sessions.ended) return;
  sessions.adopted = Math.max(sessions.adopted, sequence);
  if (sessions.active?.id !== id) {
    if (sessions.active) close(sessions.active);
    sessions.active = { id, active: true };
  }
  const found = sessions.active;
  if (started) await load($, options, found);
  else if (!found.connection && !found.bootstrap && options.installationId && options.backendVersion) {
    // A hot-loaded mod can first see an agent row. The row itself performs no lifecycle writes.
    found.bootstrap = $.clock.after(found.retryLoad ? REFRESH_MS : 0, async () => {
      try {
        await load($, options, found);
      } catch { /* Retry when the host next asks for a row. */ }
      found.bootstrap = undefined;
      found.retryLoad = !found.connection;
      if (found.active) invalidate($);
    });
  }
  return found.active && found.connection ? found : undefined;
}

export const register: Register = (on, options) => {
  const sessions: Sessions = { calls: 0, adopted: 0 };
  on('session.start', async ($, e, next) => {
    try { if (e.isInteractive && e.surface === 'terminal') await current($, options, sessions, true); } catch { /* Startup is independent of rows. */ }
    return next(e);
  });
  on('session.end', ($, e, next) => {
    if (sessions.active?.id === e.sessionId) {
      close(sessions.active);
      sessions.active = undefined;
    }
    sessions.ended = e.sessionId;
    sessions.adopted = ++sessions.calls;
    return next(e);
  });
  on('ui.render', { component: 'AgentRow', surface: 'terminal' }, async ($, e, next) => {
    let found: Session | undefined, frame: Frame | undefined;
    try {
      if (usable(e.props)) {
        found = await current($, options, sessions);
        if (found) frame = await frameFor($, found, e.props);
      }
    } catch { /* Missing observations, denied calls and malformed replies preserve the host row. */ }
    const body = found && frame?.reply.mode === 'mod' && valid(found, frame.roster, frame.revision) &&
      e.props.body === undefined && !e.props.isHidden
      ? frame.reply.rows.get(e.props.id) : undefined;
    const drawing = await next(body === undefined ? e : {
      ...e, props: { ...e.props, body, isHidden: body === '' },
    });
    try { if (found && frame) confirmAfterRender($, found, frame, e.props.id); } catch { /* Keep the drawing if timers are unavailable. */ }
    return drawing;
  });
};
