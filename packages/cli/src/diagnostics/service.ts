import type { Draft, Scope, DiagnoseResult } from '@fbincon/statusline-core/contracts/ui';
import { requestObject, validateDraft } from '@fbincon/statusline-core/config/draft';
import { ConfigError, object } from '@fbincon/statusline-core/config/validation';
import { safeInteger } from '@fbincon/statusline-core/json';
import { diagnose, identity } from '@fbincon/statusline-core/rendering/diagnose';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { diagnosticFiles, type DiagnosticFiles } from '@fbincon/statusline-platform/diagnostic-files';
import { baseEnvironment, presentation } from '../rendering/environment.js';
import { explanationFacts } from '../ui/explain.js';
import { ConfigurationService } from '../config/service.js';
import { readDisplay, readSettings } from '../config/storage.js';
import { hostFromSettings } from '../config/host.js';
import { runtimeContext, type RuntimeContext } from '../runtime/context.js';
import { observations } from './observations.js';
import { resolvedDisplay } from '../rendering/configuration.js';
import { liveDirectory } from '@fbincon/statusline-core/rendering/items';

export type Diagnose = (payload: unknown) => DiagnoseResult;
export function observedTime(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) || !Number.isFinite(Date.parse(value)))
        throw new ConfigError('diagnose.error.time', {}, 'invalid_request');
    const [year, month, day, hour, minute, second] = value.match(/\d+/gu)!.slice(0, 6).map(Number) as [number,number,number,number,number,number];
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > days[month - 1]! || hour > 23 || minute > 59 || second > 59)
        throw new ConfigError('diagnose.error.time', {}, 'invalid_request');
    return new Date(value).toISOString();
}
export function diagnosticSnapshot(service: ConfigurationService, input: unknown) {
    // ConfigurationService.read takes a lock; diagnosis must not create that lock or its directory.
    const [fallback] = readDisplay(service.context.configDir, service.io), directory = liveDirectory(input);
    const { display, configuration } = resolvedDisplay(service.context.configDir, service.io, fallback, directory ? { kind: 'project', path: directory } : { kind: 'user' });
    const [settings] = readSettings(service.context.configDir, service.io);
    return { draft: { display, host: hostFromSettings(settings, service.context.launch).host } satisfies Draft, configuration };
}
export async function diagnosisAdapter(service: ConfigurationService, options: { files?: DiagnosticFiles; runtime?: RuntimeContext; now?: () => number } = {}): Promise<Diagnose> {
    const languages = new Map(await Promise.all(LANGUAGES.map(async language => [language, await presentation(language)] as const)));
    return payload => {
        if (!object(payload)) throw new ConfigError('diagnose.error.input', {}, 'invalid_request');
        const optional = ['source', 'observed_at', 'include_local'].filter(key => Object.hasOwn(payload, key));
        requestObject(payload, ['draft', 'scope', 'width', 'input', ...optional], 'payload');
        const draft = validateDraft(payload.draft);
        if (payload.scope !== 'main' && payload.scope !== 'subagent') throw new ConfigError('explain.invalid_scope', {}, 'invalid_request');
        let width: number;
        try { width = safeInteger(payload.width, 2, 10000); }
        catch { throw new ConfigError('errors.protocol.width_must_be_an_integer_from_2', {}, 'invalid_request'); }
        if (!object(payload.input)) throw new ConfigError('diagnose.error.input', {}, 'invalid_request');
        if (payload.include_local !== undefined && typeof payload.include_local !== 'boolean') throw new ConfigError('diagnose.error.local', {}, 'invalid_request');
        const source = payload.source === undefined ? 'supplied_json' : identity(payload.source);
        if (!source) throw new ConfigError('diagnose.error.source', {}, 'invalid_request');
        const observedAt = observedTime(payload.observed_at), includeLocal = payload.include_local !== false;
        const original = options.runtime ?? runtimeContext(service.context.configDir), now = (options.now ?? original.nowMs)();
        const context = { ...original, nowMs: () => now };
        const facts = explanationFacts(new ConfigurationService({ ...service.context, hostVersion: () => null }, service.io));
        const env = baseEnvironment(languages.get(draft.display.statusline_language)!, { now: () => (observedAt === null ? now : Date.parse(observedAt)) / 1000 });
        const local = observations(draft, payload.scope as Scope, payload.input, context, options.files ?? diagnosticFiles, facts, includeLocal, observedAt, env);
        return diagnose(draft, payload.scope, width, payload.input, env, facts, local, { source, observedAt, diagnosedAt: new Date(now).toISOString(), includeLocal });
    };
}
