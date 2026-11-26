import { int, numeric, truth, own, type Data } from '../values.js';
import { findTurn, lifecycleId, type TaskStore, type Turn } from '../tasks/model.js';
import { mainExecutionObserved } from '../tasks/identity.js';
import { canonicalPrompt } from './ownership.js';
import { reconcileBindings } from './bindings.js';
import { fresh, type LiveState } from './state.js';
import { STALE_MS } from './model.js';
import { ITEMS, point, requestMetrics, snapshotRequestMetrics, type Point } from './requests.js';
export const LIVE_ITEMS = ['run-state', 'permission-mode', 'active-agents', 'task-progress', 'last-tool', ...ITEMS];
const TERMINAL = ['completed', 'failed', 'interrupted'];
function latest(rows: Data[], field: string): Data { return rows.reduce((best, row) => numeric(row[field])! > numeric(best[field])! ? row : best); }
function mainTurn(state: LiveState, prompt: string | null): Data | null {
    const turns = prompt === null ? [] : Object.values(state.turns).filter(row => row.prompt_id === prompt && row.agent_id === null);
    return turns.length ? latest(turns, 'started_at_ms') : null;
}
function currentTool(state: LiveState, key: string, tool: Data): boolean {
    const turn = own(state.turns, tool.turn_key);
    if (turn) return turn.epoch === state.epoch;
    return state.epoch !== null && key.startsWith(state.epoch + ':') &&
        Object.keys(state.epochs).every(epoch => epoch === state.epoch || !key.startsWith(epoch + ':'));
}
export function unavailable(reason: string): Record<string, Point> { return Object.fromEntries(LIVE_ITEMS.map(item => [item, point(null, reason)])); }
interface CurrentTask { record: Turn | null; hostConfirmed: boolean; wall: bigint }

/** Select the footer's executing task independently of the Mod's last successful write. */
function currentPrompt(state: LiveState | null, history: TaskStore | null, host: string | null, nowMs: number): { prompt: string | null; task: CurrentTask } {
    const wall = BigInt(Math.trunc(nowMs)) * 1000000n;
    const active = state ? canonicalPrompt(state, state.active_prompt_id) : null;
    const liveId = host ?? (active && state && !truth(state.prompts[active]!.terminal) ? active : state?.current_prompt_id ?? active);
    const selected = state ? canonicalPrompt(state, liveId) : null;
    const selectedRecord = history && liveId ? findTurn(history, liveId) ?? (selected ? findTurn(history, selected) : null) : null;
    const current = history?.current_prompt_id ? findTurn(history, history.current_prompt_id) : null;
    const start = int(current?.started_wall_ns, false);
    if (current && current !== selectedRecord && !current.configuration_prompt && start !== null && start <= wall &&
        (current.status === 'running' || TERMINAL.includes(current.status))) {
        const native = state ? mainTurn(state, selected) : null;
        const promptStart = state ? numeric(own(state.prompts, selected)?.started_at_ms) : null;
        const previousStart = int(selectedRecord?.started_wall_ns, false) ?? (promptStart === null ? null : BigInt(Math.trunc(promptStart * 1e6)));
        const executing = current.status === 'running' && mainExecutionObserved(current, wall);
        const verified = executing || current.submission_verified || TERMINAL.includes(current.status);
        const newer = liveId === null || previousStart !== null && previousStart < start;
        const nativeRunning = native?.status === 'running' && fresh(state, nowMs);
        const canFollowTask = host === null ? !nativeRunning || executing : executing && !nativeRunning;
        if (verified && newer && canFollowTask)
            return { prompt: current.prompt_id, task: { record: current, hostConfirmed: false, wall } };
    }
    return { prompt: selected ?? liveId, task: { record: selectedRecord, hostConfirmed: host !== null && selectedRecord !== null, wall } };
}

