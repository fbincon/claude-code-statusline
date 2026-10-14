import { numeric, truth, object, own, type Data } from '../values.js';
import { findTurn, type TaskStore } from '../tasks/model.js';
import { canonicalPrompt } from './ownership.js';
import { reconcileBindings } from './bindings.js';
import { fresh, type LiveState } from './state.js';
import { STALE_MS } from './model.js';
import { ITEMS, point, requestMetrics, type Point } from './requests.js';
export const LIVE_ITEMS = ['run-state', 'permission-mode', 'active-agents', 'task-progress', 'last-tool', ...ITEMS];
function latest(rows: Data[], field: string): Data { return rows.reduce((best, row) => numeric(row[field])! > numeric(best[field])! ? row : best); }
export function unavailable(reason: string): Record<string, Point> { return Object.fromEntries(LIVE_ITEMS.map(item => [item, point(null, reason)])); }
export function resolveMetrics(state: LiveState | null, history: TaskStore | null, promptId: string | null, nowMs: number, enabled = true): Record<string, Point> {
    let reason = !enabled ? 'runtime_disabled' : state === null ? 'not_observed' : truth(state.invalidated) ? state.invalidated as string : fresh(state, nowMs) ? null : 'stale';
    let result = unavailable(reason ?? 'not_observed');
    if (state === null || !enabled)
        return result;
    reconcileBindings(state, history);
    const selected = canonicalPrompt(state, promptId || state.active_prompt_id || state.current_prompt_id), prompt = own(state.prompts, selected);
    if (prompt && prompt.epoch !== state.epoch && !truth(prompt.terminal)) {
        reason = 'incomplete';
        result = unavailable(reason);
    }
    const record = selected && history ? findTurn(history, selected) : null;
    const turns = Object.values(state.turns).filter(row => row.prompt_id === selected && row.agent_id === null), turn = turns.length ? latest(turns, 'started_at_ms') : null;
    let run: unknown = null;
    if (record && (reason === null || ['completed', 'failed', 'interrupted'].includes(record.status))) {
        if (['completed', 'failed', 'interrupted', 'unknown'].includes(record.status))
            run = record.status;
        else if (record.status === 'running')
            run = record.phase === 'waiting_subagents' ? 'waiting agents' : record.phase === 'resuming_main' ? 'main wrap-up' : null;
    }
    if (run === null && turn && (reason === null || ['completed', 'failed', 'interrupted'].includes(turn.status as string)))
        run = turn.status === 'running' ? 'main' : turn.status;
    if (run === null && selected && reason === null && state.prompts[selected]!.epoch === state.epoch)
        run = 'queued';
    result['run-state'] = point(run, run !== null ? null : reason ?? 'not_observed', { source: 'lifecycle/native', at: state.heartbeat_at_ms });
    const mode = state.permission;
    if (reason === null && mode && (truth(mode.live) || nowMs - numeric(mode.observed_at_ms)! >= 0 && nowMs - numeric(mode.observed_at_ms)! <= STALE_MS)) {
        result['permission-mode'] = point(mode.mode, truth(mode.live) ? null : 'observed_only', { source: mode.source as string, at: mode.observed_at_ms, partial: !truth(mode.live) });
    }
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
    const lists = Object.values(state.checklists).filter(row => row.prompt_id === selected), historical = turn !== null && ['completed', 'failed', 'interrupted'].includes(turn.status as string);
    Object.assign(result, requestMetrics(state, selected, reason === null, Boolean(prompt && truth(prompt.terminal))));
    if (lists.length && (reason === null || historical)) {
        const complete = lists.filter(row => truth(row.complete)), checklist = latest(complete.length ? complete : lists, 'updated_at_ms'), tasks = checklist.tasks as Data;
        const counts = { completed: Object.values(tasks).filter(status => status === 'completed').length, total: Object.keys(tasks).length };
        result['task-progress'] = point(counts, truth(checklist.complete) ? null : 'incomplete', { source: 'native.checklist', at: checklist.updated_at_ms, partial: !truth(checklist.complete) });
    }
    const tools = Object.values(state.tools).filter(tool => tool.prompt_id === selected && tool.agent_id === null);
    if (tools.length && (reason === null || historical)) {
        const tool = latest(tools, 'started_at_ms');
        if (reason !== null && tool.status === 'started')
            return result;
        result['last-tool'] = point({ name: tool.name, status: tool.status }, null, { source: 'native.tool', at: tool.updated_at_ms });
    }
    return result;
}
