import { diagnosticInputFile, parseDiagnosticInput } from './input.js';
import { resolve } from 'node:path';
import type { DiagnoseResult } from '@fbincon/statusline-core/contracts/ui';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { CACHE_CAUSES } from '@fbincon/statusline-core/rendering/host-fields';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { readLimitedInput } from '@fbincon/statusline-platform/input';
import { MAX_DIAGNOSTIC_BYTES } from '@fbincon/statusline-platform/diagnostic-files';
import { localizedError } from '../errors.js';
import type { ConfigurationService } from '../config/service.js';
import type { RuntimeContext } from '../runtime/context.js';
import { diagnosisAdapter, diagnosticSnapshot } from './service.js';

function argumentsFor(args: readonly string[]) {
    const values: Record<string, string | boolean> = {};
    for (let i = 0; i < args.length; i++) {
        const raw = args[i]!, eq = raw.indexOf('='), key = eq < 0 ? raw : raw.slice(0, eq);
        if (Object.hasOwn(values, key) || !['--input', '--scope', '--width', '--observed-at', '--config-dir', '--json', '--input-only'].includes(key))
            throw new ConfigError('diagnose.error.argument', { value: raw }, 'invalid_request');
        if (key === '--json' || key === '--input-only') {
            if (eq >= 0) throw new ConfigError('diagnose.error.argument', { value: raw }, 'invalid_request');
            values[key] = true;
        } else {
            const value = eq < 0 ? args[++i] : raw.slice(eq + 1);
            if (!value || value.startsWith('--')) throw new ConfigError('diagnose.error.argument', { value: raw }, 'invalid_request');
            values[key] = value;
        }
    }
    if (typeof values['--input'] !== 'string') throw new ConfigError('diagnose.error.required', {}, 'invalid_request');
    return values;
}
export function diagnosticText(result: DiagnoseResult, language: Language): string {
    const tr = (key: string, params: Record<string, unknown> = {}) => t('diagnose.' + key, language, params);
    const lines = [tr('title'), tr('source', { value: result.source }), tr('times', { input: result.observed_at ?? tr('unknown'), now: result.diagnosed_at }),
        tr('identity', { session: result.session_id ?? tr('unknown'), prompt: result.prompt_id ?? tr('unknown') }), tr('output', { width: result.width }),
        ...result.output.map(row => row.spans.map(span => span.text).join(''))];
    for (const item of result.instances) {
        lines.push('', `${t('items.' + result.scope + '.' + item.type_id + '.label', language)} (${item.id})`);
        for (const reason of item.reasons) lines.push('  ' + t('explain.reason.' + reason.code, language));
        for (const observation of item.evidence) {
            lines.push('  ' + tr('evidence', { source: observation.source, scope: observation.scope, status: tr('status.' + observation.status), time: observation.observed_at ?? tr('unknown'), freshness: tr('freshness.' + observation.freshness) }));
            for (const field of observation.fields) lines.push('    ' + field.path + ': ' + tr('status.' + field.status));
        }
        for (const row of item.rows) {lines.push('  ' + row.row_id + ': ' + tr('layout.' + row.outcome) + (row.truncated ? ' · ' + tr('layout.truncated') : ''));for(const reason of row.style_reasons??[])lines.push('  '+t('explain.style.'+reason.code,language)+(reason.owner_id?' ('+reason.owner_id+')':''));}
    }
    const tree = result.host_fields.worktree, miss = result.host_fields.cache_miss;
    if (result.configuration) lines.push(t('profiles.resolution', language, {
        name: result.configuration.profile_name ?? t('profiles.user', language), root: result.configuration.project_root ?? '—',
        reason: t('profiles.reason.' + result.configuration.reason, language) }));
    lines.push('', tr('worktree', { session: tree.session_name ?? tr('unknown'), git: tree.git_name ?? tr('unknown'), selected: tree.selected_source ?? tr('unknown') }));
    lines.push(tr('cache', { status: tr('status.' + miss.status), time: miss.last_miss_at === null ? tr('unknown') : String(miss.last_miss_at) }));
    for (const cause of miss.causes) lines.push('  ' + ((CACHE_CAUSES as readonly string[]).includes(cause) ? t('statusline.cache.cause.' + cause, language) : t('statusline.cache.cause.unknown', language, { value: cause })));
    for (const field of ['tools_added', 'tools_removed', 'system_char_delta'] as const) if (miss[field] !== null) lines.push('  ' + tr('cache.' + field, { value: miss[field] }));
    lines.push('', tr('limits'));
    return lines.join('\n') + '\n';
}
export async function diagnosticCommand(args: readonly string[], service: ConfigurationService, language: Language,
    output: (text: string) => void, errors: (text: string) => void, options: { stdin?: () => string; runtime?: RuntimeContext; now?: () => number } = {}): Promise<number> {
    const json = args.includes('--json');
    try {
        const values = argumentsFor(args), path = values['--input'] as string;
        const input = path === '-' ? parseDiagnosticInput(options.stdin?.() ?? decodeUtf8(readLimitedInput(MAX_DIAGNOSTIC_BYTES))) : diagnosticInputFile(path).input;
        const adapter = await diagnosisAdapter(service, options);
        const width = values['--width'];
        if (typeof width === 'string' && !/^\d+$/u.test(width)) throw new ConfigError('errors.protocol.width_must_be_an_integer_from_2', {}, 'invalid_request');
        const selected = diagnosticSnapshot(service, input);
        const result = adapter({ draft: selected.draft, input, scope: values['--scope'] ?? 'main', width: width === undefined ? 120 : Number(width),
            source: path === '-' ? 'stdin' : resolve(path), observed_at: values['--observed-at'] ?? null, include_local: values['--input-only'] !== true });
        result.configuration = selected.configuration;
        output(json ? pythonJson(result, { ensureAscii: false, indent: 2 }) + '\n' : diagnosticText(result, language));
        return 0;
    } catch (error) {
        const localization = error instanceof ConfigError ? localizedError(error) : { key: 'diagnose.error.read', params: {}, fallback: t('diagnose.error.read', 'en') };
        const message = t(localization.key, language, localization.params);
        if (json) output(JSON.stringify({ error: { code: error instanceof ConfigError ? error.code : 'io_error', message, localization } }) + '\n');
        else errors(t('cli.error', language, { detail: message }) + '\n');
        return 2;
    }
}
