import { fileURLToPath } from 'node:url';
import { object } from '@fbincon/statusline-core/runtime/values';
import { trim } from '@fbincon/statusline-core/runtime/transcript';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { text, renderMessage, type LocalizedText } from '@fbincon/statusline-core/i18n/messages';
import { detectClaudeVersion } from '@fbincon/statusline-platform/commands';
import { errorDescription } from '@fbincon/statusline-platform/errors';
import type { CliEnvironment } from '../main.js';
import { ConfigurationService, atLeast } from '../config/service.js';
import { createStorage } from '../config/storage.js';
import { loadFeature } from '../config/backend-preferences.js';
import { readPreferences } from '../config/preferences.js';
import { executeConfig, parseSlashArguments } from '../config/commands.js';
import { ArgumentError } from '../config/arguments.js';
import { configDirectory, renderInput } from '../rendering/main.js';
import { localizedError } from '../errors.js';
import { unavailableEditor, UNAVAILABLE_MESSAGE } from './editor.js';
const cut = (value: string, length: number) => [...value].slice(0, length).join('');
export function safeErrorReason(message: unknown): string | LocalizedText {
    if (typeof message !== 'string')
        return 'Interactive status line configuration failed.';
    if (message === UNAVAILABLE_MESSAGE)
        return text('slash.unavailable');
    return cut(message.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/u).map(trim).find(Boolean) ?? 'Interactive status line configuration failed.', 500);
}
export function experimentalReason(result: unknown): string | LocalizedText {
    const row = object(result) ? result : {}, outcome = row.outcome;
    const fixed: Record<string, string> = { 'already-current': 'ui.session.status_line_configuration_already_current', cancelled: 'ui.session.status_line_configuration_unchanged', interrupted: 'ui.session.interactive_status_line_configuration_interrupted_no_changes', 'timed-out': 'ui.session.interactive_status_line_configuration_timed_out_no' };
    if (outcome === 'updated' && typeof row.message === 'string')
        return cut(row.message, 2000);
    return typeof outcome === 'string' && Object.hasOwn(fixed, outcome) ? text(fixed[outcome]!) : safeErrorReason(row.message);
}
export async function handlePayload(data: unknown, environment: CliEnvironment = {}): Promise<string | null> {
    if (!object(data) || data.hook_event_name !== 'UserPromptExpansion' || data.expansion_type !== 'slash_command' || !['statusline-config', 'statusline-configure'].includes(data.command_name as string))
        return null;
    const configDir = configDirectory(environment.configDir), io = createStorage(environment.now);
    const decision = (reason: string | LocalizedText) => pythonJson({ decision: 'block', reason: renderMessage(reason, readPreferences(configDir, io).ui_language) }, { ensureAscii: false, compact: true });
    const commandArgs = data.command_args ?? '', experimental = data.command_name === 'statusline-configure';
    if (typeof commandArgs !== 'string')
        return decision(text(experimental ? 'slash.tui_invalid_arguments' : 'slash.invalid_arguments'));
    const args = trim(commandArgs);
    if (!experimental && !args)
        return null;
    if (['help', '--help', '-h'].includes(args))
        return decision(text(experimental ? 'slash.tui_usage' : 'slash.config_usage'));
    const launch = () => environment.launch ?? { executable: process.execPath, args: [fileURLToPath(new URL('../entry.js', import.meta.url))] };
    if (!experimental) {
        let message: string | LocalizedText;
        try {
            const parsed = parseSlashArguments(commandArgs), service = new ConfigurationService({ configDir, launch: launch(), hostVersion: environment.hostVersion ?? detectClaudeVersion }, io);
            message = executeConfig(parsed, service, readPreferences(configDir, io).ui_language, environment.nextId);
        }
        catch (error) {
            if (!(error instanceof ConfigError || error instanceof ArgumentError))
                throw error;
            message = text('slash.config_unchanged', { detail: error instanceof ConfigError ? localizedError(error) : error.message });
        }
        return decision(message);
    }
    if (args)
        return decision(text('slash.tui_unsupported', { arguments: cut(args, 200) }));
    try {
        let enabled: boolean;
        try {
            enabled = loadFeature(configDir, '2.0.0', io);
        }
        catch (error) {
            if (!(error instanceof ConfigError))
                throw error;
            return decision(text('slash.tui_preference_invalid', { detail: localizedError(error) }));
        }
        if (!enabled)
            return decision(text('slash.tui_disabled'));
        if (!atLeast((environment.hostVersion ?? detectClaudeVersion)(), [2, 1, 258]))
            return decision(text('slash.tui_suspended'));
        const result = await (environment.editor ?? unavailableEditor)({ configDir, backend: launch(), cwd: data.cwd });
        return decision(experimentalReason(result));
    }
    catch (error) {
        return decision(safeErrorReason('Interactive status line configuration failed: ' + errorDescription(error)));
    }
}
export async function slashHook(read: () => string | Uint8Array, environment: CliEnvironment = {}): Promise<string> {
    try {
        const result = await handlePayload(renderInput(read), environment);
        return result === null ? '' : result + '\n';
    }
    catch {
        return '';
    }
}
