import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import type { Storage } from '../config/storage.js';
import type { LocalizedText } from '@fbincon/statusline-core/i18n/messages';
export const OWNER = 'claude-code-statusline';
export const OWNER_FILE = '.claude-statusline-owner.json';
export const HOOKS = ['SessionStart', 'UserPromptSubmit', 'Stop', 'StopFailure', 'SessionEnd'] as const;
export const SUBAGENT_HOOKS = ['SubagentStart', 'SubagentStop'] as const;
export const SKILL = 'statusline-config', EXTERNAL = 'statusline-configure';
export { VERSION } from '@fbincon/statusline-core/release';
export interface ModSpec {
    name: string;
    marketplace: string;
    minimum: readonly number[];
    protocol: number;
    plugin: string;
}
function spec(name: string, marketplace: string, minimum: readonly number[], protocol: number): ModSpec {
    return { name, marketplace, minimum, protocol, plugin: name + '@' + marketplace };
}
export const NATIVE = spec('statusline-native', 'claude-statusline-local', [2, 1, 287], 11);
export const RUNTIME = spec('statusline-runtime', 'claude-statusline-runtime-local', [2, 1, 289], 2);
export interface Host {
    run(args: readonly string[], values?: Record<string, string>, json?: boolean): unknown;
    listing(): [
        Record<string, unknown>[],
        Record<string, unknown>[]
    ];
}
export interface InstallContext {
    configDir: string;
    launch: LaunchSpec;
    version: readonly number[] | null;
    io: Storage;
    host: (spec: ModSpec) => Host;
}
export interface InstallOptions {
    dryRun?: boolean;
    force?: boolean;
    external?: boolean;
    native?: boolean;
    liveMetrics?: boolean;
    nativeTiming?: boolean;
}
export interface ModResult {
    state: 'installed' | 'disabled' | 'plugin-disabled' | 'suspended' | 'blocked';
    changed: boolean;
    active: boolean;
    messages: (string | LocalizedText)[];
}
export interface ChangeResult {
    action: string;
    changed: boolean;
    settingsPath: string;
    backupDir: string | null;
    changedPaths: string[];
    nativeState?: string;
    messages: (string | LocalizedText)[];
    failed: boolean;
}
export interface Diagnostic {
    level: 'OK' | 'WARN' | 'ERROR';
    message: string | LocalizedText;
}
