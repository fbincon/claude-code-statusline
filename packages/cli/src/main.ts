import { VERSION } from '@fbincon/statusline-core/release';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { errorDescription } from '@fbincon/statusline-platform/errors';
import type { RuntimeContext } from './runtime/context.js';
import type { EditorLauncher } from './integration/editor.js';
import type { RenderEnvironment } from '@fbincon/statusline-core/rendering/context';
import type { Language } from '@fbincon/statusline-core/i18n/messages';
export interface CliEnvironment {
    configDir?: string;
    launch?: LaunchSpec;
    hostVersion?: () => readonly number[] | null;
    now?: () => Date;
    nextId?: () => string;
    stdin?: () => string;
    stdout?: (text: string) => void;
    stderr?: (text: string) => void;
    runtime?: RuntimeContext;
    editor?: EditorLauncher;
    renderObservations?: Partial<RenderEnvironment>;
    installation?: { io?: import('./config/storage.js').Storage; host?: (spec: import('./integration/model.js').ModSpec) => import('./integration/model.js').Host };
}
export async function main(argv: readonly string[] = process.argv.slice(2), environment: CliEnvironment = {}): Promise<number> {
    const stdout = environment.stdout ?? (text => { process.stdout.write(text); });
    const stderr = environment.stderr ?? (text => { process.stderr.write(text); });
    const stdin = environment.stdin ?? (() => decodeUtf8(readFileSync(0)));
    const args = [...argv];
    if (args.length === 1 && args[0] === '--version') {
        stdout(`claude-statusline ${VERSION}\n`);
        return 0;
    }
    if (args.length === 1 && args[0] === 'hook') {
        const [{ hook }, { runtimeContext }] = await Promise.all([import('./runtime/hook.js'), import('./runtime/context.js')]);
        await hook(environment.stdin ?? (() => readFileSync(0)), environment.runtime ?? runtimeContext(environment.configDir));
        return 0;
    }
    async function renderer(command: string): Promise<number> {
        const read = environment.stdin ?? (() => readFileSync(0));
        if (command === 'slash-hook') {
            const { slashHook } = await import('./integration/slash-hook.js');
            stdout(await slashHook(read, environment));
        }
        else {
            const { render } = await import('./rendering/main.js');
            stdout(await render(read, { configDir: environment.configDir, runtime: environment.runtime, now: environment.now ? () => environment.now!().getTime() / 1000 : undefined, observations: environment.renderObservations }, command === 'render-subagents'));
        }
        return 0;
    }
    if (args.length === 1 && ['render', 'render-subagents', 'slash-hook'].includes(args[0]!))
        return renderer(args[0]!);
    // Management translations and storage stay outside the rendering hot path.
    const { ArgumentError, parseConfig, validateConfigHelp, optionToken } = await import('./config/arguments.js');
    const { expandUser, detectClaudeVersion, resolvedPath } = await import('@fbincon/statusline-platform/commands');
    const { isLinkOrReparse } = await import('@fbincon/statusline-platform/files');
    const { ConfigurationService } = await import('./config/service.js');
    const { createStorage } = await import('./config/storage.js');
    const { readPreferences } = await import('./config/preferences.js');
    const { ConfigError } = await import('@fbincon/statusline-core/config/validation');
    const { t } = await import('@fbincon/statusline-core/i18n/messages');
    const { LANGUAGES } = await import('@fbincon/statusline-core/i18n/registry');
    const { localizedError } = await import('./errors.js');
    let selectedLanguage: string | undefined;
    let language: Language = 'en';
    try {
        if (args[0] === '--language' || args[0]?.startsWith('--language=')) {
            const flag = args.shift()!;
            selectedLanguage = flag.includes('=') ? flag.slice(11) : args.shift();
            if (!(LANGUAGES as readonly unknown[]).includes(selectedLanguage))
                throw new ArgumentError('unsupported --language');
        }
        // Resolve preferences without creating files, including before help/parser errors.
        // Only the command's own directory option selects storage. A literal
        // item value after -- must never redirect a configuration write.
        const administrative = ['install', 'uninstall', 'doctor', 'recover'].includes(args[0] ?? '');
        const directoryIndex = administrative ? args.findIndex(arg => arg === '--config-dir' || arg.startsWith('--config-dir=')) : 1;
        const directoryFlag = args[directoryIndex];
        const requestedDirectory = directoryFlag === '--config-dir' ? args[directoryIndex + 1] : directoryFlag?.startsWith('--config-dir=') ? directoryFlag.slice(13) : undefined;
        const rawDirectory = requestedDirectory ?? environment.configDir ?? process.env.CLAUDE_CONFIG_DIR;
        let configDir = resolve(expandUser(rawDirectory?.trim() ? rawDirectory : '~/.claude'));
        if (isLinkOrReparse(configDir)) configDir = resolvedPath(configDir);
        const preferences = readPreferences(configDir, createStorage(environment.now));
        language = (selectedLanguage ?? preferences.ui_language) as Language;
        if (['install', 'uninstall', 'doctor', 'recover', 'config', 'ui', 'runtime', 'configure'].includes(args[0] ?? '') && directoryFlag === '--config-dir' && (requestedDirectory === undefined || optionToken(requestedDirectory))) throw new ArgumentError('--config-dir requires a path');
        const literal = args.indexOf('--'), optionArgs = literal < 0 ? args : args.slice(0, literal);
        if (optionArgs.includes('--help') || optionArgs.includes('-h')) {
            const command = args[0];
            if (command && !command.startsWith('-') && !['install', 'uninstall', 'doctor', 'recover', 'config', 'ui', 'runtime', 'configure', 'hook', 'render', 'render-subagents', 'slash-hook'].includes(command)) throw new ArgumentError(`unknown command: ${command}`);
            if (command === 'config') {
                const offset = directoryFlag === '--config-dir' ? 3 : directoryFlag?.startsWith('--config-dir=') ? 2 : 1;
                validateConfigHelp(args.slice(offset));
            }
            const { helpText } = await import('./help.js');
            stdout(helpText(args[0], language));
            return 0;
        }
        const command = args.shift();
        if (!['install', 'uninstall', 'doctor', 'recover', 'config', 'ui', 'runtime', 'configure', 'hook', 'render', 'render-subagents', 'slash-hook'].includes(command ?? ''))
            throw new ArgumentError(`unknown command: ${command ?? '(missing)'}`);
        if (administrative) {
            const { parseAdministration } = await import('./integration/arguments.js');
            const options = parseAdministration(command!, args);
            const { installContext, install, uninstall } = await import('./integration/install.js');
            const { renderMessage } = await import('@fbincon/statusline-core/i18n/messages');
            const launch = environment.launch ?? { executable: process.execPath, args: [fileURLToPath(new URL('./entry.js', import.meta.url))] };
            const context = installContext(configDir, launch, (environment.hostVersion ?? detectClaudeVersion)(), environment.installation?.io, environment.installation?.host);
            if (command === 'recover') {
                const { recover } = await import('./recovery/service.js');
                const result = recover(context, options.dryRun);
                if (!result.transactions.length) stdout(t('recovery.none', language) + '\n');
                for (const transaction of result.transactions) stdout(t(options.dryRun ? 'recovery.preview' : 'recovery.result', language, transaction) + '\n');
                return 0;
            }
            if (command === 'doctor') {
                const { doctor } = await import('./integration/doctor.js');
                const diagnostics = doctor(context);
                for (const row of diagnostics) stdout(`[${row.level}] ${renderMessage(row.message, language)}\n`);
                return diagnostics.some(row => row.level === 'ERROR') ? 1 : 0;
            }
            const result = command === 'install' ? install(context, options) : uninstall(context, options);
            stdout(t('cli.change', language, { action: command, state: result.changed ? options.dryRun ? t('state.would_change', language) : t('state.updated', language) : t('state.correct', language), path: result.settingsPath }) + '\n');
            if (result.backupDir) stdout(t('cli.backup', language, { path: result.backupDir }) + '\n');
            for (const message of result.messages) stdout(renderMessage(message, language) + '\n');
            return result.failed ? 2 : 0;
        }
        if (['render', 'render-subagents', 'slash-hook'].includes(command!)) {
            if (args.length)
                throw new ArgumentError(`${command} takes no arguments`);
            return renderer(command!);
        }
        let explicit: string | undefined;
        if (args[0] === '--config-dir' || args[0]?.startsWith('--config-dir=')) {
            const flag = args.shift()!;
            explicit = flag.includes('=') ? flag.slice(13) : args.shift();
            if (explicit === undefined)
                throw new ArgumentError('--config-dir requires a path');
        }
        if (command === 'runtime' || command === 'hook') {
            if (command === 'hook' && explicit !== undefined)
                throw new ArgumentError('hook does not accept --config-dir');
            if (args.length)
                throw new ArgumentError(`${command} takes no positional arguments`);
            const { runtimeContext } = await import('./runtime/context.js');
            const context = environment.runtime ?? runtimeContext(configDir);
            if (command === 'hook') {
                const { hook } = await import('./runtime/hook.js');
                await hook(environment.stdin ?? (() => readFileSync(0)), context);
                return 0;
            }
            const { RuntimeProtocol } = await import('./runtime/live/protocol.js');
            const { readLimitedInput } = await import('@fbincon/statusline-platform/input');
            const result = await new RuntimeProtocol(context).handle(environment.stdin ?? (() => readLimitedInput(1048576)));
            stdout(result.stdout);
            return result.status;
        }
        const launch = environment.launch ?? { executable: process.execPath, args: [fileURLToPath(new URL('./entry.js', import.meta.url))] };
        const service = new ConfigurationService({ configDir, launch, hostVersion: environment.hostVersion ?? detectClaudeVersion }, createStorage(environment.now));
        if (command === 'configure') {
            if (args.length) throw new ArgumentError('configure takes no positional arguments');
            const { configure } = await import('./integration/configure.js');
            return configure(service, language, stdout, stderr);
        }
        if (command === 'ui') {
            if (args.length)
                throw new ArgumentError('ui takes no positional arguments');
            const { ConfigurationProtocol } = await import('./ui/protocol.js');
            const { pythonJson } = await import('@fbincon/statusline-core/json-text');
            const { previewAdapter } = await import('./rendering/preview.js');
            const protocol = new ConfigurationProtocol(service, await previewAdapter(), environment.nextId);
            let raw: string;
            try {
                raw = stdin();
            }
            catch (error) {
                stdout(pythonJson({ protocol_version: 11, error: { code: 'invalid_request', message: error instanceof Error ? error.message : String(error), localization: null } }, { ensureAscii: false }) + '\n');
                return 2;
            }
            const { response, status } = protocol.handle(raw, error => stderr(String(error) + '\n'));
            stdout(pythonJson(response, { ensureAscii: false }) + '\n');
            return status;
        }
        const parsed = parseConfig(args);
        if (preferences.warning)
            stderr(t('cli.warning', language, { detail: preferences.warning }) + '\n');
        try {
            const { executeConfig } = await import('./config/commands.js');
            stdout(executeConfig(parsed, service, language, environment.nextId) + '\n');
            return 0;
        }
        catch (error) {
            const detail = error instanceof ConfigError ? localizedError(error) : errorDescription(error);
            stderr(t('cli.error', language, { detail }) + '\n');
            return 2;
        }
    }
    catch (error) {
        if (error instanceof ArgumentError) {
            stderr(t('cli.parser_error', language, { prog: 'claude-statusline', detail: language === 'en' ? error.message : t(error.key, language, error.params) }));
            return 2;
        }
        stderr(t('cli.error', language, { detail: error instanceof ConfigError ? localizedError(error) : String(error) }) + '\n');
        return 2;
    }
}
