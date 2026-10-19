import { VERSION } from '@fbincon/statusline-core/release';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { readJson } from '@fbincon/statusline-core/json-read';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { int, object, truth, type Data } from '@fbincon/statusline-core/runtime/values';
import { exact, text, ObservationError, PROTOCOL_VERSION, MAX_BYTES, validateBatch } from '@fbincon/statusline-core/runtime/live/model';
import { fresh } from '@fbincon/statusline-core/runtime/live/state';
import { resolveMetrics } from '@fbincon/statusline-core/runtime/live/snapshot';
import { activePoint } from '@fbincon/statusline-core/runtime/tasks/view';
import { decodeUtf8Sig } from '@fbincon/statusline-platform/utf8';
import { loadRuntime } from '../../config/runtime-preferences.js';
import type { RuntimeContext } from '../context.js';
import { runtimeIO, type RuntimeIO } from '../io.js';
import { LiveStore } from './store.js';
export class RuntimeProtocol {
    readonly store: LiveStore;
    constructor(public readonly context: RuntimeContext, io: RuntimeIO = runtimeIO()) { this.store = new LiveStore(context, io); }
    activePoint(session: string | null, prompt: string | null = null): Data {
        if (!session)
            return activePoint(null, true, false, this.context.sample);
        let enabled: boolean;
        try {
            enabled = loadRuntime(this.context.configDir).native_timing;
        }
        catch {
            return { ...activePoint(null, true, false, this.context.sample), reason: 'source_unavailable' };
        }
        return activePoint(this.store.tasks.state(session, prompt), enabled, fresh(this.store.load(session), this.context.nowMs()), this.context.sample);
    }
    dispatch(request: unknown): Data {
        exact(request, ['protocol_version', 'operation', 'payload'], 'request');
        const version = int(request.protocol_version);
        if (version !== 1n && version !== BigInt(PROTOCOL_VERSION))
            throw new ObservationError('unsupported runtime protocol; reinstall matching Mod/backend');
        const modes = loadRuntime(this.context.configDir), enabled = modes.native_timing || modes.live_metrics, payload = request.payload;
        if (request.operation === 'observe') {
            exact(payload, ['observations'], 'payload');
            const rows = validateBatch(payload.observations);
            const counts = enabled ? this.store.observe(rows, { timing: modes.native_timing, completeTiming: version === BigInt(PROTOCOL_VERSION), advanced: modes.live_metrics }) : { accepted: 0, ignored: rows.length };
            return { backend_version: VERSION, enabled, native_timing: modes.native_timing, live_metrics: modes.live_metrics, ...counts };
        }
        if (request.operation === 'read') {
            exact(payload, ['session_id', 'prompt_id'], 'payload');
            const session = text(payload.session_id, 'session_id')!, prompt = text(payload.prompt_id, 'prompt_id', true);
            const state = enabled ? this.store.load(session) : null, now = this.context.nowMs(), live = fresh(state, now);
            const reason = !enabled ? 'runtime_disabled' : state === null ? 'not_observed' : truth(state.invalidated) ? state.invalidated : live ? null : 'stale';
            const metrics: Data = resolveMetrics(state, state ? this.store.history(session) : null, prompt, now, modes.live_metrics);
            metrics['task-active-timer'] = this.activePoint(session, prompt);
            return { native_timing: modes.native_timing, live_metrics: modes.live_metrics, backend_version: VERSION, session_id: session,
                prompt_id: prompt || state?.current_prompt_id || null, enabled, fresh: live, reason, observed_at_ms: state?.heartbeat_at_ms ?? null, state, metrics };
        }
        throw new ObservationError('unsupported runtime operation');
    }
    async handle(input: string | Uint8Array | (() => string | Uint8Array)): Promise<{
        response: Data;
        status: number;
        stdout: string;
    }> {
        const response: Data = { protocol_version: PROTOCOL_VERSION };
        let status = 0;
        try {
            const value = typeof input === 'function' ? input() : input;
            const raw = typeof value === 'string' ? Buffer.from(value) : value;
            if (raw.length > MAX_BYTES)
                throw new ObservationError('runtime request is larger than 1 MiB');
            const request = readJson(decodeUtf8Sig(raw), {
                duplicate(key) { throw new ObservationError('duplicate JSON field: ' + key); },
                constant(value) { throw new ObservationError('non-finite JSON constant: ' + value); }
            });
            if (object(request) && int(request.protocol_version) !== null)
                response.protocol_version = request.protocol_version;
            response.result = this.dispatch(request);
            response.protocol_version = (request as Data).protocol_version;
        }
        catch (error) {
            let message = error instanceof Error ? error.message : String(error), code = 'invalid_observation';
            if (error instanceof ConfigError) {
                const [{ renderMessage }, { localizedError }] = await Promise.all([import('@fbincon/statusline-core/i18n/messages'), import('../../errors.js')]);
                message = renderMessage(localizedError(error));
            }
            else if (error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string') {
                code = 'source_unavailable';
                message = 'Runtime state cannot be read or published';
            }
            response.error = { code, message };
            status = 2;
        }
        return { response, status, stdout: pythonJson(response, { ensureAscii: false }) + '\n' };
    }
}
