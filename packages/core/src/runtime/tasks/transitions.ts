import { int, truth, string, numeric, object, maxInt, compareInt, type Data } from '../values.js';
import { END_PRIORITY, TERMINAL_STATUSES, recordKey, elapsedNs, findTurn, newRecord, rememberId, pruneTurns, type Turn, type TaskStore } from './model.js';
export function priority(source: unknown): number { return typeof source === 'string' && Object.hasOwn(END_PRIORITY, source) ? END_PRIORITY[source]! : 0; }
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
        duration_ns: elapsedNs(record, wall, boot, domain), duration_source: 'task', stop_candidate: null, updated_wall_ns: updated, phase: 'main', active_agents: {} });
    return true;
}
export function agentWorkPending(record: Turn | null): boolean {
    return record?.status === 'running' && (record.had_subagents || truth(record.active_agents) || ['waiting_subagents', 'resuming_main'].includes(record.phase));
}
export function reopenLowPriority(record: Turn, wall: bigint): boolean {
    if (record.historical_frozen)
        return false;
    if (record.status === 'running')
        return true;
    if (!['transcript_duration', 'registry_idle', 'hook_stop'].includes(String(record.end_source)))
        return false;
    Object.assign(record, { status: 'running', ended_wall_ns: null, ended_boot_ns: null, duration_ns: null, duration_source: null, end_source: null, end_reason: null, error: null, updated_wall_ns: wall });
    return true;
}
export function applyPrompt(store: TaskStore, promptId: unknown, wallValue: unknown): Turn | null {
    const wall = int(wallValue, false);
    if (!truth(promptId) || wall === null)
        return null;
    const prompt = string(promptId), previous = findTurn(store, store.current_prompt_id);
    let record = findTurn(store, prompt);
    if (!record) {
        record = newRecord(prompt, { wall_ns: wall, boot_ns: null, boot_id: null }, 'transcript');
        store.turns.push(record);
    }
    else {
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
    if (previous && previous !== record && previous.status === 'running' && previousStart !== null && previousStart <= wall)
        finishRecord(previous, 'unknown', wall, null, null, 'next_prompt', 'superseded_without_terminal_event');
    const start = int(record.started_wall_ns, false);
    if (!previous || previous === record || previousStart === null || start !== null && start >= previousStart)
        store.current_prompt_id = record.prompt_id;
    return record;
}
export function applyInterrupt(store: TaskStore, wallValue: unknown): Turn | null {
    const wall = int(wallValue, false);
    if (wall === null)
        return null;
    const candidates = store.turns.filter(record => {
        const start = int(record.started_wall_ns, false), end = int(record.ended_wall_ns, false);
        return (record.status === 'running' || ['next_prompt', 'registry_idle', 'transcript_duration'].includes(String(record.end_source)) && end !== null && wall <= end) && start !== null && start <= wall;
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
    if (!truth(promptId) || !record || wall === null || record.status !== 'running' || wall < (int(record.started_wall_ns, false) ?? 0n))
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
export function applyAgentNotification(store: TaskStore, promptValue: unknown, agentValue: unknown, wallValue: unknown): Turn | null {
    const wall = int(wallValue, false);
    if (!truth(agentValue) || wall === null)
        return null;
    const owners = store.turns.filter(item => item.agent_ids.includes(agentValue as string));
    if (owners.length !== 1)
        return null;
    const record = owners[0]!, prompt = truth(promptValue) ? string(promptValue) : null, agent = string(agentValue);
    if (prompt && record.report_aliases.includes(prompt))
        return record;
    const pending = record.pending_agent_reports.includes(agent);
    if (prompt) {
        rememberId(record, 'prompt_aliases', prompt);
        rememberId(record, 'report_aliases', prompt);
    }
    if (pending)
        record.pending_agent_reports.splice(record.pending_agent_reports.indexOf(agent), 1);
    if (pending && !record.historical_frozen && record.status === 'completed' && ['hook_stop', 'native_turn_end'].includes(String(record.end_source)) && store.current_prompt_id === record.prompt_id) {
        Object.assign(record, { status: 'running', ended_wall_ns: null, ended_boot_ns: null, duration_ns: null, duration_source: null, end_source: null, end_reason: null, error: null, phase: 'resuming_main' });
    }
    if (pending && record.status === 'running') {
        record.stop_candidate = null;
        record.phase = 'resuming_main';
    }
    if (record.status === 'running')
        record.updated_wall_ns = maxInt([recordKey(record), wall]);
    return record;
}
export function applyDuration(store: TaskStore, promptId: unknown, wallValue: unknown, duration: unknown): Turn | null {
    const wall = int(wallValue), ms = numeric(duration);
    if (!truth(promptId) || wall === null || ms === null || !Number.isFinite(ms) || ms < 0 || ms > 1e15)
        return null;
    const record = findTurn(store, promptId);
    if (!record || wall < (int(record.started_wall_ns, false) ?? 0n))
        return null;
    if (['failed', 'interrupted', 'ignored', 'withdrawn'].includes(record.status))
        return record;
    if (record.native_duration_ms == null)
        record.native_duration_ms = duration;
    const assistant = int(record.last_assistant_wall_ns, false), ready = object(record.stop_candidate) || !record.had_subagents && assistant !== null && assistant >= (int(record.started_wall_ns, false) ?? 0n);
    if (ready && !truth(record.active_agents) && !(record.report_aliases.length && record.pending_agent_reports.length))
        finishRecord(record, 'completed', wall, null, null, 'transcript_duration', 'turn_duration');
    return record;
}
export function confirmCompletion(store: TaskStore, promptId: unknown, wall: bigint, source = 'native_turn_end', duration: unknown = null, status = 'completed'): string | null {
    const record = findTurn(store, promptId);
    if (!record)
        return store.current_prompt_id;
    if (status === 'completed' && (truth(record.active_agents) || record.report_aliases.length && record.pending_agent_reports.length))
        return store.current_prompt_id;
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
    if (!record || wall === null)
        return null;
    if (truth(record.active_agents) || record.report_aliases.length && record.pending_agent_reports.length)
        return record;
    const candidate = record.stop_candidate, proof = truth(candidate) || record.end_source === 'session_exit_pending' || truth(record.last_assistant_wall_ns);
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
export function reconcileTranscript(store: TaskStore, observations: readonly unknown[]): string | null {
    const indexed = observations.map((event, index) => ({ event, index })).sort((a, b) => compareInt(object(a.event) ? int(a.event.wall_ns, false) ?? 0n : 0n, object(b.event) ? int(b.event.wall_ns, false) ?? 0n : 0n) || a.index - b.index);
    let observed: string | null = null;
    for (const { event } of indexed) {
        if (!object(event))
            continue;
        let target: unknown = truth(event.prompt_id) ? event.prompt_id : observed;
        if (target === null && !Object.hasOwn(event, 'prompt_id') && store.turns.length === 1)
            target = store.turns[0]!.prompt_id;
        if (event.kind === 'prompt') {
            const record = applyPrompt(store, event.prompt_id, event.wall_ns);
            if (record)
                observed = record.prompt_id;
        }
        else if (event.kind === 'interrupt')
            applyInterrupt(store, event.wall_ns);
        else if (event.kind === 'local_command')
            applyLocalCommand(store, event.prompt_id, event.wall_ns);
        else if (event.kind === 'agent_notification') {
            const record = applyAgentNotification(store, event.prompt_id, event.agent_id, event.wall_ns);
            if (record)
                observed = record.prompt_id;
        }
        else if (event.kind === 'assistant')
            applyAssistant(store, target, event.wall_ns);
        else if (event.kind === 'confirmed_stop')
            applyConfirmedStop(store, target, event.wall_ns);
        else if (event.kind === 'turn_duration')
            applyDuration(store, target, event.wall_ns, event.duration_ms);
    }
    pruneTurns(store);
    return store.current_prompt_id ?? observed;
}
export function reconcileIdle(store: TaskStore, promptId: string, wall: bigint): string {
    const record = findTurn(store, promptId);
    if (!record || record.status !== 'running')
        return promptId;
    const confirmed = object(record.stop_candidate) && !truth(record.active_agents) && !(record.report_aliases.length && record.pending_agent_reports.length);
    if (agentWorkPending(record) && !confirmed)
        return promptId;
    const start = int(record.started_wall_ns, false);
    if (start !== null && wall < start)
        return promptId;
    const assistant = int(record.last_assistant_wall_ns, false), completed = assistant !== null && (start === null || assistant >= start);
    finishRecord(record, completed ? 'completed' : 'withdrawn', wall, null, null, completed ? 'registry_idle' : 'registry_withdrawn', completed ? 'idle_after_assistant' : 'pre_response_cancel');
    return promptId;
}
export function withdrawPrompt(store: TaskStore, promptId: string, wall: bigint): string {
    const record = findTurn(store, promptId);
    if (record?.status === 'running' && !agentWorkPending(record))
        finishRecord(record, 'withdrawn', wall, null, null, 'registry_withdrawn', 'pre_response_cancel');
    return promptId;
}
