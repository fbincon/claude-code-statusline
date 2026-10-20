import { Session, outcome, type Backend } from '@fbincon/statusline-tui/session';
import { RESULT_ENV, REQUEST_ENV, NONCE_ENV, resultPath, requestGuard, deadline, writeResult, EditorRevoked } from '@fbincon/statusline-platform/terminal/bridge';
import type { Language } from '@fbincon/statusline-core/i18n/messages';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { parseResponse, requestText } from '@fbincon/statusline-core/editor/backend';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { ConfigurationService } from '../config/service.js';
import { ConfigurationProtocol } from '../ui/protocol.js';
import { previewAdapter } from '../rendering/preview.js';
import { localizedError } from '../errors.js';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { renderMessage } from '@fbincon/statusline-core/i18n/messages';
import type { ConfigTarget } from '@fbincon/statusline-core/contracts/ui';
export async function configure(service: ConfigurationService, language: Language, stdout: (value: string) => void, stderr: (value: string) => void, env: NodeJS.ProcessEnv = process.env, target?: ConfigTarget): Promise<number> {
    const configDir = service.context.configDir, rawResult = env[RESULT_ENV];
    let path: string | undefined;
    if (rawResult !== undefined) {
        try {
            path = resultPath(configDir, rawResult);
        }
        catch {
            return 2;
        }
    }
    let result = outcome('error', language, 2), guard = () => { };
    try {
        if (!process.stdin.isTTY || !process.stdout.isTTY)
            throw new Error(t('cli.configure_requires_terminal', language));
        if (env[REQUEST_ENV]) {
            if (!path || env[REQUEST_ENV] !== path.replace(/result\.json$/u, 'request.json'))
                throw new Error('Mismatched editor invocation');
            guard = requestGuard(configDir, env[REQUEST_ENV]!, env[NONCE_ENV] ?? '', service.context.launch);
        }
        const stopAt = path ? deadline(env) : undefined;
        // Check revocation after lock acquisition as well as between terminal events.
        const io = service.io;
        const guarded = new ConfigurationService(service.context, { ...io, lock(directory, action) { return io.lock(directory, () => { guard(); return action(); }); } });
        const protocol = new ConfigurationProtocol(guarded, await previewAdapter());
        const backend: Backend = { request(operation, payload = {}) {
                if (operation === 'read' && Object.keys(payload as object).length === 0 && target) payload = { target };
                const response = protocol.handle(requestText(operation, payload), error => { throw error; });
                return parseResponse(operation, { exitCode: response.status, stdout: pythonJson(response.response), stderr: '' });
            } };
        const session = await Session.open(backend, language, guard);
        result = await session.run({ deadline: stopAt });
    }
    catch (error) {
        const message = error instanceof ConfigError ? renderMessage(localizedError(error), language) : error instanceof Error ? error.message : String(error);
        result = error instanceof EditorRevoked ? outcome('interrupted', language, 130) : outcome('error', language, 2, message);
    }
    if (path) {
        try {
            guard();
            writeResult(path, configDir, result);
        }
        catch (error) {
            return error instanceof EditorRevoked ? result.exit_code : 2;
        }
    }
    else if (result.outcome === 'error')
        stderr(t('cli.error', language, { detail: result.message }) + '\n');
    else if (['updated', 'already-current', 'cancelled'].includes(result.outcome))
        stdout(result.message + '\n');
    return result.exit_code;
}
