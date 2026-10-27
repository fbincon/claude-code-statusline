import type { AutomaticPolicy, SourceContext, SourceDefinition, SourceObservation, SourceReference, SourceRegistry, SourceScope, SourceSettings, SourceView } from '../contracts/ui.js';
import { ConfigError, object, exact, integer, isSchema } from '../config/validation.js';
import { numeric } from '../runtime/values.js';
export const SOURCE_FILENAME = 'claude-statusline-sources.json';
export const MAX_SOURCE_BYTES = 1048576;
export const SOURCE_TYPES = ['external-value', 'github-pr', 'github-ci'];
export const INPUT_FIELDS = ['project', 'session', 'agent', 'branch', 'head'] as const;
export const emptyRegistry = (): SourceRegistry => ({ version: 2, sources: [], bindings: [], automatic: [] });
export function sourceError(reason: string): never { throw new ConfigError('sources.error.' + reason, {}, reason); }
export function sourceText(value: unknown, maximum = 4096, empty = false): string {
    if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > maximum || /[\p{Cc}\p{Cs}]/u.test(value))
        sourceError('invalid');
    return value;
}
export function sourceId(value: unknown): string {
    const id = sourceText(value, 96);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(id))
        sourceError('invalid');
    return id;
}
export function sourceScope(value: unknown): SourceScope {
    exact(value, ['project', 'session', 'agent'], 'source scope');
    const result = Object.fromEntries(['project', 'session', 'agent'].map(key => [key, value[key] === null ? null : sourceText(value[key])])) as unknown as SourceScope;
    if (result.agent && !result.session)
        sourceError('scope');
    return result;
}
export function sourceContext(value: unknown): SourceContext {
    exact(value, ['project', 'session', 'agent', 'branch', 'head'], 'source context');
    return { ...sourceScope({ project: value.project, session: value.session, agent: value.agent }),
        branch: value.branch === null ? null : sourceText(value.branch), head: value.head === null ? null : sourceText(value.head) };
}
export function matchesScope(scope: SourceScope, context: SourceScope): boolean {
    return (['project', 'session', 'agent'] as const).every(key => scope[key] === null || scope[key] === context[key]);
}
export function sameContext(a: SourceContext, b: SourceContext): boolean {
    return (['project', 'session', 'agent', 'branch', 'head'] as const).every(key => a[key] === b[key]);
}
/** Cache only declared scope and supplied input identities; a project source is
 * reusable across sessions unless it explicitly consumes session/agent input. */
