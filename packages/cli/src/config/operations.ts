import { POWERLINE_FIELDS } from '@fbincon/statusline-core/contracts/ui';
import { setField } from '@fbincon/statusline-core/config/editor-fields';
import type { DisplayDraft, Scope } from '@fbincon/statusline-core/contracts/ui';
import { validateItems, defaultItem } from '@fbincon/statusline-core/config/display';
import { FORMAT_CHOICES } from '@fbincon/statusline-core/config/formatting';
import { clone, fail } from '@fbincon/statusline-core/config/validation';
import { legacyId, scoped, updateDisplay, updateSubagents } from '@fbincon/statusline-core/config/instances';
import { hostOption, settingsWithHost, toggle } from './host.js';
import { ConfigurationService, UNCHANGED, type MutationResult } from './service.js';
export const DISPLAY_OPTIONS = [
    ...POWERLINE_FIELDS.map(f => f.key.replaceAll('.', '-').replaceAll('_', '-')),
    'statusline-language', 'branch-diff-base', 'colors', 'palette', 'theme', 'powerline-glyph', 'directory-style', 'separator-style', 'scope-labels', 'subagent-statusline',
    ...Object.keys(FORMAT_CHOICES).map(key => key.replaceAll('_', '-')), 'threshold-colors', 'warning-threshold', 'critical-threshold',
    'subagent-visibility', 'subagent-hide-completed', 'subagent-row-limit', 'subagent-task-max-width',
];
export const HOST_OPTIONS = ['padding', 'refresh-interval', 'hide-vim-mode-indicator'];
export const OPTIONS = [...DISPLAY_OPTIONS, ...HOST_OPTIONS].sort();
export function legacyIds(config: DisplayDraft, scope: Scope, types: readonly string[], bulk = false): string[] {
    const nodes = scoped(config, scope).instances;
    if (bulk && (nodes.some(node => ['text', 'spacer'].includes(node.type_id)) || new Set(nodes.map(node => node.type_id)).size !== nodes.length))
        fail('composition.errors.legacy', { scope });
    return types.map(type => legacyId(config, scope, type, true));
}
function replaceScope(config: DisplayDraft, scope: Scope, nodes: DisplayDraft['instances']): DisplayDraft {
    return scope === 'main' ? updateDisplay(config, { instances: nodes }) : updateDisplay(config, { subagents: updateSubagents(config.subagents, { instances: nodes }) });
}
export function selectedItems(config: DisplayDraft, scope: Scope, action: string, types: readonly string[]): DisplayDraft {
    const selected = legacyIds(config, scope, validateItems(types, scope), ['set-items', 'order'].includes(action));
    const target = scoped(config, scope), current = target.instances.filter(node => node.enabled).map(node => node.id);
    if (action === 'order' && (selected.length !== current.length || selected.some(id => !current.includes(id))))
        fail('errors.service.order_must_contain_every_enabled_item_exactly', { value0: '' });
    if (action === 'enable' || action === 'disable') {
        const nodes = clone(target.instances);
        const structural = (scope === 'main' && config.layout.mode === 'explicit') || nodes.some(node => ['text', 'spacer'].includes(node.type_id)) || new Set(nodes.map(node => node.type_id)).size !== nodes.length;
        for (const id of selected) {
            const index = nodes.findIndex(node => node.id === id), node = nodes[index];
            if (!node) {
                if (action === 'enable')
                    nodes.push({ id, type_id: id, enabled: true, text: null, options: defaultItem() });
                continue;
            }
            if (node.enabled === (action === 'enable'))
                continue;
            node.enabled = action === 'enable';
            if (action === 'enable' && !structural) {
                nodes.splice(index, 1);
                nodes.push(node);
            }
        }
        return replaceScope(config, scope, nodes);
    }
    return scope === 'main' ? updateDisplay(config, { items: selected }) : updateDisplay(config, { subagents: updateSubagents(config.subagents, { items: selected }) });
}
export function selection(service: ConfigurationService, scope: Scope, action: string, types: readonly string[]): MutationResult {
    validateItems(types, scope);
    return service.mutate(`config-${scope === 'subagent' ? 'subagents-' : ''}${action}`, config => [selectedItems(config, scope, action, types), UNCHANGED]);
}
function commandInteger(value: unknown, key: string): number {
    if (typeof value === 'number' && Number.isFinite(value))
        return Math.trunc(value);
    if (typeof value === 'string' && /^[+-]?\d+$/u.test(value.trim()))
        return Number(value);
    return fail(key);
}
export function displayOption(config: DisplayDraft, option: string, value: unknown): DisplayDraft {
    if (option.startsWith('powerline-') && option !== 'powerline-glyph')
        return setField(config, 'powerline.' + option.slice(10).replaceAll('-', '_'), value);
    if (option === 'branch-diff-base')
        return updateDisplay(config, { metrics: { branch_diff_base_ref: value === 'auto' ? null : value as string } });
    if (option.startsWith('subagent-') && option !== 'subagent-statusline') {
        const key = option.slice('subagent-'.length).replaceAll('-', '_');
        if (key === 'hide_completed') {
            if (!['on', 'off', true, false].includes(value as string | boolean))
                fail('errors.advanced.hide_completed_must_be_on_off');
            value = value === 'on' || value === true;
        }
        else if (['row_limit', 'task_max_width'].includes(key))
            value = value === 'none' || value === null ? null : commandInteger(value, 'errors.advanced.limit_must_be_an_integer_or_none');
        return updateDisplay(config, { subagents: updateSubagents(config.subagents, { [key]: value }) });
    }
    const name = option.replaceAll('-', '_');
    if (Object.hasOwn(FORMAT_CHOICES, name))
        return updateDisplay(config, { formatting: { ...config.formatting, [name]: value } });
    if (['threshold-colors', 'warning-threshold', 'critical-threshold'].includes(option)) {
        const key = option === 'threshold-colors' ? 'enabled' : option === 'warning-threshold' ? 'warning' : 'critical';
        value = key === 'enabled' ? toggle(value, option) : commandInteger(value, 'errors.service.threshold_must_be_an_integer');
        return updateDisplay(config, { formatting: { ...config.formatting, thresholds: { ...config.formatting.thresholds, [key]: value } } });
    }
    if (option === 'colors')
        return updateDisplay(config, { use_colors: toggle(value, option) });
    if (option === 'subagent-statusline')
        return updateDisplay(config, { subagents: updateSubagents(config.subagents, { enabled: toggle(value, option) }) });
    if (['theme', 'powerline-glyph', 'palette', 'directory-style', 'separator-style', 'scope-labels', 'statusline-language'].includes(option))
        return updateDisplay(config, { [name]: value });
    return fail('errors.service.unknown_display_option', { option });
}
export function setOption(service: ConfigurationService, option: string, value: unknown): MutationResult {
    if (!OPTIONS.includes(option))
        fail('errors.service.unknown_option_expected_one_of', { value0: OPTIONS.join(', ') });
    return service.mutate(`config-set-${option}`, (display, settings, host) => DISPLAY_OPTIONS.includes(option) ? [displayOption(display, option, value), UNCHANGED] : [UNCHANGED, settingsWithHost(settings, service.context.launch, hostOption(host, option, value))]);
}
