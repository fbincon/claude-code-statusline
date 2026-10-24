import { ArgumentError, optionToken } from '../config/arguments.js';
import { exactVersion } from '@fbincon/statusline-core/management/package';
import { resolveLanguage } from '@fbincon/statusline-core/i18n/registry';
import type { Language } from '@fbincon/statusline-core/i18n/messages';
export interface ManagementOptions {
    command: 'update' | 'rollback' | 'recover';
    prefix?: string;
    configDir?: string;
    version?: string;
    channel?: 'latest' | 'beta';
    language?: Language;
    check: boolean;
    json: boolean;
    dryRun: boolean;
    yes: boolean;
    package: boolean;
    restoreConfig?: string;
}
export function managementRequest(argv: readonly string[]): boolean {
    const args = [...argv];
    if (args[0] === '--language')
        args.splice(0, 2);
    else if (args[0]?.startsWith('--language='))
        args.shift();
    return !args.includes('--help') && !args.includes('-h') && (['update', 'rollback'].includes(args[0] ?? '') || args[0] === 'recover' && args.some(arg => arg === '--package' || arg === '--restore-config' || arg.startsWith('--restore-config=')));
}
export function managementOptions(argv: readonly string[]): ManagementOptions {
    const args = [...argv];
    let language: Language | undefined;
    if (args[0] === '--language' || args[0]?.startsWith('--language=')) {
        const flag = args.shift()!;
        language = resolveLanguage(flag.includes('=') ? flag.slice(11) : args.shift()) ?? undefined;
        if (!language)
            throw new ArgumentError('unsupported --language');
    }
    const command = args.shift();
    if (!['update', 'rollback', 'recover'].includes(command ?? ''))
        throw new ArgumentError('unknown package command');
    const result: ManagementOptions = { command: command as ManagementOptions['command'], language, check: false, json: false, dryRun: false, yes: false, package: false };
    const seen = new Set<string>();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]!, name = arg.split('=')[0]!;
        if (seen.has(name))
            throw new ArgumentError('duplicate ' + name);
        seen.add(name);
        if (['--check', '--json', '--dry-run', '--yes', '--package'].includes(name) && arg === name) {
            const key = name === '--dry-run' ? 'dryRun' : name.slice(2);
            (result as any)[key] = true;
            continue;
        }
        if (!['--prefix', '--config-dir', '--version', '--channel', '--restore-config'].includes(name))
            throw new ArgumentError('unrecognized arguments: ' + arg);
        const value = arg.includes('=') ? arg.slice(name.length + 1) : args[++i];
        if (!value || optionToken(value) || /[\0\r\n]/u.test(value))
            throw new ArgumentError(name + ' requires a value');
        if (name === '--version' && !exactVersion(value))
            throw new ArgumentError('--version requires an exact version');
        if (name === '--channel' && !['latest', 'beta'].includes(value))
            throw new ArgumentError('--channel must be latest or beta');
        if (name === '--restore-config' && !/^pkg-[0-9a-f-]{36}$/u.test(value))
            throw new ArgumentError('--restore-config requires a backup ID');
        const key = name === '--config-dir' ? 'configDir' : name === '--restore-config' ? 'restoreConfig' : name.slice(2);
        (result as any)[key] = value;
    }
    if (result.version && result.channel || result.check && command !== 'update' || result.channel && command !== 'update' || result.package && command !== 'recover' || result.restoreConfig && command !== 'recover' || command === 'recover' && Number(result.package) + Number(!!result.restoreConfig) !== 1 || result.restoreConfig && result.version)
        throw new ArgumentError('incompatible package options');
    if (result.json && !result.check && !result.dryRun)
        throw new ArgumentError('--json requires --check or --dry-run');
    return result;
}
