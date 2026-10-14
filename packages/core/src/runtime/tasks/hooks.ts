import type { Sample } from '../../timing/sample.js';
import { int, truth, string, object, type Data } from '../values.js';
import { findTurn, upsertTurn, terminalRecord, agentNotificationId, cleanActiveAgents, rememberId, elapsedNs, TERMINAL_STATUSES, type Turn, type TaskStore } from './model.js';
import { applyAgentNotification, applyLocalCommand, finishRecord, reopenLowPriority, priority } from './transitions.js';
import { authoritativeSubagents, startSubagent, stopSubagent } from './agents.js';
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
export function applyHook(store: TaskStore, data: Data, clocks: Sample, evidence: Evidence = {}): string | null {
    const { wall_ns: wall, boot_ns: boot, boot_id: domain } = clocks;
    const event = data.hook_event_name, prompt = truth(data.prompt_id) ? string(data.prompt_id) : null;
    if (event === 'SubagentStart')
        return startSubagent(store, prompt, data, wall);
    if (event === 'SubagentStop')
        return stopSubagent(store, prompt, data, wall);
    if (truth(data.agent_id))
        return store.current_prompt_id;
    if (event === 'UserPromptSubmit') {
        if (!prompt)
            return store.current_prompt_id;
        const notification = agentNotificationId(data.prompt);
        if (notification) {
            if (!applyAgentNotification(store, prompt, notification, wall))
                applyLocalCommand(store, prompt, wall);
            return store.current_prompt_id;
        }
        const record = findTurn(store, prompt);
        if (!record)
            upsertTurn(store, prompt, clocks, 'hook_submit');
        const previous = findTurn(store, store.current_prompt_id);
        if (previous && record && previous !== record && (int(record.started_wall_ns, false) ?? 0n) < (int(previous.started_wall_ns, false) ?? 0n))
            return store.current_prompt_id;
        if (previous && previous.prompt_id !== prompt && previous.status === 'running')
            finishRecord(previous, 'unknown', wall, boot, domain, 'next_prompt', 'superseded_without_terminal_event');
        store.current_prompt_id = prompt;
        return prompt;
    }
    if (event === 'Stop') {
        const target = prompt ?? store.current_prompt_id;
        if (!target)
            return store.current_prompt_id;
        const current = findTurn(store, store.current_prompt_id), record = terminalRecord(store, target, clocks);
        if (['failed', 'interrupted', 'ignored'].includes(record.status))
            return store.current_prompt_id;
        refreshStartEvidence(record, data, 'hook_stop', evidence);
        const snapshot = authoritativeSubagents(data.background_tasks, record.active_agents, wall);
        if (snapshot !== null && (record.status === 'running' || truth(snapshot) && reopenLowPriority(record, wall))) {
            record.active_agents = snapshot;
            if (truth(snapshot)) {
                record.had_subagents = true;
                for (const agent of Object.keys(snapshot))
                    if (rememberId(record, 'agent_ids', agent))
                        rememberId(record, 'pending_agent_reports', agent);
            }
        }
        const active = cleanActiveAgents(record.active_agents), pending = record.report_aliases.length > 0 && record.pending_agent_reports.length > 0;
        if ((truth(active) || pending) && reopenLowPriority(record, wall)) {
            Object.assign(record, { status: 'running', phase: truth(active) ? 'waiting_subagents' : 'resuming_main', active_agents: active, ended_wall_ns: null, ended_boot_ns: null,
                duration_ns: null, duration_source: null, end_source: null, end_reason: null, error: null, updated_wall_ns: wall });
        }
        else if (record.status === 'running' && !truth(record.stop_candidate)) {
            record.stop_candidate = { wall_ns: wall, boot_ns: boot, boot_id: domain, duration_ns: elapsedNs(record, wall, boot, domain) };
            record.phase = 'stop_pending';
            record.updated_wall_ns = wall;
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
