import type { DisplayDraft, EvidenceStatus } from '../contracts/ui.js';
import type { Data } from '../runtime/values.js';
import { sanitizePayloadText } from './formatters.js';
import { effortText } from './metrics.js';

export const SESSION_EFFORT_TTL_MS = 15_000;
export interface SessionEffortObservation {
    session_id: string;
    model_id: string | null;
    effort_level: string | null;
    observed_at_ms: number;
}
export type SessionEffortReader = (session: string) => SessionEffortRead;
export type SessionEffortRead =
    | { status: 'observed'; observation: SessionEffortObservation }
    | { status: 'not_observed' | 'invalid_field' | 'source_unavailable' };

export function effortIdentity(value: unknown, limit = 256): string | null {
    // Match host identifiers verbatim. Display aliases and display sanitization cannot establish identity.
    return typeof value === 'string' && value.length <= limit && sanitizePayloadText(value) === value ? value : null;
}

export function sessionEffortEnabled(config: DisplayDraft): boolean {
    return config.subagents.enabled && config.subagents.instances.some(node =>
        node.enabled && node.type_id === 'model-with-effort' && node.options.effort_fallback === 'session');
}

export interface SubagentEffort {
    source: 'configured' | 'inherited_session' | 'unavailable';
    value: string | null;
    status: EvidenceStatus;
    observedAt: number | null;
}

function unavailable(status: EvidenceStatus, observedAt: number | null = null): SubagentEffort {
    return { source: 'unavailable', value: null, status, observedAt };
}

export function subagentEffort(task: Data, fallback: boolean, session: string | null, read: SessionEffortReader | undefined,
    at: number, includeLocal = true): SubagentEffort {
    const value = effortText(task.effort);
    if (value !== null) return { source: 'configured', value, status: 'observed', observedAt: null };
    if (task.effort != null && !(typeof task.effort === 'string' && !task.effort.trim())) return unavailable('invalid_field');
    if (!fallback) return unavailable('not_observed');
    if (!includeLocal) return unavailable('input_only');
    const model = effortIdentity(task.model, 512);
    if (!session || !model) return unavailable('association_unavailable');
    const result = read?.(session);
    if (!result || result.status !== 'observed') return unavailable(result?.status ?? 'not_observed');
    const observation = result.observation, observedAt = observation.observed_at_ms;
    if (observation.session_id !== session) return unavailable('session_mismatch');
    if (at < observedAt) return unavailable('newer_than_input', observedAt);
    if (at - observedAt > SESSION_EFFORT_TTL_MS) return unavailable('stale', observedAt);
    if (!observation.model_id || !observation.effort_level) return unavailable('not_observed', observedAt);
    if (observation.model_id !== model) return unavailable('association_unavailable', observedAt);
    return { source: 'inherited_session', value: observation.effort_level, status: 'observed', observedAt };
}
