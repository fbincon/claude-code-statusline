import { object, numeric } from '../runtime/values.js';
import { sanitizePayloadText } from './formatters.js';
import type { Presentation } from './language.js';

export const CACHE_CAUSES = ['tools_changed', 'system_prompt_changed', 'ttl_expired_5m', 'likely_server_side'] as const;
export interface WorktreeEvidence {
    session_name: string | null;
    git_name: string | null;
    selected_source: 'worktree.name' | 'workspace.git_worktree' | null;
}
export function worktreeEvidence(data: unknown): WorktreeEvidence {
    const input = object(data) ? data : {};
    const session_name = sanitizePayloadText(object(input.worktree) ? input.worktree.name : null);
    const git_name = sanitizePayloadText(object(input.workspace) ? input.workspace.git_worktree : null);
    return { session_name, git_name, selected_source: session_name ? 'worktree.name' : git_name ? 'workspace.git_worktree' : null };
}
export interface CacheMissEvidence {
    status: 'observed' | 'not_observed' | 'no_misses' | 'unidentified' | 'invalid_field';
    causes: string[];
    last_miss_at: number | null;
    tools_added: number | null;
    tools_removed: number | null;
    system_char_delta: number | null;
}
export function cacheMissEvidence(value: unknown): CacheMissEvidence {
    const cache = object(value) ? value : {}, cause = cache.last_miss_cause;
    const integer = (v: unknown, signed = false): number | null => {
        const n = numeric(v);
        return n !== null && Number.isSafeInteger(n) && (signed || n >= 0) ? n : null;
    };
    const stamp = numeric(cache.last_miss_at);
    const result: CacheMissEvidence = { status: 'not_observed', causes: [],
        last_miss_at: stamp !== null && Number.isFinite(stamp) && stamp >= 0 ? stamp : null,
        tools_added: null, tools_removed: null, system_char_delta: null };
    if (cause == null) {
        result.status = numeric(cache.misses) === 0 ? 'no_misses' : cause === null ? 'unidentified' : 'not_observed';
        return result;
    }
    if (!object(cause) || !Array.isArray(cause.causes) || !cause.causes.length) { result.status = 'invalid_field'; return result; }
    let invalid = false;
    for (const raw of cause.causes) {
        const text = sanitizePayloadText(raw);
        if (!text) invalid = true;
        else if (!result.causes.includes(text)) result.causes.push(text);
    }
    for (const field of ['tools_added', 'tools_removed', 'system_char_delta'] as const) {
        result[field] = integer(cause[field], field === 'system_char_delta');
        if (cause[field] != null && result[field] === null) invalid = true;
    }
    if (cache.last_miss_at != null && result.last_miss_at === null) invalid = true;
    result.status = invalid || numeric(cache.misses) === 0 ? 'invalid_field' : 'observed';
    return result;
}
export function cacheMissText(value: unknown, language: Presentation): string | null {
    const evidence = cacheMissEvidence(value);
    if (!evidence.causes.length) return null;
    const causes = evidence.causes.map(code => (CACHE_CAUSES as readonly string[]).includes(code)
        ? language.text('cache.cause.' + code) : language.text('cache.cause.unknown', { value: code }));
    return language.text('cache.miss_reason', { value: causes.join(' · ') });
}
