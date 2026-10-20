import type { Draft, Scope, DiagnoseResult, DiagnosticEvidence } from '../contracts/ui.js';
import { BY_SCOPE } from '../config/catalog.js';
import { object, numeric, type Data } from '../runtime/values.js';
import { sanitizePayloadText } from './formatters.js';
import { configurationReasons, type ExplanationFacts } from './explain.js';
import { cacheMissEvidence, worktreeEvidence } from './host-fields.js';
import { configuredRows } from './items.js';
import { renderPayload } from './subagents.js';
import { RenderTrace } from './trace.js';
import { rowSpans } from './spans.js';
import type { RenderEnvironment } from './context.js';

export interface DiagnosisOptions {
    source: string;
    observedAt: string | null;
    diagnosedAt: string;
    includeLocal: boolean;
}
export function identity(value: unknown): string | null {
    return typeof value === 'string' && value.trim() && !/[\p{Cc}\p{Cs}]/u.test(value) ? value : null;
}
export function evidence(source: string, scope: string, status: DiagnosticEvidence['status'] = 'not_observed',
    observed_at: string | null = null, freshness: DiagnosticEvidence['freshness'] = 'unknown'): DiagnosticEvidence {
    return { source, scope, status, observed_at, freshness, fields: [] };
}
const BOOLEANS = new Set(['fast_mode', 'thinking.enabled', 'prompt_cache.warm', 'prompt_cache.caching_observed']);
const TEXT = /(?:^cwd$|^version$|^session_|^workspace\.|^worktree\.|^model\.|^effort\.|^agent\.|^vim\.|^output_style\.|pr\.(?:review_state|kind|url)$|spend_limit.period$|tasks\.(?:name|type|model|effort|label|description|cwd|status)$)/u;
function fieldStatus(input: unknown, path: string): 'observed' | 'not_observed' | 'invalid_field' {
    let value: unknown = input;
    for (const key of path.split('.')) {
        if (value == null) return 'not_observed';
        if (!object(value)) return 'invalid_field';
        value = Object.hasOwn(value, key) ? value[key] : undefined;
    }
    if (value == null || value === '') return 'not_observed';
    if (BOOLEANS.has(path)) return typeof value === 'boolean' ? 'observed' : 'invalid_field';
    if (path === 'prompt_cache.last_miss_cause') return object(value) ? 'observed' : 'invalid_field';
    if (path === 'context_window.current_usage') {
        if (!object(value)) return 'invalid_field';
        return ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'].every(key => {
            const n = numeric(value[key]); return n !== null && Number.isFinite(n) && n >= 0;
        }) ? 'observed' : 'invalid_field';
    }
    if (TEXT.test(path)) return sanitizePayloadText(value) ? 'observed' : 'invalid_field';
    if (path === 'pr.number' && typeof value === 'string') return sanitizePayloadText(value) ? 'observed' : 'invalid_field';
    const n = numeric(value);
    if (n === null || !Number.isFinite(n) || n < 0 || path === 'prompt_cache.hit_ratio' && n > 1 ||
        /context_window\.(used|remaining)_percentage/u.test(path) && n > 100) return 'invalid_field';
    return 'observed';
}
export function inputEvidence(input: Data, scope: Scope, type: string, observedAt: string | null): DiagnosticEvidence[] {
    const definition = BY_SCOPE[scope].get(type);
    if (!definition?.guidance.source_kinds.includes('official_input')) return [];
    const roots = new Set(['model','effort','fast_mode','thinking','workspace','cwd','worktree','pr','context_window','rate_limits','prompt_cache','session_id','session_name','version','output_style','cost','agent','vim','tasks']);
    const sources = definition.sources.filter(path => roots.has(path.split('.')[0]!));
    if (!sources.length) return [];
    if (scope === 'main') {
        if (type === 'model-with-effort' && !sources.includes('model.display_name')) sources.push('model.display_name');
        if (type === 'pr') sources.push('pr.kind');
        const result = evidence('supplied_input', definition.guidance.measurement_scope, 'not_observed', observedAt);
        result.fields = sources.map(path => ({ path, status: fieldStatus(input, path) }));
        result.status = result.fields.some(f => f.status === 'invalid_field') ? 'invalid_field' : result.fields.some(f => f.status === 'observed') ? 'observed' : 'not_observed';
        if (type === 'cache-miss-reason') result.status = cacheMissEvidence(input.prompt_cache).status;
        return [result];
    }
    if (!Array.isArray(input.tasks)) return [evidence('supplied_input', 'subagent', input.tasks == null ? 'not_observed' : 'invalid_field', observedAt)];
    if (!input.tasks.length) return [evidence('supplied_input', 'subagent', 'not_observed', observedAt)];
    return input.tasks.map(task => {
        const id = object(task) ? identity(task.id) : null;
        const result = evidence('supplied_input', id ? 'subagent:' + id : 'subagent', id ? 'not_observed' : 'invalid_field', observedAt);
        result.fields = sources.map(path => ({ path, status: fieldStatus({ tasks: task }, path) }));
        if (id) result.status = result.fields.some(f => f.status === 'invalid_field') ? 'invalid_field' : result.fields.some(f => f.status === 'observed') ? 'observed' : 'not_observed';
        return result;
    });
}

/** All I/O is completed by the adapter. Layout and reasons share the production renderer. */
export function diagnose(draft: Draft, scope: Scope, width: number, input: Data, env: RenderEnvironment,
    facts: ExplanationFacts, local: ReadonlyMap<string, DiagnosticEvidence[]>, options: DiagnosisOptions): DiagnoseResult {
    const trace = new RenderTrace(draft.display), rendering = { ...env, trace };
    const padding = Math.min(draft.host.padding, width - 2);
    let output: DiagnoseResult['output'];
    if (scope === 'main') {
        trace.begin('main', 'main');
        output = configuredRows(input, draft.display, width - padding, rendering).map((row, i) => ({ id: 'main:' + i, spans: rowSpans(' '.repeat(padding) + row) }));
    } else {
        const tasks = Array.isArray(input.tasks) ? input.tasks.filter(task => object(task) && identity(task.id)) : input.tasks;
        output = renderPayload({ ...input, tasks, columns: width }, draft.display, rendering).map(row => ({ id: row.id, spans: rowSpans(row.content) }));
    }
    const host = typeof input.version === 'string' && /^\d+\.\d+\.\d+(?:[-+].*)?$/u.test(input.version) ? input.version : null;
    const observedFacts = { ...facts, host_version: host ? host.split(/[.+-]/u).slice(0, 3).map(Number) : null };
    return { sample: false, scope, width, source: options.source, observed_at: options.observedAt, diagnosed_at: options.diagnosedAt,
        session_id: identity(input.session_id), prompt_id: identity(input.prompt_id), host_version: host, include_local: options.includeLocal, output,
        instances: (scope === 'main' ? draft.display.instances : draft.display.subagents.instances).map(node => ({
            id: node.id, type_id: node.type_id, enabled: node.enabled,
            reasons: configurationReasons(draft, scope, node, observedFacts),
            evidence: [...inputEvidence(input, scope, node.type_id, options.observedAt), ...(local.get(node.type_id) ?? [])],
            rows: trace.layouts(scope, node.id),
        })),
        host_fields: { worktree: worktreeEvidence(input), cache_miss: cacheMissEvidence(input.prompt_cache) },
    };
}
