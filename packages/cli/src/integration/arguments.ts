import { ArgumentError, optionToken } from '../config/arguments.js';
import type { InstallOptions } from './model.js';
export const FLAGS = {
    'experimental-slash-tui': 'external', 'native-editor': 'native', 'live-metrics': 'liveMetrics', 'native-timing': 'nativeTiming',
} as const;
export function parseAdministration(command: string, args: readonly string[]): InstallOptions & {
    directory?: string;
} {
    const result: InstallOptions & {
        directory?: string;
    } = {}, seen = new Set<string>();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]!;
        if (arg === '--config-dir' || arg.startsWith('--config-dir=')) {
            if (seen.has('directory'))
                throw new ArgumentError('duplicate --config-dir');
            seen.add('directory');
            const value = arg.includes('=') ? arg.slice(13) : args[++i];
            if (value === undefined || optionToken(value))
                throw new ArgumentError('--config-dir requires a path');
            result.directory = value;
            continue;
        }
        if (arg === '--dry-run' && ['install', 'uninstall', 'recover'].includes(command)) {
            result.dryRun = true;
            continue;
        }
        if (arg === '--force' && command === 'install') {
            result.force = true;
            continue;
        }
        const disabled = arg.startsWith('--no-'), name = arg.slice(disabled ? 5 : 2);
        if (command === 'install' && arg.startsWith('--') && Object.hasOwn(FLAGS, name)) {
            const field = FLAGS[name as keyof typeof FLAGS];
            if (seen.has(field))
                throw new ArgumentError('not allowed with argument --' + name, 'cli.not_allowed', { argument: '--' + name });
            seen.add(field);
            result[field] = !disabled;
            continue;
        }
        throw new ArgumentError('unrecognized arguments: ' + arg);
    }
    return result;
}
