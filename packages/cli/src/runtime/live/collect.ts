import { resolveMetrics, unavailable } from '@fbincon/statusline-core/runtime/live/snapshot';
import { loadRuntime } from '../../config/runtime-preferences.js';
import { LiveStore } from './store.js';
export function collectMetrics(store: LiveStore, session: unknown, prompt: unknown = null, nowMs = store.context.nowMs(), beforeRead?: () => void) {
    if (typeof session !== 'string' || !session)
        return unavailable('not_observed');
    try {
        const enabled = loadRuntime(store.context.configDir).live_metrics;
        if (enabled)
            beforeRead?.();
        return resolveMetrics(enabled ? store.load(session) : null, enabled ? store.history(session) : null, prompt, nowMs, enabled, true);
    }
    catch {
        return unavailable('source_unavailable');
    }
}
