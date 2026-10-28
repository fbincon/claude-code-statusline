import { taskViewer } from '@fbincon/statusline-core/editor/task-viewer';
import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
import { runTaskViewer } from '@fbincon/statusline-tui/task-viewer';
import type { Backend } from '@fbincon/statusline-tui/session';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import type { RuntimeContext } from '../runtime/context.js';
import { readPreferences } from '../config/preferences.js';
import { createStorage } from '../config/storage.js';
import { taskOptions } from './command.js';
import { detailService } from './service.js';
export async function taskViewCommand(args: readonly string[], context: RuntimeContext, language: Language, explicitLanguage?: Language): Promise<number> {
    const options = taskOptions(args), session = options['--session-id'], prompt = options['--prompt-id'];
    if (typeof session !== 'string' || !session || [...session].length > 1024 || /[\p{Cc}\p{Cs}]/u.test(session) ||
        typeof prompt === 'string' && ([...prompt].length > 1024 || /[\p{Cc}\p{Cs}]/u.test(prompt)))
        throw new ConfigError('task.error.input', {}, 'invalid_request');
    if (!process.stdin.isTTY || !process.stdout.isTTY)
        throw new Error(t('task.viewer.terminal', language));
    const backend = { request(operation: string, payload?: unknown) {
            if (operation === 'read_ui_preferences')
                return readPreferences(context.configDir, createStorage());
            if (operation === 'task_details')
                return detailService(payload, context);
            throw new Error('Unsupported task viewer operation');
        } } as Backend;
    return runTaskViewer(taskViewer(session, typeof prompt === 'string' ? prompt : null, language), backend, {}, explicitLanguage);
}