export function observationContext(source: SourceDefinition, actual: SourceContext): SourceContext {
    const inputs = Object.values(source.settings.input ?? {});
    const git = source.kind === 'github';
    return {
        project: source.scope.project !== null || git || inputs.some(key => ['project','branch','head'].includes(key)) ? actual.project : null,
        session: source.scope.session !== null || inputs.includes('session') || inputs.includes('agent') ? actual.session : null,
        agent: source.scope.agent !== null || inputs.includes('agent') ? actual.agent : null,
        branch: git || inputs.includes('branch') ? actual.branch : null,
        head: git || inputs.includes('head') ? actual.head : null,
    };
}
export function reference(value: unknown): SourceReference {
    exact(value, ['binding', 'hint'], 'source reference');
    return { binding: value.binding === null ? null : sourceId(value.binding), hint: sourceText(value.hint, 128, true) };
}
export function pointerParts(value: unknown): string[] {
    const text = sourceText(value, 512, true);
    if (!text)
        return [];
    if (!text.startsWith('/') || /~(?![01])/u.test(text))
        sourceError('pointer');
    const parts = text.slice(1).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'));
    if (parts.length > 32 || parts.some(part => ['__proto__', 'prototype', 'constructor'].includes(part)))
        sourceError('pointer');
    return parts;
}
export function selectPointer(value: unknown, pointer: string): unknown {
    for (const key of pointerParts(pointer)) {
        if ((!object(value) && !Array.isArray(value)) || !Object.hasOwn(value, key))
            return undefined;
        value = (value as Record<string, unknown>)[key];
    }
    return value;
}
function keys(value: Record<string, unknown>, allowed: string[]): void {
    if (Object.keys(value).some(key => !allowed.includes(key)))
        sourceError('invalid');
}
export function settings(kind: SourceDefinition['kind'], value: unknown): SourceSettings {
    if (!object(value))
        sourceError('invalid');
    if (kind === 'json') {
        keys(value, ['path', 'pointer', 'observed_at_pointer', 'unit']);
        const pointer = sourceText(value.pointer ?? '/value', 512, true);
        pointerParts(pointer);
        const observed = sourceText(value.observed_at_pointer ?? '/observed_at', 512, true);
        pointerParts(observed);
        return { path: sourceText(value.path), pointer, observed_at_pointer: observed, unit: sourceText(value.unit ?? '', 32, true) };
    }
    if (kind === 'github') {
        keys(value, ['host', 'repository', 'branch', 'account', 'pr']);
        const host = sourceText(value.host ?? 'github.com', 253).toLowerCase(), repository = sourceText(value.repository, 256);
        if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(host) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository))
            sourceError('invalid');
        const branch = sourceText(value.branch, 256), account = sourceText(value.account, 128);
        if (branch.startsWith('-') || !/^[A-Za-z0-9_-]+$/u.test(account))
            sourceError('invalid');
        return { host, repository, branch, account, pr: value.pr == null ? null : integer(value.pr, 1, Number.MAX_SAFE_INTEGER, 'PR') };
    }
    if (kind !== 'command')
        sourceError('invalid');
    keys(value, ['executable', 'args', 'cwd', 'input', 'output', 'timeout_ms']);
    if (!Array.isArray(value.args) || value.args.length > 128 || value.args.some(arg => typeof arg !== 'string' || arg.length > 8192 || arg.includes('\0')))
        sourceError('invalid');
    const input = value.input ?? {};
    if (!object(input) || Object.keys(input).length > 16 || Object.entries(input).some(([key, field]) => !/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(key) || !(INPUT_FIELDS as readonly unknown[]).includes(field)))
        sourceError('input');
    const output = value.output ?? 'json';
    if (output !== 'json' && output !== 'text')
        sourceError('invalid');
    return { executable: sourceText(value.executable), args: [...value.args] as string[], cwd: sourceText(value.cwd), input: { ...input } as Record<string, string>, output,
        timeout_ms: integer(value.timeout_ms ?? 5000, 100, 30000, 'timeout_ms') };
}
export function definition(value: unknown): SourceDefinition {
    exact(value, ['id', 'name', 'kind', 'scope', 'ttl_seconds', 'settings', 'enabled', 'revision'], 'source');
    if (!['json', 'github', 'command'].includes(value.kind as string) || typeof value.enabled !== 'boolean')
        sourceError('invalid');
    const kind = value.kind as SourceDefinition['kind'], scope = sourceScope(value.scope);
    if (kind === 'github' && !scope.project)
        sourceError('scope');
    return { id: sourceId(value.id), name: sourceText(value.name, 128), kind, scope, ttl_seconds: integer(value.ttl_seconds, 1, 86400, 'ttl_seconds'),
        settings: settings(kind, value.settings), enabled: value.enabled, revision: sourceId(value.revision) };
}
export function registry(value: unknown): SourceRegistry {
    if (!object(value)) sourceError('invalid');
    const legacy = isSchema(value.version, 1);
    exact(value, ['version', 'sources', 'bindings', ...(legacy ? [] : ['automatic'])], 'source registry');
    if (!(legacy || isSchema(value.version, 2)) || !Array.isArray(value.sources) || !Array.isArray(value.bindings) || value.sources.length > 128 || value.bindings.length > 4096)
        sourceError('invalid');
    const sources = value.sources.map(definition), ids = new Set(sources.map(source => source.id));
    if (ids.size !== sources.length)
        sourceError('invalid');
    const bindings = value.bindings.map(raw => { exact(raw, ['id', 'source_id'], 'source binding'); return { id: sourceId(raw.id), source_id: sourceId(raw.source_id) }; });
    if (new Set(bindings.map(binding => binding.id)).size !== bindings.length || bindings.some(binding => !ids.has(binding.source_id)))
        sourceError('invalid');
    const automatic: AutomaticPolicy[] = legacy ? [] : (() => {
        if (!Array.isArray(value.automatic) || value.automatic.length > sources.length) sourceError('invalid');
        return value.automatic.map(raw => {
            exact(raw, ['source_id', 'enabled', 'review_revision', 'interval_seconds', 'auth_revision'], 'automatic policy');
            const source = sources.find(s => s.id === raw.source_id);
            if (!source || source.kind !== 'github' || typeof raw.enabled !== 'boolean' || raw.review_revision !== source.revision || typeof raw.auth_revision !== 'string' || !/^[a-f0-9]{64}$/.test(raw.auth_revision) || raw.enabled && !source.enabled) sourceError('review');
            return { source_id: source.id, enabled: raw.enabled, review_revision: source.revision, interval_seconds: integer(raw.interval_seconds, 60, 86400, 'interval_seconds'), auth_revision: raw.auth_revision };
        });
    })();
    if (new Set(automatic.map(p => p.source_id)).size !== automatic.length) sourceError('invalid');
    return { version: 2, sources, bindings, automatic };
}
export function stamp(value: unknown): string | null {
    if (value == null)
        return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) || !Number.isFinite(Date.parse(value)))
        sourceError('time');
    const [year, month, day, hour, minute, second] = value.match(/\d+/gu)!.slice(0, 6).map(Number) as [
        number,
        number,
        number,
        number,
        number,
        number
    ];
    if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59)
        sourceError('time');
    return new Date(value).toISOString();
}
export function scalar(value: unknown): string | number | boolean {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string')
        return value.replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\))/gu, '').replace(/[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/gu, ' ').slice(0, 4096);
    const n = numeric(value);
    if (n !== null && Number.isFinite(n))
        return n;
    return sourceError('type');
}
export function emptyObservation(source: SourceDefinition, context: SourceContext, reason: string, state: SourceObservation['state'] = 'error'): SourceObservation {
    return { version: 1, source_id: source.id, source_revision: source.revision, context, observed_at: null, state, reason, value: null, unit: null };
}
export function parseObservation(raw: unknown, source: SourceDefinition, context: SourceContext, contracted = false): SourceObservation {
    const result = emptyObservation(source, context, 'missing', 'missing');
    if (contracted) {
        if (!object(raw) || !isSchema(raw.version, 1))
            sourceError('version');
        exact(raw, ['version', 'source_id', 'scope', 'observed_at', 'state', 'value', 'unit'], 'source output');
        if (raw.source_id !== source.id || !matchesScope(sourceScope(raw.scope), context) || !(['project','session','agent'] as const).every(key => sourceScope(raw.scope)[key] === source.scope[key]))
            sourceError('scope');
        if (!['valid', 'missing', 'partial', 'error', 'unsupported'].includes(raw.state as string))
            sourceError('invalid');
        result.state = raw.state as SourceObservation['state'];
        result.reason = result.state;
        result.value = raw.value === null ? null : scalar(raw.value);
        if (result.state === 'valid' && result.value === null)
            sourceError('type');
        result.observed_at = stamp(raw.observed_at);
        result.unit = raw.unit === null ? null : sourceText(raw.unit, 32, true);
    }
    else {
        if (object(raw) && Object.hasOwn(raw, 'version') && !isSchema(raw.version, 1))
            sourceError('version');
        if (object(raw) && Object.hasOwn(raw, 'source_id') && raw.source_id !== source.id)
            sourceError('scope');
        if (object(raw) && Object.hasOwn(raw, 'scope') && (!matchesScope(sourceScope(raw.scope), context) || !(['project','session','agent'] as const).every(key => sourceScope(raw.scope)[key] === source.scope[key])))
            sourceError('scope');
        const value = selectPointer(raw, source.settings.pointer ?? '/value');
        result.observed_at = stamp(selectPointer(raw, source.settings.observed_at_pointer ?? '/observed_at'));
        result.unit = source.settings.unit || null;
        if (value !== undefined && value !== null) {
            result.value = scalar(value);
            result.state = 'valid';
            result.reason = 'valid';
        }
        if (object(raw) && Object.hasOwn(raw, 'state')) {
            if (!['valid', 'missing', 'partial', 'error', 'unsupported'].includes(raw.state as string))
                sourceError('invalid');
            result.state = raw.state as SourceObservation['state'];
            result.reason = result.state;
            if (result.state === 'valid' && result.value === null)
                sourceError('type');
        }
    }
    return result;
}
/** Missing times cannot establish applicability at an explicitly supplied historical instant. */
export function observationAt(entry: SourceObservation | null, at: number): SourceObservation | null {
    return entry?.observed_at !== null && entry?.observed_at !== undefined && Date.parse(entry.observed_at) <= at ? entry : null;
}
export function sourceView(source: SourceDefinition | undefined, context: SourceContext, current: SourceObservation | null, good: SourceObservation | null, now: number, historicalAt?: number): SourceView {
    const result: SourceView = { source_id: source?.id ?? null, name: source?.name ?? '', state: 'unbound', reason: 'unbound', observed_at: null, freshness: 'unknown', value: null, unit: null };
    if (!source)
        return result;
    if (!source.enabled)
        return { ...result, state: 'disabled', reason: 'disabled' };
    if (!matchesScope(source.scope, context))
        return { ...result, state: 'mismatch', reason: 'scope' };
    if (historicalAt !== undefined) {
        const original = [current, good], eligibleCurrent = observationAt(current, historicalAt), eligibleGood = observationAt(good, historicalAt);
        current = eligibleCurrent ?? eligibleGood;
        good = eligibleGood;
        now = historicalAt;
        if (!current) {
            const later = original.find(entry => entry?.observed_at && Date.parse(entry.observed_at) > historicalAt);
            return { ...result, state: 'missing', reason: later ? 'newer_than_input' : original.some(Boolean) ? 'association_unavailable' : 'not_refreshed', observed_at: later?.observed_at ?? null };
        }
    }
    const valid = (entry: SourceObservation | null) => entry && entry.source_id === source.id && entry.source_revision === source.revision && sameContext(entry.context, context);
    if (current && !valid(current))
        return { ...result, state: 'mismatch', reason: 'identity' };
    if (!current)
        return { ...result, state: 'missing', reason: 'not_refreshed' };
    if (['scope','identity','account'].includes(current.reason))
        return { ...result, state: 'mismatch', reason: current.reason };
    const latest = current.value !== null && ['valid', 'partial'].includes(current.state) ? current : valid(good) ? good! : { ...current, value: null, unit: null, fields: undefined };
    const time = latest.observed_at === null ? null : Date.parse(latest.observed_at), age = time === null ? null : now - time;
    return { ...result, state: current.state, reason: current.reason, value: latest.value, unit: latest.unit, observed_at: latest.observed_at,
        freshness: age === null || age < 0 ? 'unknown' : age > source.ttl_seconds * 1000 ? 'stale' : 'current', ...(latest.fields ? { fields: latest.fields } : {}) };
}
