import { int, truth, string, numeric, object, maxInt, compareInt, type Data } from '../values.js';
import { StatusTimer } from '../../timing/timer.js';
import { END_PRIORITY, TERMINAL_STATUSES, MAX_AGENT_HISTORY, recordKey, elapsedNs, findTurn, lifecycleId, newRecord, rememberId, pruneTurns, type AgentNotice, type Turn, type TaskStore } from './model.js';
import { agentEvidence, agentWorkPending, agentsObservedThrough, clearSnapshotOnlyAgents, findAgentOwner, hasObservedAgentEnd, syncAgentPhase, syncAgentReports } from './agents.js';
import { linkTask } from './identity.js';
export function priority(source: unknown): number { return typeof source === 'string' && Object.hasOwn(END_PRIORITY, source) ? END_PRIORITY[source]! : 0; }
export function noteEndEvidence(record: Turn, wall: bigint, source: string): void {
    const previous = object(record.last_end_evidence) ? record.last_end_evidence : null, stamp = int(previous?.wall_ns, false);
    if (stamp === null || wall > stamp || wall === stamp && priority(source) >= priority(previous?.source))
        record.last_end_evidence = { wall_ns: wall, source };
}
export function finishRecord(record: Turn, status: string, wall: bigint, boot: bigint | null, domain: string | null, source: string, reason: string, error: unknown = null, updated = wall): boolean {
    if (record.historical_frozen)
        return false;
    if (TERMINAL_STATUSES.has(record.status)) {
        const end = int(record.ended_wall_ns, false);
        const reportedBeforeExit = source === 'native_turn_end' && record.end_source === 'hook_session_end' && end !== null && wall <= end;
        if (priority(source) <= priority(record.end_source) && !reportedBeforeExit)
            return false;
    }
    Object.assign(record, { status, ended_wall_ns: wall, ended_boot_ns: record.boot_id === domain ? boot : null, end_source: source, end_reason: reason, error,
        duration_ns: elapsedNs(record, wall, boot, domain), duration_source: 'task', stop_candidate: null, updated_wall_ns: maxInt([recordKey(record), updated]), phase: 'main',
        active_agents: {}, last_end_evidence: null });
    if (status === 'completed')
        syncAgentReports(record);
    return true;
}
export function activityBoundary(record: Turn): bigint {
    return maxInt([int(record.started_wall_ns, false) ?? 0n, int(record.continuation_wall_ns, false) ?? 0n,
        int(record.last_assistant_wall_ns, false) ?? 0n, agentsObservedThrough(record)]);
}
export function endIsCurrent(record: Turn, wall: bigint): boolean {
    return !record.historical_frozen && !record.configuration_prompt && !['failed', 'interrupted', 'ignored', 'withdrawn'].includes(record.status) && wall >= activityBoundary(record);
}
export function reopenForContinuation(store: TaskStore, record: Turn, wall: bigint): boolean {
    const end = int(record.ended_wall_ns, false);
    if (record.status !== 'completed' || record.configuration_prompt || record.historical_frozen || store.current_prompt_id !== record.prompt_id ||
        end === null || wall <= end || !['transcript_stop', 'native_turn_end', 'hook_stop', 'registry_idle', 'transcript_duration'].includes(String(record.end_source)))
        return false;
    if (record.last_end_evidence == null)
        noteEndEvidence(record, end, String(record.end_source));
    const clock = StatusTimer.load(record.active_clock);
    Object.assign(record, { status: 'running', ended_wall_ns: null, ended_boot_ns: null, duration_ns: null, duration_source: null, end_source: null, end_reason: null,
        error: null, updated_wall_ns: maxInt([recordKey(record), wall]), continuation_wall_ns: wall, active_clock: clock?.reopen().toDict() ?? null });
    return true;
}
export function applyPrompt(store: TaskStore, promptId: unknown, wallValue: unknown): Turn | null {
    const wall = int(wallValue, false);
    if (!truth(promptId) || wall === null)
        return null;
    const prompt = string(promptId), previous = store.current_prompt_id ? findTurn(store, store.current_prompt_id) : null;
    let record = findTurn(store, prompt);
    if (!record) {
        record = newRecord(prompt, { wall_ns: wall, boot_ns: null, boot_id: null }, 'transcript');
        store.turns.push(record);
    }
    else {
        if (record.configuration_prompt)
            return record;
        const start = int(record.started_wall_ns, false);
        if (record.status === 'running' && (start === null || wall < start))
            Object.assign(record, { started_wall_ns: wall, started_boot_ns: null, boot_id: null, start_source: 'transcript' });
        if (record.status === 'running')
            record.submission_verified = true;
        if (!TERMINAL_STATUSES.has(record.status))
            record.status = 'running';
        if (record.status === 'running')
            record.updated_wall_ns = maxInt([recordKey(record), wall]);
    }
    const previousStart = previous ? int(previous.started_wall_ns, false) : null;
    const start = int(record.started_wall_ns, false);
    if (previous && previous !== record && previous.status === 'running' && previousStart !== null && start !== null && previousStart <= start)
        finishRecord(previous, 'unknown', wall, null, null, 'next_prompt', 'superseded_without_terminal_event');
    if (!previous || previous === record || previousStart === null || start !== null && start >= previousStart)
        store.current_prompt_id = record.prompt_id;
    return record;
}
export function applyInterrupt(store: TaskStore, wallValue: unknown, eligible?: ReadonlySet<Turn>): Turn | null {
    const wall = int(wallValue, false);
    if (wall === null)
        return null;
    const candidates = store.turns.filter(record => {
        const start = int(record.started_wall_ns, false), end = int(record.ended_wall_ns, false);
        return (!eligible || eligible.has(record)) && !record.configuration_prompt &&
            (record.status === 'running' || ['next_prompt', 'registry_idle', 'transcript_duration'].includes(String(record.end_source)) && end !== null && wall <= end) && start !== null && start <= wall;
    });
    if (!candidates.length)
        return null;
    const record = candidates.reduce((best, item) => (int(item.started_wall_ns, false) ?? 0n) > (int(best.started_wall_ns, false) ?? 0n) ? item : best);
    finishRecord(record, 'interrupted', wall, null, null, 'transcript_interrupt', 'user_interrupt');
    return record;
}
export function applyLocalCommand(store: TaskStore, promptId: unknown, wallValue: unknown): Turn | null {
    const wall = int(wallValue, false);
    if (!truth(promptId) || wall === null)
        return null;
    let record = findTurn(store, promptId);
    if (!record) {
        record = newRecord(promptId, { wall_ns: wall, boot_ns: null, boot_id: null }, 'local_command');
        store.turns.push(record);
    }
    finishRecord(record, 'ignored', wall, null, null, 'local_command', 'local_command');
    if (store.current_prompt_id === string(promptId)) {
        const running = store.turns.filter(item => item.status === 'running' && item.prompt_id !== string(promptId));
        store.current_prompt_id = running.length ? running.reduce((best, item) => recordKey(item) > recordKey(best) ? item : best).prompt_id : null;
    }
    return record;
}
export function applyAssistant(store: TaskStore, promptId: unknown, wallValue: unknown): Turn | null {
    const record = findTurn(store, promptId), wall = int(wallValue, false);
    if (!truth(promptId) || !record || wall === null || record.status !== 'running' || record.configuration_prompt ||
        wall < (int(record.started_wall_ns, false) ?? 0n) || wall < (int(record.continuation_wall_ns, false) ?? 0n))
        return null;
    const candidate = record.stop_candidate;
    if (object(candidate) && wall > (int(candidate.wall_ns) ?? wall)) {
        record.stop_candidate = null;
        record.phase = 'main';
    }
    const old = int(record.last_assistant_wall_ns, false);
    if (old === null || wall > old) {
        record.last_assistant_wall_ns = wall;
        record.updated_wall_ns = maxInt([recordKey(record), wall]);
    }
    if (record.phase === 'resuming_main' && !truth(record.active_agents))
        record.phase = 'main';
    return record;
}
function applyNotice(store: TaskStore, notice: AgentNotice, eligible?: ReadonlySet<Turn>): Turn | null {
    const { prompt_id: prompt, agent_id: agent, wall_ns: wall, delivered } = notice;
    const record = findAgentOwner(store, agent, prompt, wall);
    if (!record || record.historical_frozen || eligible && !eligible.has(record))
        return record;
    const row = agentEvidence(record, agent), previousDelivery = row.delivered_wall_ns;
    if (prompt && row.previous_delivery_aliases.includes(prompt))
        return record;
    const earlierQueue = row.queued_wall_ns;
    const alias = prompt && findTurn(store, prompt);
    if (delivered && prompt && (!alias || alias === record) && !store.turns.some(item => item !== record && item.prompt_aliases.includes(prompt))) {
        if (prompt !== record.prompt_id) {
            rememberId(record, 'prompt_aliases', prompt);
            if (!row.delivery_aliases.includes(prompt))
                row.delivery_aliases = [...row.delivery_aliases, prompt].slice(-8);
        }
        rememberId(record, 'report_aliases', prompt);
    }
    if (delivered && previousDelivery === null) row.delivered_wall_ns = wall;
    if (!delivered && earlierQueue === null) row.queued_wall_ns = wall;
    if (previousDelivery !== null || !delivered && earlierQueue !== null)
        return record;
    delete record.active_agents[agent];
    syncAgentReports(record);
    syncAgentPhase(record);
    const candidateWall = object(record.stop_candidate) ? int(record.stop_candidate.wall_ns, false) : null;
    const priorEnd = int(record.ended_wall_ns, false);
    const continued = delivered && (record.status === 'running' || reopenForContinuation(store, record, wall));
    if (continued && (priorEnd !== null || (candidateWall === null || wall > candidateWall) && wall > (int(record.last_assistant_wall_ns, false) ?? 0n))) {
        record.continuation_wall_ns = maxInt([int(record.continuation_wall_ns, false) ?? 0n, wall]);
        record.stop_candidate = null;
        record.phase = 'resuming_main';
    }
    if (record.status === 'running')
        record.updated_wall_ns = maxInt([recordKey(record), wall]);
    return record;
}
export function applyAgentNotification(store: TaskStore, promptValue: unknown, agentValue: unknown, wallValue: unknown, delivered = true, eligible?: ReadonlySet<Turn>): Turn | null {
    const agent = lifecycleId(agentValue), prompt = lifecycleId(promptValue), wall = int(wallValue, false);
    if (!agent || wall === null)
        return null;
    const notice: AgentNotice = { agent_id: agent, prompt_id: prompt, wall_ns: wall, delivered };
    const record = applyNotice(store, notice, eligible);
    if (!record && !eligible) {
        const pending = store.unresolved_notifications ??= [];
        if (!pending.some(row => row.agent_id === agent && row.prompt_id === prompt && row.wall_ns === wall && row.delivered === delivered)) {
            pending.push(notice);
            if (pending.length > MAX_AGENT_HISTORY)
                pending.shift();
        }
    }
    return record;
}
export function reconcileNotifications(store: TaskStore): void {
    if (store.unresolved_notifications) {
        const pending = store.unresolved_notifications.sort((first, second) => compareInt(first.wall_ns, second.wall_ns)).filter(notice => !applyNotice(store, notice));
        if (pending.length) store.unresolved_notifications = pending;
        else delete store.unresolved_notifications;
    }
}
export function applyDuration(store: TaskStore, promptId: unknown, wallValue: unknown, duration: unknown): Turn | null {
    const wall = int(wallValue), ms = numeric(duration);
    if (!truth(promptId) || wall === null || ms === null || !Number.isFinite(ms) || ms < 0 || ms > 1e15)
        return null;
    const record = findTurn(store, promptId);
    if (!record || !endIsCurrent(record, wall))
        return null;
    if (record.native_duration_ms == null)
        record.native_duration_ms = duration;
    const assistant = int(record.last_assistant_wall_ns, false);
    const ready = object(record.stop_candidate) || assistant !== null && assistant >= activityBoundary(record) ||
        record.continuation_wall_ns == null && record.last_end_evidence == null && hasObservedAgentEnd(record);
    if (record.status === 'running' && ready && agentWorkPending(record))
        noteEndEvidence(record, wall, 'transcript_duration');
    if (ready && !agentWorkPending(record))
        finishRecord(record, 'completed', wall, null, null, 'transcript_duration', 'turn_duration');
    return record;
}
export function confirmCompletion(store: TaskStore, promptId: unknown, wall: bigint, source = 'native_turn_end', duration: unknown = null, status = 'completed'): string | null {
    const record = findTurn(store, promptId);
    if (!record || !endIsCurrent(record, wall))
        return store.current_prompt_id;
    if (status === 'completed' && agentWorkPending(record)) {
        if (record.status === 'running')
            noteEndEvidence(record, wall, source);
        return store.current_prompt_id;
    }
    const candidate = record.stop_candidate;
    let end = wall, boot: bigint | null = null, domain: string | null = null;
    if (object(candidate)) {
        const stamp = int(candidate.wall_ns);
        if (stamp !== null && wall - stamp >= 0n && wall - stamp <= 2000000000n) {
            end = stamp;
            boot = int(candidate.boot_ns);
            domain = typeof candidate.boot_id === 'string' ? candidate.boot_id : null;
        }
    }
    if (duration !== null)
        record.native_duration_ms = duration;
    finishRecord(record, status, end, boot, domain, source, 'confirmed_main_end', null, wall);
    return store.current_prompt_id;
}
export function applyConfirmedStop(store: TaskStore, promptId: unknown, wallValue: unknown): Turn | null {
    const record = truth(promptId) ? findTurn(store, promptId) : null, wall = int(wallValue);
    if (!record || wall === null || !endIsCurrent(record, wall))
        return null;
    if (agentWorkPending(record)) {
        if (record.status === 'running')
            noteEndEvidence(record, wall, 'transcript_stop');
        return record;
    }
    const candidate = record.stop_candidate, assistant = int(record.last_assistant_wall_ns, false);
    const proof = truth(candidate) || record.end_source === 'session_exit_pending' || assistant !== null && assistant >= (int(record.continuation_wall_ns, false) ?? 0n);
    if (!proof || wall < (int(record.started_wall_ns, false) ?? 0n))
        return record;
    let boot: bigint | null = null, domain: string | null = null;
    if (object(candidate)) {
        const started = int(candidate.boot_ns), at = int(candidate.wall_ns);
        if (started !== null && at !== null) {
            boot = started + wall - at;
            domain = typeof candidate.boot_id === 'string' ? candidate.boot_id : null;
        }
    }
    finishRecord(record, 'completed', wall, boot, domain, 'transcript_stop', 'successful_stop_hooks');
    return record;
}
export function reconcileTranscript(store: TaskStore, observations: readonly unknown[], unfinishedOnly = false, preserve?: ReadonlySet<Turn>): string | null {
    const indexed = observations.map((event, index) => ({ event, index })).sort((a, b) => compareInt(object(a.event) ? int(a.event.wall_ns, false) ?? 0n : 0n, object(b.event) ? int(b.event.wall_ns, false) ?? 0n : 0n) || a.index - b.index);
    const pairs = new Map<string, string | null>();
    for (const { event } of indexed) {
        if (!object(event) || event.kind !== 'prompt' || int(event.wall_ns, false) === null)
            continue;
        const prompt = lifecycleId(event.prompt_id), message = lifecycleId(event.message_uuid);
        if (prompt && message && prompt !== message)
            for (const [from, to] of [[prompt, message], [message, prompt]] as const)
                pairs.set(from, !pairs.has(from) || pairs.get(from) === to ? to : null);
    }
    const link = (event: Data) => {
        const prompt = lifecycleId(event.prompt_id), message = lifecycleId(event.message_uuid);
        if (prompt && message && pairs.get(prompt) === message && pairs.get(message) === prompt)
            linkTask(store, prompt, message, true);
    };
    // Repair stored identities before any ending or activity is attributed. A
    // migration can repair a pair even when neither record is still running.
    for (const { event } of indexed)
        if (object(event) && event.kind === 'prompt')
            link(event);
    const eligible = unfinishedOnly || preserve ? new Set(store.turns.filter(record => !preserve?.has(record) && (!unfinishedOnly || record.status === 'running'))) : undefined;
    const mayApply = (prompt: unknown) => {
        if (!eligible) return true;
        const record = typeof prompt === 'string' ? findTurn(store, prompt) : null;
        return record ? eligible.has(record) : !unfinishedOnly;
    };
    let observed: string | null = null;
    for (const { event } of indexed) {
        if (!object(event))
            continue;
        const target = lifecycleId(event.prompt_id) ?? lifecycleId(event.context_prompt_id) ?? (!Object.hasOwn(event, 'prompt_id') ?
            observed ?? (store.turns.length === 1 ? store.turns[0]!.prompt_id : null) : null);
        if (event.kind === 'prompt') {
            const record = mayApply(event.prompt_id) ? applyPrompt(store, event.prompt_id, event.wall_ns) : null;
            if (record) eligible?.add(record);
            observed = record?.prompt_id ?? lifecycleId(event.prompt_id);
            link(event);
        }
        else if (event.kind === 'interrupt')
            applyInterrupt(store, event.wall_ns, eligible);
        else if (event.kind === 'local_command' && mayApply(event.prompt_id))
            applyLocalCommand(store, event.prompt_id, event.wall_ns);
        else if (event.kind === 'agent_notification') {
            const record = applyAgentNotification(store, event.prompt_id, event.agent_id, event.wall_ns, event.delivered !== false, eligible);
            if (record && event.delivered !== false)
                observed = record.prompt_id;
        }
        else if (event.kind === 'assistant' && mayApply(target))
            applyAssistant(store, target, event.wall_ns);
        else if (event.kind === 'confirmed_stop' && mayApply(target))
            applyConfirmedStop(store, target, event.wall_ns);
        else if (event.kind === 'turn_duration' && mayApply(target))
            applyDuration(store, target, event.wall_ns, event.duration_ms);
    }
    pruneTurns(store);
    return store.current_prompt_id ?? observed;
}
export function reconcileRegistry(store: TaskStore, promptId: string, wall: bigint, status: string): string {
    const record = findTurn(store, promptId);
    if (!record || record.status !== 'running' || wall < (int(record.started_wall_ns, false) ?? 0n))
        return promptId;
    const previous = object(record.registry_observation) ? int(record.registry_observation.wall_ns, false) : null;
    if (previous === null || wall > previous)
        record.registry_observation = { status, wall_ns: wall };
    if (status !== 'idle' || previous !== null && wall < previous || object(record.registry_observation) && record.registry_observation.status !== 'idle' ||
        wall < activityBoundary(record) || wall < (int(object(record.stop_candidate) ? record.stop_candidate.wall_ns : null, false) ?? 0n))
        return promptId;
    clearSnapshotOnlyAgents(record, wall);
    if (agentWorkPending(record))
        return promptId;
    const assistant = int(record.last_assistant_wall_ns, false), continuation = int(record.continuation_wall_ns, false);
    if (continuation !== null && (assistant === null || assistant < continuation) || assistant === null && hasObservedAgentEnd(record))
        return promptId;
    const completed = assistant !== null && assistant >= (int(record.started_wall_ns, false) ?? 0n);
    finishRecord(record, completed ? 'completed' : 'withdrawn', wall, null, null, completed ? 'registry_idle' : 'registry_withdrawn', completed ? 'idle_after_assistant' : 'pre_response_cancel');
    return promptId;
}
export function reconcileIdle(store: TaskStore, promptId: string, wall: bigint): string { return reconcileRegistry(store, promptId, wall, 'idle'); }
export function withdrawPrompt(store: TaskStore, promptId: string, wall: bigint): string {
    const record = findTurn(store, promptId);
    if (record?.status === 'running' && !record.had_subagents && !agentWorkPending(record))
        finishRecord(record, 'withdrawn', wall, null, null, 'registry_withdrawn', 'pre_response_cancel');
    return promptId;
}
