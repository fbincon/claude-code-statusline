import type { Sample } from '../../timing/sample.js';
import { int, truth, string, object, maxInt, numeric, type Data } from '../values.js';
import { findTurn, upsertTurn, terminalRecord, agentNotificationIds, lifecycleId, elapsedNs, recordKey, TERMINAL_STATUSES, type Turn, type TaskStore } from './model.js';
import { applyAgentNotification, endIsCurrent, finishRecord, noteEndEvidence, priority, reconcileNotifications } from './transitions.js';
import { agentWorkPending, reconcileBackground, startSubagent, stopSubagent } from './agents.js';
import { mainExecutionObserved } from './identity.js';
export interface Evidence {
    submissionNs?: bigint | null;
    modifiedNs?: bigint | null;
}
export function needsSubmission(record: Turn | null, source: string): boolean {
    return record === null || !record.submission_verified && !record.historical_frozen && !(TERMINAL_STATUSES.has(record.status) && priority(record.end_source) >= priority(source));
}
export function refreshStartEvidence(record: Turn, data: Data, source: string, evidence: Evidence): void {
    if (!needsSubmission(record, source) || typeof data.transcript_path !== 'string' || evidence.submissionNs == null)
        return;
    const started = evidence.submissionNs;
    record.submission_verified = true;
    const previous = int(record.started_wall_ns, false);
    if (previous !== null && started >= previous)
        return;
    const boot = int(record.started_boot_ns, false), offset = previous === null ? null : previous - started;
    record.started_boot_ns = boot !== null && offset !== null && offset >= 0n && offset <= boot ? boot - offset : null;
    if (record.started_boot_ns === null)
        record.boot_id = null;
    record.started_wall_ns = started;
    record.start_source = 'transcript';
}
export function notificationPrompt(store: TaskStore, prompt: string): boolean {
    return store.unresolved_notifications?.some(row => row.delivered && row.prompt_id === prompt) === true ||
        store.turns.some(row => row.report_aliases.includes(prompt));
}
export function stopTarget(store: TaskStore, prompt: string | null, wall: bigint): string | null {
    if (prompt)
        return findTurn(store, prompt)?.prompt_id ??
            (notificationPrompt(store, prompt) || store.turns.some(row => row.prompt_aliases.includes(prompt)) ? null : prompt);
    const candidates = store.turns.filter(record => record.status === 'running' && endIsCurrent(record, wall));
    if (candidates.length !== 1)
        return null;
    const record = candidates[0]!, start = int(record.started_wall_ns, false);
    if (start === null || store.current_prompt_id !== record.prompt_id)
        return null;
    const beganMain = mainExecutionObserved(record, wall);
    const ambiguous = store.turns.some(item => item !== record && (int(item.started_wall_ns, false) ?? start) < start &&
        (item.end_source === 'next_prompt' && (int(item.ended_wall_ns, false) ?? -1n) >= start ||
         Object.values(item.native_turns).some(turn => turn.agent_id === null && turn.start_observed === true &&
            (numeric(turn.started_at_ms) ?? Infinity) <= Number(wall) / 1e6 &&
            (numeric(turn.ended_at_ms) ?? Infinity) > Number(start) / 1e6)));
    return ambiguous && !beganMain ? null : record.prompt_id;
}
export function blockConfigurationPrompt(store: TaskStore, promptValue: unknown, began: bigint, clocks: Sample): string | null {
    const prompt = lifecycleId(promptValue);
    const matches = store.turns.filter(record => record.configuration_prompt && ['running', 'withdrawn'].includes(record.status) &&
        (prompt === null || prompt === record.prompt_id || record.prompt_aliases.includes(prompt)) &&
        (int(record.started_wall_ns, false) ?? clocks.wall_ns + 1n) <= clocks.wall_ns);
    if (matches.length !== 1)
        return store.current_prompt_id;
    const record = matches[0]!, start = int(record.started_wall_ns, false)!;
    if (prompt === null && store.turns.some(item => !item.configuration_prompt && (int(item.started_wall_ns, false) ?? 0n) > start &&
        (int(item.started_wall_ns, false) ?? 0n) <= began))
        return store.current_prompt_id;
    finishRecord(record, 'ignored', clocks.wall_ns, clocks.boot_ns, clocks.boot_id, 'local_command', 'blocked_statusline_configure');
    return store.current_prompt_id ?? record.prompt_id;
}
export function applyHook(store: TaskStore, data: Data, clocks: Sample, evidence: Evidence = {}): string | null {
    const { wall_ns: wall, boot_ns: boot, boot_id: domain } = clocks;
    const event = data.hook_event_name, prompt = lifecycleId(data.prompt_id);
    if (event === 'SubagentStart' || event === 'SubagentStop') {
        (event === 'SubagentStart' ? startSubagent : stopSubagent)(store, prompt, data, wall);
        reconcileNotifications(store);
        return store.current_prompt_id;
    }
    if (truth(data.agent_id))
        return store.current_prompt_id;
    if (event === 'UserPromptSubmit') {
        const notifications = agentNotificationIds(data.prompt);
        if (notifications.length) {
            for (const agent of notifications)
                applyAgentNotification(store, prompt, agent, wall);
            return store.current_prompt_id;
        }
        if (!prompt)
            return store.current_prompt_id;
        const existing = findTurn(store, prompt);
        if (typeof data.prompt === 'string' && /^\s*\/statusline-configure(?:\s|$)/u.test(data.prompt)) {
            if (!existing)
                upsertTurn(store, prompt, clocks, 'hook_submit')!.configuration_prompt = true;
            return store.current_prompt_id ?? prompt;
        }
        if (existing?.configuration_prompt || existing?.report_aliases.includes(prompt) && prompt !== existing.prompt_id)
            return store.current_prompt_id;
        const previous = store.current_prompt_id ? findTurn(store, store.current_prompt_id) : null;
        const record = existing ?? upsertTurn(store, prompt, clocks, 'hook_submit')!;
        if (previous && previous !== record && (int(record.started_wall_ns, false) ?? 0n) < (int(previous.started_wall_ns, false) ?? 0n))
            return store.current_prompt_id;
        if (previous && previous !== record && previous.status === 'running')
            finishRecord(previous, 'unknown', wall, boot, domain, 'next_prompt', 'superseded_without_terminal_event');
        store.current_prompt_id = record.prompt_id;
        return record.prompt_id;
    }
    if (event === 'Stop') {
        const target = stopTarget(store, prompt, wall);
        if (!target)
            return store.current_prompt_id;
        const current = findTurn(store, store.current_prompt_id), record = terminalRecord(store, target, clocks);
        if (record.status !== 'running' || !endIsCurrent(record, wall))
            return store.current_prompt_id;
        refreshStartEvidence(record, data, 'hook_stop', evidence);
        reconcileBackground(store, record, data.background_tasks, wall);
        reconcileNotifications(store);
        if (!endIsCurrent(record, wall))
            return store.current_prompt_id;
        if (agentWorkPending(record)) {
            record.phase = truth(record.active_agents) ? 'waiting_subagents' : 'resuming_main';
            record.stop_candidate = null;
            record.duration_source = null;
            noteEndEvidence(record, wall, 'hook_stop');
            record.updated_wall_ns = maxInt([recordKey(record), wall]);
        }
        else if (!truth(record.stop_candidate)) {
            record.stop_candidate = { wall_ns: wall, boot_ns: boot, boot_id: domain, duration_ns: elapsedNs(record, wall, boot, domain) };
            record.phase = 'stop_pending';
            noteEndEvidence(record, wall, 'hook_stop');
            record.updated_wall_ns = maxInt([recordKey(record), wall]);
        }
        if (store.current_prompt_id === null || store.current_prompt_id === target || current && ['ignored', 'withdrawn'].includes(current.status))
            store.current_prompt_id = record.prompt_id;
        return store.current_prompt_id;
    }
    if (event === 'StopFailure') {
        const error = truth(data.error) ? string(data.error) : 'unknown', target = prompt ?? store.current_prompt_id;
        if (!target)
            return store.current_prompt_id;
        const current = findTurn(store, store.current_prompt_id), record = terminalRecord(store, target, clocks);
        refreshStartEvidence(record, data, 'hook_stop_failure', evidence);
        finishRecord(record, 'failed', wall, boot, domain, 'hook_stop_failure', 'stop_failure', error);
        if (store.current_prompt_id === null || store.current_prompt_id === target || current && ['ignored', 'withdrawn'].includes(current.status))
            store.current_prompt_id = record.prompt_id;
        return store.current_prompt_id;
    }
    if (event === 'SessionEnd') {
        const target = prompt ?? store.current_prompt_id, record = findTurn(store, target);
        if (record?.status === 'running') {
            refreshStartEvidence(record, data, 'hook_session_end', evidence);
            const candidate = record.stop_candidate;
            if (object(candidate) && (!Object.hasOwn(data, 'reason') || data.reason === 'other')) {
                const at = int(candidate.wall_ns);
                if (at !== null)
                    finishRecord(record, 'unknown', at, int(candidate.boot_ns), typeof candidate.boot_id === 'string' ? candidate.boot_id : null, 'session_exit_pending', 'unconfirmed_stop_before_exit', null, wall);
                return store.current_prompt_id;
            }
            finishRecord(record, 'interrupted', wall, boot, domain, 'hook_session_end', 'session_end:' + (truth(data.reason) ? string(data.reason) : 'other'));
        }
        return store.current_prompt_id;
    }
    if (event === 'SessionStart') {
        const source = truth(data.source) ? string(data.source) : 'startup', record = findTurn(store, store.current_prompt_id);
        if (['startup', 'resume'].includes(source) && record?.status === 'running') {
            let lower = truth(record.started_wall_ns) ? int(record.started_wall_ns, false) ?? wall : wall;
            if (typeof data.transcript_path === 'string' && evidence.modifiedNs != null && evidence.modifiedNs > lower)
                lower = evidence.modifiedNs;
            finishRecord(record, 'unknown', lower > wall ? wall : lower, null, null, 'session_start', 'unconfirmed_previous_run', null, wall);
        }
    }
    return store.current_prompt_id;
}
