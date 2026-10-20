import { join } from 'node:path';
import { taskDetails } from '@fbincon/statusline-core/runtime/tasks/details';
import { storeFromState, type TaskStore } from '@fbincon/statusline-core/runtime/tasks/model';
import { validateState, fresh, type LiveState } from '@fbincon/statusline-core/runtime/live/state';
import { object, int, numeric } from '@fbincon/statusline-core/runtime/values';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { isLosslessNumber } from '@fbincon/statusline-core/json';
import type { TaskEvidence } from '@fbincon/statusline-core/contracts/ui';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { diagnosticFiles, type DiagnosticFiles } from '@fbincon/statusline-platform/diagnostic-files';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { readDataJson } from '../runtime/json-data.js';
import { type RuntimeContext, runtimeContext } from '../runtime/context.js';
import { loadRuntime } from '../config/runtime-preferences.js';

const identity = (value: unknown): value is string => typeof value === 'string' && !!value && [...value].length <= 1024 && !/[\p{Cc}\p{Cs}]/u.test(value);
export function detailService(payload: unknown, context: RuntimeContext, files: DiagnosticFiles = diagnosticFiles) {
    if (!object(payload) || !identity(payload.session_id) ||
        payload.prompt_id !== undefined && payload.prompt_id !== null && !identity(payload.prompt_id) ||
        !Object.keys(payload).every(k => ['session_id','prompt_id','host_agents'].includes(k)))
        throw new ConfigError('task.error.input', {}, 'invalid_request');
    const session = payload.session_id, now = context.nowMs(), sample = context.sample(), evidence = (source: string): TaskEvidence =>
        ({ source, scope: 'task', status: 'not_observed', observed_at: null, freshness: 'unknown' });
    const taskEvidence = evidence('task_store'), liveEvidence = evidence('live_store');
    const read = (folder: string, result: TaskEvidence) => {
        try {
            const raw = files.read(join(context.runtimeRoot, folder, sha256(session) + '.json'));
            if (raw === null) return null;
            const data = readDataJson(decodeUtf8(raw));
            if (!object(data) || data.session_id !== session) { result.status = 'session_mismatch'; return null; }
            result.status = 'observed'; return data;
        } catch { result.status = 'source_unavailable'; return null; }
    };
    let history: TaskStore | null = null, live: LiveState | null = null;
    const state = read('turns', taskEvidence);
    if (state) {
        if (int(state.schema) !== 1n) taskEvidence.status = 'invalid_field';
        else history = storeFromState(state, session);
    }
    const liveRaw = read('live', liveEvidence);
    if (liveRaw) {
        live = validateState(liveRaw, session);
        if (!live) liveEvidence.status = 'invalid_field';
        else {
            const stamp = numeric(live.heartbeat_at_ms);
            if (stamp !== null && stamp >= 0 && stamp <= 8640000000000000) liveEvidence.observed_at = new Date(stamp).toISOString();
            liveEvidence.freshness = stamp === null ? 'unknown' : fresh(live, now) ? 'current' : 'stale';
            if (liveEvidence.freshness === 'stale') liveEvidence.status = 'stale';
            if (stamp !== null && stamp > now) { liveEvidence.status = 'newer_than_input'; liveEvidence.freshness = 'newer_than_input'; live = null; }
        }
    }
    let nativeTiming = false, liveMetrics = false;
    try { const preferences = loadRuntime(context.configDir, files); nativeTiming = preferences.native_timing; liveMetrics = preferences.live_metrics; }
    catch { liveEvidence.status = 'preferences_unavailable'; live = null; }
    let hostAgents: { observed_at: number; agents: { id: string; name: string | null }[] } | undefined;
    if (payload.host_agents !== undefined) {
        const supplied = payload.host_agents;
        if (!object(supplied) || Object.keys(supplied).sort().join(',') !== 'agents,observed_at' ||
            !(typeof supplied.observed_at === 'number' || isLosslessNumber(supplied.observed_at)) || numeric(supplied.observed_at) === null ||
            numeric(supplied.observed_at)! < 0 || numeric(supplied.observed_at)! > 8640000000000000 ||
            !Array.isArray(supplied.agents) || supplied.agents.length > 256 ||
            !supplied.agents.every(a => object(a) && Object.keys(a).sort().join(',') === 'id,name' && identity(a.id) && (a.name === null || identity(a.name))) ||
            new Set(supplied.agents.map(a => (a as { id: string }).id)).size !== supplied.agents.length)
            throw new ConfigError('task.error.input', {}, 'invalid_request');
        hostAgents = { observed_at: numeric(supplied.observed_at)!, agents: supplied.agents as { id: string; name: string | null }[] };
    }
    return taskDetails({ session, prompt: typeof payload.prompt_id === 'string' ? payload.prompt_id : null, history, live, taskEvidence, liveEvidence,
        now, sample, nativeTiming, liveMetrics, hostAgents });
}
export const taskAdapter = (directory: string) => (payload: unknown) => detailService(payload, runtimeContext(directory));
