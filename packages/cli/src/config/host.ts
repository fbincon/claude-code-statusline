import type { HostDraft } from '@fbincon/statusline-core/contracts/ui';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { ConfigError, clone, fail, object } from '@fbincon/statusline-core/config/validation';
import { safeInteger } from '@fbincon/statusline-core/json';
import { normalizedPath, ownedCommand, splitCommand, which } from '@fbincon/statusline-platform/commands';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
export function installationIdentity(settings: Record<string, unknown>, launch: LaunchSpec): Record<string, Record<string, unknown>> {
    return Object.fromEntries([['statusLine', 'render'], ['subagentStatusLine', 'render-subagents']].map(([key, operation]) => {
        const current = settings[key!] ?? null;
        if (current === null)
            return [key, { state: 'absent' }];
        if (!object(current))
            return [key, { state: 'foreign', value: current }];
        const command = current.command ?? null, argv = splitCommand(command);
        const owned = current.type === 'command' && ownedCommand(command, operation!, launch);
        let normalized: unknown = command;
        if (argv?.length) {
            let program = argv[0]!;
            if (owned && /[/\\]/u.test(program))
                program = launch.executable;
            normalized = [normalizedPath(which(program) ?? program), ...argv.slice(1)];
        }
        return [key, { state: owned ? 'owned' : 'foreign', type: current.type ?? null, command: normalized }];
    }));
}
export function hostFromSettings(settings: Record<string, unknown>, launch: LaunchSpec): {
    host: HostDraft;
    installed: boolean;
} {
    const current = settings.statusLine;
    if (!object(current) || current.type !== 'command' || !ownedCommand(current.command, 'render', launch))
        return { host: clone(DEFAULT_HOST), installed: false };
    let padding: number, refresh: number | 'event';
    try {
        padding = safeInteger(current.padding ?? (Object.hasOwn(current, 'padding') ? null : 0), 0, 32);
    }
    catch {
        return fail('errors.host.installed_statusline_padding_is_outside_0_through');
    }
    try {
        refresh = current.refreshInterval == null ? 'event' : safeInteger(current.refreshInterval, 1, 3600);
    }
    catch {
        return fail('errors.host.installed_statusline_refreshinterval_is_outside_1_through');
    }
    const hide = Object.hasOwn(current, 'hideVimModeIndicator') ? current.hideVimModeIndicator : false;
    if (typeof hide !== 'boolean')
        fail('errors.host.installed_statusline_hidevimmodeindicator_must_be_true_or');
    return { host: { padding, refresh_interval: refresh, hide_vim_mode_indicator: hide }, installed: true };
}
export function settingsWithHost(settings: Record<string, unknown>, launch: LaunchSpec, host: HostDraft): Record<string, unknown> {
    const current = settings.statusLine;
    if (!object(current) || current.type !== 'command' || !ownedCommand(current.command, 'render', launch)) {
        throw new ConfigError('errors.host.renderer_not_installed', {}, current == null ? 'not_installed' : 'ownership_mismatch');
    }
    const updated = clone(settings), line = clone(current);
    if (host.padding)
        line.padding = host.padding;
    else
        delete line.padding;
    if (host.refresh_interval === 'event')
        delete line.refreshInterval;
    else
        line.refreshInterval = host.refresh_interval;
    if (host.hide_vim_mode_indicator)
        line.hideVimModeIndicator = true;
    else
        delete line.hideVimModeIndicator;
    updated.statusLine = line;
    return updated;
}
export function toggle(value: unknown, name: string): boolean {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        if (['on', 'true'].includes(value.toLowerCase()))
            return true;
        if (['off', 'false'].includes(value.toLowerCase()))
            return false;
    }
    return fail('errors.host.must_be_on_or_off', { name });
}
export function hostOption(host: HostDraft, option: string, value: unknown): HostDraft {
    const updated = clone(host);
    if (option === 'hide-vim-mode-indicator')
        updated.hide_vim_mode_indicator = toggle(value, option);
    else if (option === 'refresh-interval' && typeof value === 'string' && value.toLowerCase() === 'event')
        updated.refresh_interval = 'event';
    else if (option === 'padding' || option === 'refresh-interval') {
        const parsed = typeof value === 'string' && /^[+-]?\d+$/u.test(value.trim()) ? Number(value) : value;
        try {
            const number = safeInteger(parsed, option === 'padding' ? 0 : 1, option === 'padding' ? 32 : 3600);
            if (option === 'padding')
                updated.padding = number;
            else
                updated.refresh_interval = number;
        }
        catch {
            fail(option === 'padding' ? 'errors.host.padding_must_be_an_integer_from_0' : 'errors.host.refresh_interval_must_be_event_or_an');
        }
    }
    else
        fail('errors.host.unknown_host_option', { option });
    return updated;
}
