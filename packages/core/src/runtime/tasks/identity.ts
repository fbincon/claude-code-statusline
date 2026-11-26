import { int, maxInt, numeric, own } from '../values.js';
import { cleanIds, lifecycleId, recordKey, rememberId, type TaskStore, type Turn } from './model.js';
import { syncAgentReports } from './agents.js';

export function supersededSubmission(record: Turn): boolean {
    return record.status === 'unknown' && record.end_source === 'next_prompt' && record.end_reason === 'superseded_without_terminal_event';
}

/** Evidence that the main loop began processing this task, rather than just receiving it. */
export function mainExecutionObserved(record: Turn, wall: bigint): boolean {
    const start = int(record.started_wall_ns, false);
    if (start === null || start > wall)
        return false;
    const activity = int(record.last_assistant_wall_ns, false);
    return activity !== null && start <= activity && activity <= wall || Object.values(record.native_turns).some(turn => {
        const began = numeric(turn.started_at_ms);
        return turn.agent_id === null && turn.start_observed === true && began !== null && began >= Number(start) / 1e6 && began <= Number(wall) / 1e6;
    });
}

function retainEarlierStart(record: Turn, duplicate: Turn): void {
    const previous = int(record.started_wall_ns, false), earlier = int(duplicate.started_wall_ns, false);
    if (record.status !== 'running' || record.historical_frozen || earlier === null || previous !== null && earlier >= previous)
        return;
    const originalBoot = int(record.started_boot_ns, false), duplicateBoot = int(duplicate.started_boot_ns, false);
    const offset = previous === null ? null : previous - earlier;
    const boot = duplicateBoot !== null && typeof duplicate.boot_id === 'string' ? duplicateBoot :
        originalBoot !== null && offset !== null && originalBoot >= offset ? originalBoot - offset : null;
    const domain = boot === null ? null : duplicateBoot !== null && typeof duplicate.boot_id === 'string' ? duplicate.boot_id : record.boot_id;
    Object.assign(record, { started_wall_ns: earlier, started_boot_ns: boot, boot_id: domain, start_source: duplicate.start_source });
}

function retainEvidence(record: Turn, duplicate: Turn): void {
    retainEarlierStart(record, duplicate);
    record.submission_verified ||= duplicate.submission_verified;
    record.had_subagents ||= duplicate.had_subagents;
    record.agent_ids = cleanIds([...duplicate.agent_ids, ...record.agent_ids]);
    record.report_aliases = cleanIds([...duplicate.report_aliases, ...record.report_aliases]);
    record.native_wait_seen = cleanIds([...duplicate.native_wait_seen, ...record.native_wait_seen]);
    record.native_turns = Object.fromEntries(Object.entries({ ...duplicate.native_turns, ...record.native_turns }).slice(-256));
    record.native_duration_ms ??= duplicate.native_duration_ms;
    if (record.active_clock == null) {
        record.active_clock = duplicate.active_clock;
        record.active_coverage = duplicate.active_coverage;
    }
    for (const field of ['last_assistant_wall_ns', 'continuation_wall_ns', 'background_snapshot_wall_ns'] as const) {
        const other = int(duplicate[field], false), current = int(record[field], false);
        if (other !== null && (current === null || other > current))
            record[field] = other;
    }
    for (const [id, evidence] of Object.entries(duplicate.agent_evidence))
        if (!own(record.agent_evidence, id))
            Object.defineProperty(record.agent_evidence, id, { value: evidence, enumerable: true, configurable: true, writable: true });
    if (record.status === 'running') {
        record.active_agents = { ...duplicate.active_agents, ...record.active_agents };
        record.stop_candidate ??= duplicate.stop_candidate;
        if (record.phase === 'main' && duplicate.status === 'running')
            record.phase = duplicate.phase;
    }
    syncAgentReports(record);
    record.updated_wall_ns = maxInt([recordKey(record), recordKey(duplicate)]);
}

/** Join an explicit host identity pair. A transcript row claims one message per prompt. */
export function linkTask(history: TaskStore, alias: string, target: string, transcriptPair = false): Turn | null {
    if (!lifecycleId(alias) || !lifecycleId(target) || alias === target)
        return null;
    const owners = (id: string) => history.turns.filter(row => row.prompt_id === id || row.prompt_aliases.includes(id));
    const originalOwners = owners(alias), messageOwners = owners(target);
    if (originalOwners.length > 1 || messageOwners.length > 1)
        return null;
    const original = originalOwners[0], message = messageOwners[0];
    if (original && original === message)
        return original;
    if (transcriptPair && (original?.prompt_aliases.some(id => !original.report_aliases.includes(id)) ||
        message?.prompt_aliases.some(id => !message.report_aliases.includes(id))))
        return null;
    let record = original ?? message;
    if (!record || record.configuration_prompt || record.report_aliases.includes(alias) || record.report_aliases.includes(target))
        return null;
    if (original && message) {
        if (message.configuration_prompt || message.report_aliases.includes(alias) || message.report_aliases.includes(target))
            return null;
        const settled = (row: Turn) => row.status !== 'running' && !supersededSubmission(row);
        if (settled(original) && settled(message) && (original.status !== message.status ||
            int(original.ended_wall_ns) !== int(message.ended_wall_ns) || int(original.duration_ns) !== int(message.duration_ns)))
            return null;
        if (supersededSubmission(original) && !supersededSubmission(message) || settled(message) && !settled(original) ||
            original.status === 'running' && message.status === 'running' &&
            (original.active_clock == null && message.active_clock != null || !Object.keys(original.native_turns).length && Object.keys(message.native_turns).length > 0))
            record = message;
        const duplicate = record === original ? message : original;
        retainEvidence(record, duplicate);
        for (const id of [duplicate.prompt_id, ...duplicate.prompt_aliases])
            if (id !== record.prompt_id)
                rememberId(record, 'prompt_aliases', id);
        history.turns.splice(history.turns.indexOf(duplicate), 1);
        if (history.current_prompt_id === duplicate.prompt_id)
            history.current_prompt_id = record.prompt_id;
    }
    for (const id of [alias, target])
        if (id !== record.prompt_id)
            rememberId(record, 'prompt_aliases', id);
    if (history.current_prompt_id === alias || history.current_prompt_id === target)
        history.current_prompt_id = record.prompt_id;
    return record;
}
