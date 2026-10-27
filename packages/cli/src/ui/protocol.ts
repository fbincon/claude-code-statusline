import { SourceService } from '../sources/service.js';
import { contextFor } from '../sources/context.js';
import { sourceContext } from '@fbincon/statusline-core/extensions/model';
import { RenderTrace } from '@fbincon/statusline-core/rendering/trace';
import { explain } from '@fbincon/statusline-core/rendering/explain';
import { explanationFacts } from './explain.js';
import type { Diagnose } from '../diagnostics/service.js';
import { VERSION } from '@fbincon/statusline-core/release';
import { randomUUID } from 'node:crypto';
import * as contracts from '@fbincon/statusline-core/contracts/ui';
import type { Draft } from '@fbincon/statusline-core/contracts/ui';
import { requestObject, validateDraft } from '@fbincon/statusline-core/config/draft';
import { isSchema } from '@fbincon/statusline-core/config/display';
import { ConfigError, object } from '@fbincon/statusline-core/config/validation';
import { ITEMS } from '@fbincon/statusline-core/config/catalog';
import { applyPreset } from '@fbincon/statusline-core/config/presets';
import { differences } from '@fbincon/statusline-core/config/import-review';
import { selectImport } from '@fbincon/statusline-core/editor/import-selection';
import { text } from '@fbincon/statusline-core/i18n/messages';
import { readJson, JsonSyntaxError } from '@fbincon/statusline-core/json-read';
import { safeInteger } from '@fbincon/statusline-core/json';
import { ConfigurationService, atLeast, draft, type EffectiveConfig } from '../config/service.js';
import { readPreferences, setLanguage } from '../config/preferences.js';
import { importFile, exportFile } from '../config/transfer.js';
import { localizedError } from '../errors.js';
import { errorDescription } from '@fbincon/statusline-platform/errors';
import { ProfileService } from '../config/profiles.js';
import { taskAdapter } from '../tasks/service.js';
export const BACKEND_VERSION = VERSION;
export const OPERATIONS = contracts.OPERATIONS;
export type Preview = (draft: Draft, width: number, trace?: RenderTrace) => contracts.PreviewResult;
export function capabilities(version: readonly number[] | null): contracts.Capabilities {
    return {
        host_version: version?.join('.') ?? null,
        subagent_rows: version === null ? 'unknown' : atLeast(version, [2, 1, 205]) ? 'supported' : 'unsupported',
        native_mod: version === null ? 'unknown' : atLeast(version, [2, 1, 287]) ? 'unverified' : 'unsupported',
        native_mod_loaded: null, data_observation: 'not_observed',
    };
}
export function configurationOptions(): contracts.ConfigurationOptions {
    return {
        colors: { choices: [true, false] }, palette: { choices: [...contracts.PALETTE_VALUES] }, theme: { choices: [...contracts.THEME_VALUES] },
        'powerline-glyph': { choices: [...contracts.POWERLINEGLYPH_VALUES] }, 'directory-style': { choices: [...contracts.DIRECTORYSTYLE_VALUES] },
        'separator-style': { choices: [...contracts.SEPARATORSTYLE_VALUES] }, 'scope-labels': { choices: [...contracts.SCOPELABELS_VALUES] },
        'statusline-language': { choices: [...contracts.STATUSLINELANGUAGE_VALUES] }, 'subagent-statusline': { choices: [true, false] },
        ...contracts.POWERLINE_OPTIONS,
        padding: { minimum: 0, maximum: 32 }, 'refresh-interval': { minimum: 1, maximum: 3600, special: 'event' }, 'hide-vim-mode-indicator': { choices: [true, false] },
    };
}
/** Pure production description, shared with generated native acceptance fixtures. */
export function configurationDescription(version: readonly number[] | null) {
    return { presets: contracts.PRESETS, editor_fields: contracts.EDITOR_FIELDS, catalog: [...ITEMS], options: configurationOptions(), capabilities: capabilities(version), backend_version: BACKEND_VERSION, operations: [...OPERATIONS], formatting_options: contracts.FORMAT_CHOICES };
}
export class ConfigurationProtocol {
    constructor(public readonly service: ConfigurationService, public readonly preview?: Preview, public readonly nextId: () => string = () => randomUUID().replaceAll('-', ''), public readonly diagnose?: Diagnose) { }
    readResult(effective: EffectiveConfig & { configuration?: contracts.ResolvedConfiguration }): Record<string, unknown> {
        return { draft: draft(effective), revision: effective.revision, installed: effective.installed, installation: effective.installation, capabilities: capabilities(this.service.context.hostVersion()), backend_version: BACKEND_VERSION,
            ...(effective.configuration ? { configuration: effective.configuration } : {}) };
    }
    dispatch(request: unknown): unknown {
        requestObject(request, ['protocol_version', 'operation', 'payload'], 'request');
        if (!isSchema(request.protocol_version, contracts.PROTOCOL_VERSION))
            throw new ConfigError('errors.protocol.unsupported_protocol', { version: contracts.PROTOCOL_VERSION }, 'unsupported_protocol');
        const operation = request.operation;
        if (typeof operation !== 'string' || !(OPERATIONS as readonly string[]).includes(operation))
            throw new ConfigError('errors.protocol.unsupported_configuration_operation', {}, 'unsupported_operation');
        const payload = request.payload;
        if (operation.startsWith('source')) {
            const sources = new SourceService(this.service);
            if (operation === 'sources_read') { requestObject(payload, [], 'payload'); return sources.read(); }
            if (operation === 'sources_apply') return sources.mutate(payload);
            if (operation === 'source_context') {
                requestObject(payload, ['project','session','agent'], 'payload');
                for (const key of ['project','session','agent']) if (payload[key] !== null && typeof payload[key] !== 'string') throw new ConfigError('sources.error.invalid');
                return contextFor(payload.project as string | null ?? process.cwd(), payload.session as string | null, payload.agent as string | null);
            }
            requestObject(payload, operation === 'source_refresh' ? ['id','context','owner'] : operation === 'source_release' ? ['id','owner'] : operation === 'source_diagnose' ? ['id','context'] : ['id'], 'payload');
            if (operation === 'source_review') return sources.review(payload.id);
            if (operation === 'source_status') return sources.job(payload.id);
            if (operation === 'source_release') return sources.release(payload.id,payload.owner);
            if (operation === 'source_cancel') return sources.cancel(payload.id);
            if (operation === 'source_diagnose') return sources.diagnose(payload.id, sourceContext(payload.context));
            return sources.start(payload.id, payload.context, payload.owner);
        }

        if (operation === 'task_details') return taskAdapter(this.service.context.configDir)(payload);
        if (operation === 'profiles_read' || operation === 'profiles_apply' || operation === 'profile_import' || operation === 'profile_export') {
            const profiles = new ProfileService(this.service, this.nextId);
            if (operation === 'profiles_read') { requestObject(payload, [], 'payload'); return profiles.read(); }
            if (operation === 'profiles_apply') return profiles.mutate(payload);
            requestObject(payload, operation === 'profile_import' ? ['path', ...(object(payload) && Object.hasOwn(payload, 'selection') ? ['draft', 'selection'] : [])] : ['path', 'name', 'display', 'overwrite'], 'payload');
            if (typeof payload.path !== 'string' || !payload.path.trim() || payload.path.includes('\0'))
                throw new ConfigError('errors.protocol.path_must_be_nonempty_text_without_nul', {}, 'invalid_request');
            if (operation === 'profile_import') {
                const imported = profiles.import(payload.path);
                if (!Object.hasOwn(payload, 'selection')) return imported;
                const current = validateDraft(payload.draft, true);
                return { name: imported.name, display: selective(current, { display: imported.display, host: current.host }, payload.selection).display };
            }
            if (typeof payload.name !== 'string' || typeof payload.overwrite !== 'boolean')
                throw new ConfigError('profiles.error.invalid', { value: '' }, 'invalid_request');
            return profiles.export(payload.path, payload.name, payload.display, payload.overwrite);
        }
        if (operation === 'read_ui_preferences' || operation === 'set_ui_language') {
            requestObject(payload, operation === 'read_ui_preferences' ? [] : ['ui_language'], 'payload');
            return operation === 'read_ui_preferences' ? readPreferences(this.service.context.configDir, this.service.io) : setLanguage(this.service.context.configDir, payload.ui_language, this.service.io);
        }
        if (['import', 'review_import', 'export', 'preset'].includes(operation)) {
            requestObject(payload, operation === 'export' ? ['draft', 'path', 'overwrite'] : operation === 'preset' ? ['draft', 'preset'] : ['draft', 'path', ...(object(payload) && Object.hasOwn(payload, 'selection') ? ['selection'] : [])], 'payload');
            const current = validateDraft(payload.draft, true);
            if (operation === 'preset') {
                if (typeof payload.preset !== 'string')
                    throw new ConfigError('errors.protocol.preset_must_be_a_string', {}, 'invalid_request');
                return { draft: { display: applyPreset(current.display, payload.preset, this.nextId), host: current.host } };
            }
            const path = payload.path;
            if (typeof path !== 'string' || !path.trim() || path.includes('\0'))
                throw new ConfigError('errors.protocol.path_must_be_nonempty_text_without_nul', {}, 'invalid_request');
            if (operation === 'import')
                return { draft: object(payload) && Object.hasOwn(payload, 'selection') ? selective(current, importFile(path, current), payload.selection) : importFile(path, current) };
            if (operation === 'review_import') {
                const imported = importFile(path, current), candidate = object(payload) && Object.hasOwn(payload, 'selection') ? selective(current, imported, payload.selection) : imported;
                return { draft: candidate, changes: differences(current, candidate) };
            }
            if (typeof payload.overwrite !== 'boolean')
                throw new ConfigError('errors.protocol.overwrite_must_be_a_boolean', {}, 'invalid_request');
            return { path: exportFile(path, current, this.service.context.configDir, payload.overwrite) };
        }
        if (operation === 'describe' || operation === 'read')
            requestObject(payload, operation === 'read' && object(payload) && Object.hasOwn(payload, 'target') ? ['target'] : [], 'payload');
        if (operation === 'describe')
            return configurationDescription(this.service.context.hostVersion());
        if (operation === 'read') {
            const scoped = object(payload) && Object.hasOwn(payload, 'target');
            return this.readResult(scoped ? new ProfileService(this.service).readTarget(payload.target) : this.service.read());
        }
        if (operation === 'apply') {
            const scoped = object(payload) && Object.hasOwn(payload, 'target');
            requestObject(payload, ['draft', 'expected_revision', ...(scoped ? ['target'] : [])], 'payload');
            const parsed = validateDraft(payload.draft, true), revision = payload.expected_revision;
            if (typeof revision !== 'string' || !/^[0-9a-f]{64}$/u.test(revision))
                throw new ConfigError('errors.protocol.expected_revision_must_be_the_revision_returned', {}, 'invalid_request');
            const result = scoped ? new ProfileService(this.service).applyTarget(parsed, revision, payload.target) : this.service.apply(parsed, revision);
            return { ...this.readResult(result.effective), changed: result.changed, backup_dir: result.backup_dir };
        }
        if (operation === 'diagnose') {
            if (!this.diagnose) throw new Error('Diagnosis adapter has not been bound');
            return this.diagnose(payload);
        }
        requestObject(payload, operation==='explain'?['draft','scope','width']:['draft', 'width'], 'payload');
        if (operation==='explain' && payload.scope!=='main' && payload.scope!=='subagent') throw new ConfigError('explain.invalid_scope',{},'invalid_request');
        const parsed = validateDraft(payload.draft);
        let width: number;
        try {
            width = safeInteger(payload.width, 2, 10000);
        }
        catch {
            throw new ConfigError('errors.protocol.width_must_be_an_integer_from_2', {}, 'invalid_request');
        }
        if (!this.preview)
            throw new Error('Preview adapter has not been bound');
        if(operation==='explain') {
            const trace=new RenderTrace(parsed.display);
            const preview=this.preview(parsed,width,trace);
            return explain(parsed,payload.scope as contracts.Scope,width,preview,trace,explanationFacts(this.service));
        }
        return this.preview(parsed, width);
    }
    handle(raw: string, diagnostics: (error: unknown) => void = error => console.error(error)): {
        response: unknown;
        status: number;
    } {
        try {
            const request = readJson(raw, {
                duplicate(field) { throw new ConfigError('errors.protocol.duplicate_json_key', { field }, 'invalid_json'); },
                constant(value) { throw new ConfigError('errors.protocol.non_finite_json_value', { value }, 'invalid_json'); },
            });
            return { response: { protocol_version: contracts.PROTOCOL_VERSION, result: this.dispatch(request) }, status: 0 };
        }
        catch (error) {
            let code: string, message: string, localization: ReturnType<typeof text> | null = null;
            if (error instanceof ConfigError) {
                code = error.code;
                const localized = localizedError(error);
                message = localized.fallback;
                if (message !== error.key)
                    localization = localized;
            }
            else if (error instanceof JsonSyntaxError) {
                code = 'invalid_json';
                message = error.message;
            }
            else if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
                code = 'io_error';
                message = errorDescription(error);
            }
            else {
                diagnostics(error);
                code = 'internal_error';
                localization = text('errors.protocol.unexpected_backend_failure_see_stderr_diagnostics');
                message = localization.fallback;
            }
            return { response: { protocol_version: contracts.PROTOCOL_VERSION, error: { code, message, localization } }, status: 2 };
        }
    }
}

function selective(current: Draft, incoming: Draft, selection: unknown): Draft {
    try { return validateDraft(selectImport(current, incoming, selection), true); }
    catch (error) {
        if (error instanceof Error && error.message === 'review.selection.invalid') throw new ConfigError(error.message);
        throw error;
    }
}