export function resolveMetrics(state: LiveState | null, history: TaskStore | null, promptId: unknown, nowMs: number, enabled = true, current = false): Record<string, Point> {
    if (promptId != null && typeof promptId !== 'string') return unavailable('ambiguous_owner');
    if (current && promptId && !lifecycleId(promptId)) return unavailable('ambiguous_owner');
    if (state !== null && enabled) reconcileBindings(state, history);
    const selection = enabled && current && Number.isFinite(nowMs) ? currentPrompt(state, history, lifecycleId(promptId), nowMs) : null;
    const prompt = selection ? selection.prompt : promptId || state?.active_prompt_id || state?.current_prompt_id;
    return snapshotMetrics(state, history, prompt, nowMs, enabled, requestMetrics, selection?.task);
}
/** Resolve already-published observations without reconciling bindings or mutating stores. */
export function snapshotMetrics(state: LiveState | null, history: TaskStore | null, promptId: unknown, nowMs: number, enabled = true, requests = snapshotRequestMetrics, current?: CurrentTask): Record<string, Point> {
    if (promptId != null && typeof promptId !== 'string') return unavailable('ambiguous_owner');
    const sessionReason = !enabled ? 'runtime_disabled' : state === null ? 'not_observed' : truth(state.invalidated) ? state.invalidated as string : fresh(state, nowMs) ? null : 'stale';
    let reason = sessionReason;
    let result = unavailable(reason ?? 'not_observed');
    if (!enabled)
        return result;
    const selected = state ? canonicalPrompt(state, promptId) : null, prompt = state ? own(state.prompts, selected) : undefined;
    if (prompt && prompt.epoch !== state?.epoch && !truth(prompt.terminal)) {
        reason = 'incomplete';
        result = unavailable(reason);
    }
    const record = current?.record ?? (selected && history ? findTurn(history, selected) : null);
    const turn = state ? mainTurn(state, selected) : null;
    const terminal = turn !== null && TERMINAL.includes(turn.status as string);
    const ended = terminal ? numeric(turn.ended_at_ms) ?? numeric(turn.updated_at_ms) : null;
    const running = current && record?.status === 'running' && !record.configuration_prompt &&
        (ended === null || record.phase === 'waiting_subagents' || record.phase === 'resuming_main' ||
            [record.started_wall_ns, record.last_assistant_wall_ns, record.continuation_wall_ns].some(stamp => {
                const wall = int(stamp, false);
                return wall !== null && Number(wall) / 1e6 > ended;
            }));
    const observedMain = running && ((turn?.status === 'running' && turn.epoch === state?.epoch && reason === null) ||
        mainExecutionObserved(record, current.wall) || current.hostConfirmed && (!prompt || turn !== null));
    let run: unknown = null;
    let fromTask = false;
    if (record && (reason === null || TERMINAL.includes(record.status) || observedMain)) {
        if ([...TERMINAL, 'unknown'].includes(record.status))
            run = record.status;
        else if (record.status === 'running')
            run = record.phase === 'waiting_subagents' ? 'waiting agents' : record.phase === 'resuming_main' ? 'main wrap-up' : observedMain ? 'main' : null;
        fromTask = Boolean(current) && run !== null;
    }
    const historical = terminal && !running;
    if (run === null && turn && (historical || reason === null && turn.epoch === state?.epoch && (!running || turn.status === 'running')))
        run = turn.status === 'running' ? 'main' : turn.status;
    if (run === null && !turn && prompt && reason === null && prompt.epoch === state?.epoch && !truth(prompt.terminal))
        run = 'queued';
    const taskTime = int(record?.updated_wall_ns, false);
    result['run-state'] = point(run, run !== null ? null : reason ?? 'not_observed',
        fromTask ? { source: 'task_store', at: taskTime === null ? null : Number(taskTime) / 1e6 } : { source: 'lifecycle/native', at: state?.heartbeat_at_ms });
    if (!state)
        return result;
    const mode = state.permission;
    if (sessionReason === null && mode && (truth(mode.live) || nowMs - numeric(mode.observed_at_ms)! >= 0 && nowMs - numeric(mode.observed_at_ms)! <= STALE_MS)) {
        result['permission-mode'] = point(mode.mode, truth(mode.live) ? null : 'observed_only', { source: mode.source as string, at: mode.observed_at_ms, partial: !truth(mode.live) });
    }
    if (!selected)
        return result;
    const snapshot = state.agent_snapshot;
    if (reason === null && selected && snapshot && nowMs - numeric(snapshot.observed_at_ms)! >= 0 && nowMs - numeric(snapshot.observed_at_ms)! <= STALE_MS) {
        let count = 0, incomplete = false;
        for (const agent of snapshot.agents as Data[]) {
            if (!['pending', 'running', 'waiting'].includes(agent.status as string))
                continue;
            const owned = own(state.agents, agent.id);
            if (!truth(agent.local) || !owned || owned.epoch !== state.epoch)
                incomplete = true;
            else if (owned.prompt_id === selected)
                count++;
        }
        result['active-agents'] = point(count, incomplete ? 'ambiguous_owner' : null, { source: 'native.agent.list', at: snapshot.observed_at_ms, partial: incomplete });
    }
    const lists = Object.values(state.checklists).filter(row => row.prompt_id === selected);
    Object.assign(result, requests(state, selected, reason === null, Boolean(prompt && truth(prompt.terminal))));
    if (lists.length && (reason === null || historical)) {
        const complete = lists.filter(row => truth(row.complete)), checklist = latest(complete.length ? complete : lists, 'updated_at_ms'), tasks = checklist.tasks as Data;
        const counts = { completed: Object.values(tasks).filter(status => status === 'completed').length, total: Object.keys(tasks).length };
        result['task-progress'] = point(counts, truth(checklist.complete) ? null : 'incomplete', { source: 'native.checklist', at: checklist.updated_at_ms, partial: !truth(checklist.complete) });
    }
    const tools = Object.entries(state.tools).filter(([key, tool]) => tool.prompt_id === selected && tool.agent_id === null &&
        (!current || historical || reason === null && currentTool(state, key, tool) && (numeric(tool.updated_at_ms) ?? Infinity) <= nowMs)).map(([, tool]) => tool);
    if (tools.length && (reason === null || historical)) {
        const tool = latest(tools, 'started_at_ms');
        if (reason !== null && tool.status === 'started')
            return result;
        result['last-tool'] = point({ name: tool.name, status: tool.status }, null, { source: 'native.tool', at: tool.updated_at_ms });
    }
    return result;
}
