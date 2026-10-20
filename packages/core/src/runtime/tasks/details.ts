import type { TaskDetails, TaskEvidence, TaskAgentDetail } from '../../contracts/ui.js';
import type { Sample } from '../../timing/sample.js';
import { taskElapsed } from '../../timing/timer.js';
import { int, numeric, object, own, type Data } from '../values.js';
import { canonicalPrompt } from '../live/ownership.js';
import { snapshotMetrics, unavailable } from '../live/snapshot.js';
import { fresh, type LiveState } from '../live/state.js';
import { STALE_MS } from '../live/model.js';
import type { TaskStore, Turn } from './model.js';
import { activePoint } from './view.js';

export interface DetailSources {
    session: string;
    prompt: string | null;
    history: TaskStore | null;
    live: LiveState | null;
    taskEvidence: TaskEvidence;
    liveEvidence: TaskEvidence;
    sample: Sample;
    now: number;
    nativeTiming: boolean;
    liveMetrics: boolean;
    hostAgents?: { observed_at: number; agents: { id: string; name: string | null }[] };
}
const iso = (value: number | null) => value !== null && Number.isFinite(value) && value >= 0 && value <= 8640000000000000 ? new Date(value).toISOString() : null;
export function taskDetails(s: DetailSources): TaskDetails {
    const evidence = [{ ...s.taskEvidence }, { ...s.liveEvidence }], limitations = ['independent_snapshots'];
    let prompt = s.prompt ?? s.history?.current_prompt_id ?? s.live?.active_prompt_id ?? s.live?.current_prompt_id ?? null;
    const result: TaskDetails = { version: 1, session_id: s.session, prompt_id: prompt, captured_at: new Date(s.now).toISOString(),
        status: null, phase: null, elapsed_seconds: null, active_seconds: null, progress: null, agents: [], evidence, limitations };
    const canonical = (id: string | null) => s.live ? canonicalPrompt(s.live, id) : id;
    const liveCurrent = s.live?.active_prompt_id ?? s.live?.current_prompt_id;
    if (!s.prompt && s.history?.current_prompt_id && liveCurrent) {
        const current = s.history.turns.filter(t => t.prompt_id === s.history!.current_prompt_id);
        if ((canonical(s.history.current_prompt_id) ?? s.history.current_prompt_id) !== (canonical(liveCurrent) ?? liveCurrent) &&
            !current.some(t => [t.prompt_id, ...t.prompt_aliases].includes(liveCurrent))) {
            limitations.push('ambiguous_current_task'); result.prompt_id = null; return result;
        }
    }
    if (!prompt) { limitations.push('no_current_task'); return result; }
    const matches = s.history?.turns.filter(t => t.prompt_id === prompt || t.prompt_aliases.includes(prompt!) ||
        canonical(prompt) !== null && [t.prompt_id, ...t.prompt_aliases].some(id => canonical(id) === canonical(prompt))) ?? [];
    if (matches.length > 1) { limitations.push('ambiguous_owner'); return result; }
    let turn: Turn | null = matches[0] ?? null;
    const updated = turn ? int(turn.updated_wall_ns) : null, updatedMs = updated === null ? null : Number(updated / 1000000n);
    if (updatedMs !== null && updatedMs > s.now) { turn = null; evidence[0] = { ...evidence[0]!, status: 'newer_than_input', freshness: 'newer_than_input' }; }
    const selected = canonical(prompt), liveFresh = selected !== null && fresh(s.live, s.now) && canonical(liveCurrent ?? null) === selected;
    if (turn) {
        prompt = turn.prompt_id; result.prompt_id = prompt; result.status = turn.status; result.phase = turn.phase;
        evidence[0] = { ...evidence[0]!, observed_at: iso(updatedMs), status: turn.status === 'running' ? 'partial' : 'observed',
            freshness: updatedMs === null ? 'unknown' : turn.status !== 'running' || liveFresh || s.now - updatedMs <= STALE_MS ? 'current' : 'stale' };
        if (turn.status !== 'running' || evidence[0]!.freshness === 'current') {
            const elapsed = taskElapsed(turn, s.sample);
            const seconds = elapsed === null ? null : Number(elapsed) / 1e9;
            result.elapsed_seconds = seconds !== null && Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
        }
        if (result.elapsed_seconds === null) limitations.push(updatedMs === null ? 'missing_start' : 'elapsed_unavailable');
        const point = activePoint(turn, s.nativeTiming, liveFresh, () => s.sample);
        result.active_seconds = numeric(point.value);
        evidence.push({ source: 'native_task_timing', scope: 'task', status: String(point.reason ?? 'observed'),
            observed_at: iso(numeric(point.observed_at_ms)), freshness: turn.status === 'running' ? liveFresh ? 'current' : 'unknown' : 'current' });
        if (point.reason) limitations.push(String(point.reason));
    } else limitations.push('task_not_observed');
    if (s.live) {
        const history = turn && s.history ? { ...s.history, current_prompt_id: turn.prompt_id, turns: [turn] } : null;
        const points = selected ? snapshotMetrics(s.live, history, selected, s.now, s.liveMetrics) : unavailable('ambiguous_owner');
        const progress = points['task-progress']!;
        if (object(progress.value)) {
            const completed = numeric(progress.value.completed), total = numeric(progress.value.total);
            if (completed !== null && total !== null) result.progress = { completed, total };
        }
        evidence.push({ source: 'native.checklist', scope: 'task', status: String(progress.reason ?? 'observed'),
            observed_at: iso(numeric(progress.observed_at_ms)), freshness: liveFresh ? 'current' : 'unknown' });
        if (result.status === null && typeof points['run-state']!.value === 'string') result.status = points['run-state']!.value as string;
    }
    if (!s.liveMetrics) limitations.push('runtime_disabled');
    const ids = new Set(turn?.agent_ids ?? []);
    if (selected && s.live) for (const [id, agent] of Object.entries(s.live.agents)) {
        if (agent.prompt_id === selected && numeric(agent.updated_at_ms) !== null && numeric(agent.updated_at_ms)! <= s.now) ids.add(id);
    }
    for (const id of ids) {
        const owned = s.live ? own(s.live.agents, id) : null;
        const attributable = owned && selected !== null && owned.prompt_id === selected && numeric(owned.updated_at_ms) !== null && numeric(owned.updated_at_ms)! <= s.now;
        const snapshot = s.live?.agent_snapshot;
        const observed = snapshot && numeric(snapshot.observed_at_ms) !== null && numeric(snapshot.observed_at_ms)! <= s.now &&
            Array.isArray(snapshot.agents) ? (snapshot.agents as Data[]).find(a => a.id === id && a.local === true) : null;
        const agent: TaskAgentDetail = { id, parent_id: null, name: null, status: attributable && typeof owned.status === 'string' ? owned.status : null,
            evidence: [{ source: attributable ? 'live_store' : 'task_store', scope: 'subagent:' + id,
                status: attributable ? 'observed' : 'partial', observed_at: iso(attributable ? numeric(owned.updated_at_ms) : updatedMs), freshness: liveFresh ? 'current' : 'unknown' }] };
        if (attributable) {
            const parent = owned.parent_agent_id;
            if (typeof parent === 'string' && ids.has(parent) && parent !== id) agent.parent_id = parent;
            else if (parent != null) limitations.push('parent_not_observed');
            if (observed && typeof observed.status === 'string') {
                agent.status = observed.status;
                agent.evidence.push({ source: 'native.agent.list', scope: 'subagent:' + id, status: 'observed',
                    observed_at: iso(numeric(snapshot!.observed_at_ms)), freshness: liveFresh ? 'current' : 'stale' });
            }
        }
        const host = s.hostAgents?.observed_at !== undefined && s.hostAgents.observed_at <= s.now ? s.hostAgents.agents.find(a => a.id === id) : null;
        if (host) {
            agent.name = host.name;
            agent.evidence.push({ source: 'supplied_agent_snapshot', scope: 'subagent:' + id, status: 'observed', observed_at: iso(s.hostAgents!.observed_at),
                freshness: s.now - s.hostAgents!.observed_at <= STALE_MS ? 'current' : 'stale' });
        }
        result.agents.push(agent);
    }
    // Corrupt or cyclic parent metadata must not manufacture a nested tree.
    for (const agent of result.agents) {
        const seen = new Set([agent.id]); let parent = agent.parent_id;
        while (parent) {
            if (seen.has(parent)) { agent.parent_id = null; limitations.push('ambiguous_parent'); break; }
            seen.add(parent); parent = result.agents.find(a => a.id === parent)?.parent_id ?? null;
        }
    }
    result.limitations = [...new Set(limitations)];
    return result;
}
