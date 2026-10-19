import { resolve } from 'node:path';
import { expandUser, resolvedPath } from '@fbincon/statusline-platform/commands';
import { isLinkOrReparse } from '@fbincon/statusline-platform/files';
import { readLimitedInput } from '@fbincon/statusline-platform/input';
import { runtimeContext } from './context.js';
import { RuntimeProtocol } from './live/protocol.js';
import type { CliEnvironment } from '../main.js';

/** Bare runtime invocations use the protocol without loading management resources. */
export async function runtimeCommand(environment: CliEnvironment, stdout: (text: string) => void, stderr: (text: string) => void): Promise<number> {
    let directory: string | undefined;
    try {
        const raw = environment.configDir ?? process.env.CLAUDE_CONFIG_DIR;
        let target = resolve(expandUser(raw?.trim() ? raw : '~/.claude'));
        if (isLinkOrReparse(target)) target = resolvedPath(target);
        directory = target;
        const context = environment.runtime ?? runtimeContext(directory);
        const result = await new RuntimeProtocol(context).handle(environment.stdin ?? (() => readLimitedInput(1048576)));
        stdout(result.stdout);
        return result.status;
    } catch (error) {
        // Keep the existing localized CLI failure boundary, loading it only on failure.
        const [{ t }, { ConfigError }, { localizedError }] = await Promise.all([
            import('@fbincon/statusline-core/i18n/messages'), import('@fbincon/statusline-core/config/validation'), import('../errors.js'),
        ]);
        let language: import('@fbincon/statusline-core/i18n/messages').Language = 'en';
        if (directory !== undefined) {
            const [{ readPreferences }, { createStorage }] = await Promise.all([import('../config/preferences.js'), import('../config/storage.js')]);
            language = readPreferences(directory, createStorage(environment.now)).ui_language;
        }
        stderr(t('cli.error', language, { detail: error instanceof ConfigError ? localizedError(error) : String(error) }) + '\n');
        return 2;
    }
}
