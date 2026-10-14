import { int, numeric, object, truth, string, type Data } from '@fbincon/statusline-core/runtime/values';
import { roundedInteger } from '@fbincon/statusline-core/runtime/transcript';
import type { Turn } from '@fbincon/statusline-core/runtime/tasks/model';
import { registryStatus } from '../registry.js';
import { TaskService } from './service.js';
export function localCommandIsCurrent(local: unknown, payload: string | null, real: string | null, lastPrompt: unknown): boolean {
    if (!object(local))
        return false;
    const prompt = truth(local.prompt_id) ? string(local.prompt_id) : null;
    if (prompt && real && prompt === real)
        return false;
    if (payload)
        return prompt !== null && prompt === payload;
    const ts = numeric(local.ts), last = numeric(lastPrompt);
    return ts !== null && (lastPrompt == null || last !== null && ts > last);
}
export function collectTask(service: TaskService, sessionId: unknown, promptId: unknown, lastPrompt: unknown, entry: Data): Turn | null {
    if (!truth(sessionId))
        return null;
    const session = string(sessionId), payload = truth(promptId) ? string(promptId) : null, real = truth(entry.last_prompt_id) ? string(entry.last_prompt_id) : null;
    const local = localCommandIsCurrent(entry.last_local_command, payload, real, lastPrompt);
    if (local && !real)
        return null;
    let effective = real ?? payload;
    const timestamp = numeric(lastPrompt);
    if (payload && payload !== real) {
        const state = service.store.state(session, payload), started = state ? int(state.started_wall_ns, false) : null;
        const transcript = timestamp !== null ? BigInt(Math.trunc(timestamp * 1e9)) : null;
        if (state?.status === 'running' && (transcript === null || started !== null && started > transcript))
            effective = payload;
    }
    if (!effective)
        return null;
    let state = service.store.state(session, effective);
    if (!state && real === effective && timestamp !== null) {
        try {
            service.transcript(session, [{ kind: 'prompt', prompt_id: effective, wall_ns: roundedInteger(timestamp * 1e9) }]);
            state = service.store.state(session, effective);
        }
        catch {
            state = null;
        }
    }
    if (!state)
        return null;
    if (state.status === 'running') {
        const sessionState = registryStatus(service.context, session, service.io);
        if (sessionState?.status === 'idle') {
            const end = int(sessionState.status_updated_wall_ns, false), start = int(state.started_wall_ns, false);
            if (end !== null && (start === null || end >= start)) {
                try {
                    service.idle(session, effective, end);
                    state = service.store.state(session, effective) ?? state;
                }
                catch { /* Keep the last trustworthy lifecycle view. */ }
            }
        }
    }
    return state;
}
