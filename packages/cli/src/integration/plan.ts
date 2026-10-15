import { join } from 'node:path';
import { commandFor } from '@fbincon/statusline-platform/commands';
import { clone, object, fail } from '@fbincon/statusline-core/config/validation';
import { safeInteger } from '@fbincon/statusline-core/json';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { HOOKS, SUBAGENT_HOOKS, SKILL, EXTERNAL } from './model.js';
import { owns, legacy } from './ownership.js';
export interface PlanContext {
    directory: string;
    launch: LaunchSpec;
    previous: LaunchSpec | null;
    force: boolean;
    fast: boolean;
    external: boolean;
    subagents: boolean;
    rows: boolean;
}
export function cleanHooks(groups: unknown, context: PlanContext, operations = ['hook'], removeLegacy = false): unknown[] {
    if (groups == null)
        return [];
    if (!Array.isArray(groups))
        fail('errors.install_plan.each_configured_hook_event_must_contain_a');
    return groups.flatMap(group => {
        if (!object(group) || !Array.isArray(group.hooks))
            return [clone(group)];
        const hooks = group.hooks.filter(action => {
            const command = object(action) ? action.command : null;
            return !operations.some(op => owns(command, op, context.launch, context.previous)) && !(removeLegacy && legacy(command, join(context.directory, 'turn_state.py')));
        });
        return hooks.length ? [{ ...clone(group), hooks: clone(hooks) }] : [];
    });
}
export function settingsPlan(settings: Record<string, unknown>, context: PlanContext, uninstall = false): Record<string, unknown> {
    const updated = clone(settings);
    for (const [key, operation] of [['statusLine', 'render'], ['subagentStatusLine', 'render-subagents']] as const) {
        const current = updated[key], command = object(current) ? current.command : null, owned = owns(command, operation, context.launch, context.previous);
        if (uninstall) {
            if (owned)
                delete updated[key];
            continue;
        }
        if (key === 'subagentStatusLine' && (!context.subagents || !context.rows)) {
            if (owned)
                delete updated[key];
            continue;
        }
        if (current != null && !owned && !(key === 'statusLine' && legacy(command, join(context.directory, 'statusline.py'))) && !context.force)
            fail(key === 'statusLine' ? 'errors.install_plan.an_unrelated_statusline_is_already_configured_rerun' : 'errors.install_plan.an_unrelated_subagentstatusline_is_already_configured_choose');
        const desired: Record<string, unknown> = { type: 'command', command: commandFor(context.launch, operation) };
        if (key === 'statusLine') {
            if (!object(current))
                desired.refreshInterval = 1;
            else {
                for (const [field, maximum] of [['padding', 32], ['refreshInterval', 3600]] as const) {
                    try {
                        desired[field] = safeInteger(current[field], 1, maximum);
                    }
                    catch { /* Invalid optional host values are omitted. */ }
                }
                if (current.hideVimModeIndicator === true)
                    desired.hideVimModeIndicator = true;
            }
        }
        updated[key] = desired;
    }
    if (uninstall) {
        if (object(updated.hooks)) {
            const hooks = Object.fromEntries(Object.entries(updated.hooks).map(([event, groups]) => [event, cleanHooks(groups, context, ['hook', 'slash-hook'])]).filter(([, groups]) => (groups as unknown[]).length));
            if (Object.keys(hooks).length)
                updated.hooks = hooks;
            else
                delete updated.hooks;
        }
        return updated;
    }
    if (updated.hooks != null && !object(updated.hooks))
        fail('errors.install_plan.the_hooks_setting_must_contain_a_json');
    const hooks = (updated.hooks ?? {}) as Record<string, unknown>;
    const action = { type: 'command', command: commandFor(context.launch, 'hook'), timeout: 5 };
    for (const event of HOOKS)
        hooks[event] = [...cleanHooks(hooks[event], context, ['hook'], true), { hooks: [action] }];
    for (const event of SUBAGENT_HOOKS) {
        const groups = cleanHooks(hooks[event], context);
        if (context.subagents)
            groups.push({ hooks: [action] });
        if (groups.length)
            hooks[event] = groups;
        else
            delete hooks[event];
    }
    const slash = cleanHooks(hooks.UserPromptExpansion, context, ['slash-hook']);
    for (const [enabled, matcher, timeout] of [[context.fast, SKILL, 5], [context.external, EXTERNAL, 600]] as const) {
        if (enabled)
            slash.push({ matcher, hooks: [{ type: 'command', command: commandFor(context.launch, 'slash-hook'), timeout }] });
    }
    if (slash.length)
        hooks.UserPromptExpansion = slash;
    else
        delete hooks.UserPromptExpansion;
    updated.hooks = hooks;
    return updated;
}
