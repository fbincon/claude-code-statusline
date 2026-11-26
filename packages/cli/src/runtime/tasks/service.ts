import type { RuntimeContext } from '../context.js';
import { runtimeIO, type RuntimeIO } from '../io.js';
import { int, truth, string, object, type Data } from '@fbincon/statusline-core/runtime/values';
import { findTurn, lifecycleId } from '@fbincon/statusline-core/runtime/tasks/model';
import { applyHook, blockConfigurationPrompt, needsSubmission, stopTarget, type Evidence } from '@fbincon/statusline-core/runtime/tasks/hooks';
import { confirmCompletion, reconcileTranscript, reconcileRegistry, withdrawPrompt } from '@fbincon/statusline-core/runtime/tasks/transitions';
import { supersededSubmission } from '@fbincon/statusline-core/runtime/tasks/identity';
import { TaskStore } from './store.js';
import { SubmissionIndex } from './submissions.js';
export class TaskService {
    readonly store: TaskStore;
    readonly submissions: SubmissionIndex;
    constructor(public readonly context: RuntimeContext, public readonly io: RuntimeIO = runtimeIO()) {
        this.store = new TaskStore(context, io);
        this.submissions = new SubmissionIndex(context, io);
    }
    handle(data: unknown): Data | null {
        if (!object(data) || !truth(data.session_id) || !truth(data.hook_event_name))
            return null;
        const session = string(data.session_id), clocks = this.context.sample();
        const result = this.store.mutate(session, history => {
            const evidence: Evidence = {}, event = data.hook_event_name;
            if (!truth(data.agent_id) && typeof data.transcript_path === 'string') {
                const prompt = lifecycleId(data.prompt_id), target = event === 'Stop' ? stopTarget(history, prompt, clocks.wall_ns) : prompt ?? history.current_prompt_id;
                const record = target ? findTurn(history, target) : null;
                const source = event === 'Stop' ? 'hook_stop' : event === 'StopFailure' ? 'hook_stop_failure' : event === 'SessionEnd' ? 'hook_session_end' : null;
                const eligible = event === 'Stop' ? !record || !['failed', 'interrupted', 'ignored'].includes(record.status) : event === 'StopFailure' || event === 'SessionEnd' && record?.status === 'running';
                if (source && target && eligible && needsSubmission(record, source))
                    evidence.submissionNs = this.submissions.time(data.transcript_path, record?.prompt_id ?? target);
                const current = findTurn(history, history.current_prompt_id), startSource = truth(data.source) ? string(data.source) : 'startup';
                if (event === 'SessionStart' && ['startup', 'resume'].includes(startSource) && current?.status === 'running') {
                    try {
                        evidence.modifiedNs = this.io.stat(data.transcript_path).mtimeNs;
                    }
                    catch { /* No filesystem evidence is available. */ }
                }
            }
            return applyHook(history, data, clocks, evidence);
        });
        this.store.prune();
        return result;
    }
    transcript(sessionId: unknown, observations: unknown, unfinishedOnly = false, appended: readonly unknown[] = []): Data | null {
        if (!truth(sessionId) || !Array.isArray(observations))
            return null;
        const result = this.store.mutate(string(sessionId), history => {
            const preserve = unfinishedOnly && appended.length ? new Set(history.turns.filter(row => row.status !== 'running' && !supersededSubmission(row))) : undefined;
            const previous = reconcileTranscript(history, observations, unfinishedOnly);
            return appended.length ? reconcileTranscript(history, appended, false, preserve) ?? previous : previous;
        });
        this.store.prune();
        return result;
    }
    confirm(sessionId: unknown, promptId: unknown, wall: bigint, source = 'native_turn_end', duration: unknown = null, status = 'completed'): Data | null {
        return this.store.mutate(sessionId, history => confirmCompletion(history, promptId, wall, source, duration, status));
    }
    idle(sessionId: unknown, promptId: unknown, wallValue: unknown): Data | null {
        return this.registry(sessionId, promptId, wallValue, 'idle');
    }
    registry(sessionId: unknown, promptId: unknown, wallValue: unknown, status: string): Data | null {
        const wall = int(wallValue, false);
        if (!truth(sessionId) || !truth(promptId) || wall === null)
            return null;
        const result = this.store.mutate(string(sessionId), history => reconcileRegistry(history, string(promptId), wall, status));
        this.store.prune();
        return result;
    }
    blockConfiguration(sessionId: unknown, promptId: unknown, began: bigint): void {
        const session = lifecycleId(sessionId);
        if (!session || !this.store.load(session))
            return;
        const clocks = this.context.sample();
        this.store.mutate(session, history => blockConfigurationPrompt(history, promptId, began, clocks));
    }
    withdraw(sessionId: unknown, promptId: unknown, wallValue: unknown): Data | null {
        const wall = int(wallValue, false);
        if (!truth(sessionId) || !truth(promptId) || wall === null)
            return null;
        return this.store.mutate(string(sessionId), history => withdrawPrompt(history, string(promptId), wall));
    }
}
