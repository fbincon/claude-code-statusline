import type { RuntimeContext } from '../context.js';
import { runtimeIO, type RuntimeIO } from '../io.js';
import { int, truth, string, object, type Data } from '@fbincon/statusline-core/runtime/values';
import { findTurn } from '@fbincon/statusline-core/runtime/tasks/model';
import { applyHook, needsSubmission, type Evidence } from '@fbincon/statusline-core/runtime/tasks/hooks';
import { confirmCompletion, reconcileTranscript, reconcileIdle, withdrawPrompt } from '@fbincon/statusline-core/runtime/tasks/transitions';
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
                const target = truth(data.prompt_id) ? string(data.prompt_id) : history.current_prompt_id, record = target ? findTurn(history, target) : null;
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
    transcript(sessionId: unknown, observations: unknown): Data | null {
        if (!truth(sessionId) || !Array.isArray(observations))
            return null;
        const result = this.store.mutate(string(sessionId), history => reconcileTranscript(history, observations));
        this.store.prune();
        return result;
    }
    confirm(sessionId: unknown, promptId: unknown, wall: bigint, source = 'native_turn_end', duration: unknown = null, status = 'completed'): Data | null {
        return this.store.mutate(sessionId, history => confirmCompletion(history, promptId, wall, source, duration, status));
    }
    idle(sessionId: unknown, promptId: unknown, wallValue: unknown): Data | null {
        const wall = int(wallValue, false);
        if (!truth(sessionId) || !truth(promptId) || wall === null)
            return null;
        const result = this.store.mutate(string(sessionId), history => reconcileIdle(history, string(promptId), wall));
        this.store.prune();
        return result;
    }
    withdraw(sessionId: unknown, promptId: unknown, wallValue: unknown): Data | null {
        const wall = int(wallValue, false);
        if (!truth(sessionId) || !truth(promptId) || wall === null)
            return null;
        return this.store.mutate(string(sessionId), history => withdrawPrompt(history, string(promptId), wall));
    }
}
