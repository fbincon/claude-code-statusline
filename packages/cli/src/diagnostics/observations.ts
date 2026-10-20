import { join, resolve } from 'node:path';
import type { Draft, Scope, DiagnosticEvidence } from '@fbincon/statusline-core/contracts/ui';
import type { RenderEnvironment, UsageObservation } from '@fbincon/statusline-core/rendering/context';
import { evidence, identity } from '@fbincon/statusline-core/rendering/diagnose';
import { liveDirectory } from '@fbincon/statusline-core/rendering/items';
import { object, own, int, numeric, type Data } from '@fbincon/statusline-core/runtime/values';
import { sessionTokenCounts, usageTokenText, type UsageEntry } from '@fbincon/statusline-core/runtime/usage';
import { storeFromState, type TaskStore, type Turn } from '@fbincon/statusline-core/runtime/tasks/model';
import { activePoint } from '@fbincon/statusline-core/runtime/tasks/view';
import { fresh, validateState, type LiveState } from '@fbincon/statusline-core/runtime/live/state';
import { canonicalPrompt } from '@fbincon/statusline-core/runtime/live/ownership';
import { snapshotMetrics, unavailable, LIVE_ITEMS } from '@fbincon/statusline-core/runtime/live/snapshot';
import { GIT_CACHE_VERSION, GIT_CACHE_TTL_NS, validGitResult } from '@fbincon/statusline-core/runtime/git';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import type { DiagnosticFiles } from '@fbincon/statusline-platform/diagnostic-files';
import type { RuntimeContext } from '../runtime/context.js';
import { readDataJson } from '../runtime/json-data.js';
import type { ExplanationFacts } from '@fbincon/statusline-core/rendering/explain';

type Status = DiagnosticEvidence['status'];
type Loaded = { value: Data | null; status: Status };
const USAGE = ['tokens', 'input-tokens', 'output-tokens'];
const GIT = ['git', 'git-branch', 'git-changes', 'git-ahead-behind'];
function iso(ms: unknown): string | null {
    const n = numeric(ms);
    return n !== null && n >= 0 && n <= 8640000000000000 ? new Date(n).toISOString() : null;
}
function nsMs(ns: unknown): number | null { const n = int(ns, false); return n !== null && n >= 0n ? Number(n / 1000000n) : null; }


