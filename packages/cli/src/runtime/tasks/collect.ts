import { int, numeric, object, truth, string, type Data } from '@fbincon/statusline-core/runtime/values';
import { roundedInteger } from '@fbincon/statusline-core/runtime/transcript';
import { findTurn, type Turn } from '@fbincon/statusline-core/runtime/tasks/model';
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
    const history = service.store.load(session), timestamp = numeric(lastPrompt);
    let effective = real ?? payload;
    const realTime = timestamp !== null ? roundedInteger(timestamp * 1e9) : null;
    const current = history?.current_prompt_id ? findTurn(history, history.current_prompt_id) : null;
    const latestHuman = int(current?.started_wall_ns, false) ?? realTime;
    const configure = history?.turns.reduce<Turn | null>((latest, record) => {
        const started = int(record.started_wall_ns, false);
        return record.configuration_prompt && started !== null && (latestHuman === null || started > latestHuman) &&
            (realTime === null || started > realTime) && (!latest || started > (int(latest.started_wall_ns, false) ?? 0n)) ? record : latest;
    }, null);
    if (configure)
        effective = configure.prompt_id;
    else if (history && payload && payload !== real) {
        const state = findTurn(history, payload), started = int(state?.started_wall_ns, false);
        if (state?.status === 'running' && !state.configuration_prompt && (realTime === null || started !== null && started > realTime))
            effective = payload;
    }
    if (!effective)
        return null;
    let state = history ? findTurn(history, effective) : null;
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
        if (sessionState) {
            const end = int(sessionState.status_updated_wall_ns, false), start = int(state.started_wall_ns, false);
            const status = ['idle', 'busy'].includes(String(sessionState.status)) ? String(sessionState.status) : 'other';
            const previous = object(state.registry_observation) ? int(state.registry_observation.wall_ns, false) : null;
            if (end !== null && end <= service.context.sample().wall_ns && (start === null || end >= start) && (status === 'idle' || previous === null || end > previous)) {
                try {
                    service.registry(session, effective, end, status);
                    state = service.store.state(session, effective) ?? state;
                }
                catch { /* Keep the last trustworthy lifecycle view. */ }
            }
        }
    }
    return state;
}
