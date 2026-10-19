import { resolveMetrics, unavailable } from '@fbincon/statusline-core/runtime/live/snapshot';
import { loadRuntime } from '../../config/runtime-preferences.js';
import { LiveStore } from './store.js';
export function collectMetrics(store: LiveStore, session: unknown, prompt: unknown = null, nowMs = store.context.nowMs()) {
    if (typeof session !== 'string' || !session)
        return unavailable('not_observed');
    try {
        const enabled = loadRuntime(store.context.configDir).live_metrics, state = enabled ? store.load(session) : null;
        return resolveMetrics(state, state ? store.history(session) : null, prompt, nowMs, enabled);
    }
    catch {
        return unavailable('source_unavailable');
    }
}