/** Bounded reads of known files only. No collector classes or mutating runtime I/O are imported. */
export function observations(draft: Draft, scope: Scope, input: Data, context: RuntimeContext, files: DiagnosticFiles,
    facts: ExplanationFacts, includeLocal: boolean, observedAt: string | null, env: RenderEnvironment): Map<string, DiagnosticEvidence[]> {
    const result = new Map<string, DiagnosticEvidence[]>();
    const nodes = scope === 'main' ? draft.display.instances : draft.display.subagents.instances;
    const selected = new Set(nodes.filter(n => n.enabled).map(n => n.type_id));
    const session = identity(input.session_id), prompt = identity(input.prompt_id), now = context.nowMs();
    const inputTime = observedAt === null ? null : Date.parse(observedAt), at = inputTime ?? now;
    const sample = () => inputTime === null ? context.sample() : { wall_ns: BigInt(Math.trunc(inputTime)) * 1000000n, boot_ns: null, boot_id: null };
    const initial: Status = !includeLocal ? 'input_only' : !session ? 'association_unavailable' : 'not_observed';
    const put = (ids: readonly string[], value: DiagnosticEvidence) => { for (const id of ids) result.set(id, [{ ...value, fields: [...value.fields] }]); };
    const read = (path: string, needsSession = true): Loaded => {
        if (!includeLocal || needsSession && !session) return { value: null, status: initial };
        try {
            const bytes = files.read(path);
            if (bytes === null) return { value: null, status: 'not_observed' };
            const value = readDataJson(decodeUtf8(bytes));
            if (!object(value)) return { value: null, status: 'invalid_field' };
            if (needsSession && Object.hasOwn(value, 'session_id') && value.session_id !== session) return { value: null, status: 'session_mismatch' };
            return { value, status: 'observed' };
        } catch { return { value: null, status: 'source_unavailable' }; }
    };
    const newer = (stamp: unknown) => inputTime !== null && numeric(stamp) !== null && numeric(stamp)! > inputTime;
    const report = (source: string, measurement: string, status: Status, stamp: unknown = null, current = false): DiagnosticEvidence => {
        const date = iso(stamp);
        return evidence(source, measurement, status, date, status === 'newer_than_input' ? status : status === 'stale' ? 'stale' : date !== null && (current || source === 'local_system') ? 'current' : 'unknown');
    };
    const disabled = (enabled: boolean | undefined): Status | null => !includeLocal ? 'input_only' : enabled === false ? 'collector_off' : enabled === undefined ? 'source_unavailable' : null;
    // Every provider is safe even when a visibility rule requests an additional source.
    env.git = () => ({ kind: 'unavailable' });
    env.branchDiff = () => ({ value: null, reason: 'source_unavailable' });
    env.usage = () => null;
    env.task = () => ({ state: null, sample: sample() });
    env.activePoint = () => ({ value: null, reason: 'not_observed' });
    env.live = () => unavailable('not_observed');
    env.hadSubagents = () => false;
    env.agentEndings = () => ({});

    let history: TaskStore | null = null, turn: Turn | null = null, live: LiveState | null = null;
    let taskStatus: Status = initial, liveStatus: Status = initial;
    let taskTime: number | null = null, liveTime: number | null = null;
    const needTask = scope === 'subagent' || selected.has('task-timer') || selected.has('task-active-timer') ||
        draft.display.scope_labels === 'when-subagents' || LIVE_ITEMS.some(id => selected.has(id));
    if (needTask) {
        const loaded = read(join(context.runtimeRoot, 'turns', sha256(session ?? '') + '.json'));
        taskStatus = loaded.status;
        if (loaded.value) {
            if (int(loaded.value.schema) !== 1n || loaded.value.session_id !== session) taskStatus = 'invalid_field';
            else {
                history = storeFromState(loaded.value, session);
                const matches = prompt ? history.turns.filter(row => row.prompt_id === prompt || row.prompt_aliases.includes(prompt)) : [];
                turn = matches.length === 1 ? matches[0]! : null;
                taskStatus = !prompt ? 'association_unavailable' : !turn ? 'prompt_mismatch' : 'observed';
                taskTime = turn ? nsMs(turn.updated_wall_ns) : null;
                if (turn && newer(taskTime)) { taskStatus = 'newer_than_input'; turn = null; }
            }
        }
        if (turn) env.hadSubagents = () => turn!.had_subagents;
    }
    if (selected.has('task-timer')) {
        put(['task-timer'], report('task_store', 'task', taskStatus, taskTime));
        if (turn) {
            if (turn.status === 'running') put(['task-timer'], report('task_store', 'task', 'partial', taskTime));
            env.taskSnapshot = { state: turn, sample: sample() };
        }
    }
    if (scope === 'main' && [...LIVE_ITEMS, 'task-active-timer'].some(id => selected.has(id))) {
        const loaded = read(join(context.runtimeRoot, 'live', sha256(session ?? '') + '.json'));
        liveStatus = loaded.status;
        if (loaded.value) {
            liveTime = numeric(loaded.value.heartbeat_at_ms);
            live = validateState(loaded.value, session!);
            if (!live) liveStatus = 'invalid_field';
            else if (newer(live.heartbeat_at_ms)) { liveStatus = 'newer_than_input'; live = null; }
        }
        const switched = disabled(facts.runtime?.live_metrics);
        const matched = live && prompt ? canonicalPrompt(live, prompt) : null;
        // No inferred current prompt. Session-scoped permission remains independently usable.
        // Only the unique, time-eligible task may contribute to lifecycle state.
        // Passing the original history would reintroduce excluded future or ambiguous turns.
        const matchedHistory = history && turn ? { ...history, turns: [turn], current_prompt_id: turn.prompt_id } : null;
        const points = live && !switched ? snapshotMetrics(live, matchedHistory, prompt ?? '', at) : unavailable(switched ?? liveStatus);
        for (const id of LIVE_ITEMS) {
            let point = points[id]!;
            let status: Status = switched ?? (live ? id !== 'permission-mode' && !prompt ? 'association_unavailable' : id !== 'permission-mode' && !matched ? 'prompt_mismatch' : point.reason === 'stale' ? 'stale' : point.partial ? 'partial' : point.value != null ? 'observed' : point.reason === 'not_observed' ? 'not_observed' : 'source_unavailable' : liveStatus);
            if (newer(point.observed_at_ms)) status = 'newer_than_input';
            if (!['observed', 'partial'].includes(status)) points[id] = { ...point, value: null, reason: status };
            put([id], report(typeof point.source === 'string' ? point.source : 'live_store', id === 'permission-mode' ? 'session' : 'task', status, point.observed_at_ms ?? liveTime, fresh(live, at)));
        }
        if (selected.has('run-state')) result.get('run-state')!.push(report('task_store', 'task', taskStatus, taskTime));
        env.live = () => points;
        if (selected.has('task-active-timer')) {
            const off = disabled(facts.runtime?.native_timing);
            const point = off ? { value: null, reason: off } : activePoint(turn, true, fresh(live, at), sample);
            const status: Status = off ?? (turn === null ? taskStatus : point.reason === 'stale' ? 'stale' : point.value != null ? 'observed' : 'partial');
            put(['task-active-timer'], report('native_task_timing', 'task', status, point.observed_at_ms ?? liveTime, fresh(live, at)));
            env.activePoint = () => point;
        }
    }
    if (scope === 'main' && [...USAGE, 'task-timer'].some(id => selected.has(id))) {
        const loaded = read(join(context.cacheRoot, 'statusline_usage_v2', 'state.json'));
        let status = loaded.status, observation: UsageObservation | null = null;
        const entry = object(loaded.value?.sessions) && session ? own(loaded.value.sessions, session) : null;
        if (loaded.value) {
            if (!object(loaded.value.sessions)) status = 'invalid_field';
            else if (!entry) status = 'not_observed';
            else if (!object(entry) || !object(entry.files) || !object(entry.ids) || !object(entry.base)) status = 'invalid_field';
            else if (![entry.base, ...Object.values(entry.ids)].every(row => object(row) && ['i','o','cc','cr'].every(key => typeof row[key] !== 'boolean' && int(row[key]) !== null && int(row[key])! >= 0n))) status = 'invalid_field';
            else if (!identity(input.transcript_path)) status = 'association_unavailable';
            else if (!Object.keys(entry.files).some(path => resolve(path) === resolve(input.transcript_path as string))) status = 'session_mismatch';
            // Legacy usage caches have no observation timestamp. They cannot reconstruct a supplied historical instant.
            else if (inputTime !== null) status = 'association_unavailable';
            else if (entry.usage_incomplete === true) status = 'partial';
            else {
                const counts = sessionTokenCounts(entry as UsageEntry);
                status = counts ? 'observed' : 'not_observed';
                if (counts) observation = { hit: counts.hit === null ? null : usageTokenText(counts.hit), miss: counts.miss === null ? null : usageTokenText(counts.miss), out: counts.out === null ? null : usageTokenText(counts.out), last_prompt: entry.last_pt ?? null, entry, counts };
            }
        }
        put(USAGE, report('usage_cache', 'session', status));
        if (observation?.counts) {
            if (observation.counts.input_tokens === null) put(['input-tokens'], report('usage_cache','session','not_observed'));
            if (observation.counts.out === null) put(['output-tokens'], report('usage_cache','session','not_observed'));
            if (observation.counts.input_tokens === null || observation.counts.out === null) put(['tokens'], report('usage_cache','session','partial'));
        }
        env.usage = () => observation;
    }
    if (scope === 'main' && GIT.some(id => selected.has(id))) {
        const loaded = read(join(context.cacheRoot, 'git_cache', sha256(session ?? '') + '.json'));
        let status = loaded.status, stamp: number | null = null;
        if (loaded.value) {
            const cwd = liveDirectory(input); stamp = nsMs(loaded.value.checked_ns);
            if (int(loaded.value.version) !== BigInt(GIT_CACHE_VERSION) || !validGitResult(loaded.value.value)) status = 'invalid_field';
            else if (!cwd || loaded.value.cwd !== resolve(cwd)) status = 'association_unavailable';
            else if (newer(stamp)) status = 'newer_than_input';
            else if (stamp === null || at - stamp < 0 || at - stamp > Number(GIT_CACHE_TTL_NS / 1000000n)) status = 'stale';
            else { status = 'observed'; const value = loaded.value.value; env.git = () => value; }
        }
        put(GIT, report('git_cache', 'repository', status, stamp, status === 'observed'));
    }
    if (selected.has('branch-diff')) put(['branch-diff'], report('git_commit_cache', 'repository', includeLocal ? 'association_unavailable' : 'input_only'));
    if (selected.has('hostname')) {
        if (!includeLocal) env.hostname = () => null;
        put(['hostname'], report('local_system', 'local', includeLocal ? 'observed' : 'input_only', includeLocal ? now : null));
    }
    if (scope === 'subagent' && ['elapsed', 'status-elapsed'].some(id => selected.has(id))) {
        const loaded = read(join(context.runtimeRoot, 'agent-durations', sha256(session ?? '') + '.json'));
        const endings: Data = {}, reports: DiagnosticEvidence[] = [];
        for (const raw of Array.isArray(input.tasks) ? input.tasks : []) {
            if (!object(raw) || !identity(raw.id)) continue;
            let status = loaded.status;
            const saved = object(loaded.value?.agents) ? own(loaded.value.agents, raw.id as string) : null;
            const end = object(saved) ? numeric(saved.ended_at_ms) : null;
            if (loaded.value) {
                status = loaded.value.session_id !== session || !object(loaded.value.agents) ? 'invalid_field' : !object(saved) ? 'not_observed' : !prompt ? 'association_unavailable' : saved.prompt_id !== (turn?.prompt_id ?? prompt) ? 'prompt_mismatch' : newer(end) ? 'newer_than_input' : end === null ? 'not_observed' : 'observed';
                if (status === 'observed' && (end === null || !Number.isFinite(end) || end < 0)) status = 'invalid_field';
                if (status === 'observed') endings[raw.id as string] = end;
            }
            reports.push(report('agent_duration_store', 'subagent:' + raw.id, status, end));
        }
        env.agentEndings = () => endings;
        for (const id of ['elapsed', 'status-elapsed']) result.set(id, reports);
    }
    return result;
}
