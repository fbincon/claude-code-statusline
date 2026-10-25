import { editAlignment, parseAlignmentColumns, AlignmentReferenceError } from '@fbincon/statusline-core/editor/alignments';
import { selectiveImport } from './selective-import.js';
import { editGroup, groupScope, type GroupEdit } from '@fbincon/statusline-core/editor/groups';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { randomUUID } from 'node:crypto';
import type { Draft, Scope } from '@fbincon/statusline-core/contracts/ui';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { BY_SCOPE } from '@fbincon/statusline-core/config/catalog';
import { clone, ConfigError } from '@fbincon/statusline-core/config/validation';
import { validateItems, validateDisplay } from '@fbincon/statusline-core/config/display';
import { edit, legacyId, scoped } from '@fbincon/statusline-core/config/instances';
import { editItem, editLayout } from '@fbincon/statusline-core/config/editor-fields';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { t, text, type Language } from '@fbincon/statusline-core/i18n/messages';
import { ConfigurationProtocol } from '../ui/protocol.js';
import { ConfigurationService, UNCHANGED, draft, publicConfig, type EffectiveConfig, type MutationResult } from './service.js';
import { displayOption, legacyIds, selectedItems, selection, setOption } from './operations.js';
import { hostOption, installationIdentity, settingsWithHost } from './host.js';
import { readPreferences, setLanguage } from './preferences.js';
import { parseConfig, type ConfigArguments } from './arguments.js';
import { splitCommand } from '@fbincon/statusline-platform/commands';
export function formatMutation(result: MutationResult, language: Language): string {
    return t('config.changed', language, { state: t(result.changed ? 'state.updated' : 'state.current', language) }) + (result.backup_dir ? t('config.backup', language, { path: result.backup_dir }) : '');
}
export function formatEffective(config: EffectiveConfig, language: Language): string {
    const display = config.display, host = config.host;
    const values: Record<string, unknown> = {
        scope: 'user', config: config.config_path, installed: config.installed ? 'yes' : 'no',
        items: display.instances.filter(node => node.enabled).map(node => node.id).join(', ') || '(none)',
        colors: display.use_colors ? 'on' : 'off', palette: display.palette, theme: display.theme, powerline_glyph: display.powerline_glyph,
        directory_style: display.directory_style, separator_style: display.separator_style, scope_labels: display.scope_labels, statusline_language: display.statusline_language,
        subagent_items: display.subagents.instances.filter(node => node.enabled).map(node => node.id).join(', ') || '(none)', custom_subagent_rows: display.subagents.enabled ? 'on' : 'off',
        subagent_statusline: config.subagent_statusline.state, padding: host.padding, refresh_interval: host.refresh_interval, hide_vim_indicator: host.hide_vim_mode_indicator ? 'yes' : 'no',
    };
    return Object.entries(values).map(([key, value]) => t(`config.show.${key}`, language, { value })).join('\n');
}
export function itemListing(scope: Scope, config: EffectiveConfig): Record<string, unknown>[] {
    const nodes = scoped(config.display, scope).instances, ids = nodes.filter(node => node.enabled).map(node => node.id);
    return [...BY_SCOPE[scope].values()].map(definition => {
        const matching = nodes.filter(node => node.type_id === definition.id), enabled = matching.filter(node => node.enabled);
        return { ...definition, enabled: Boolean(enabled.length), position: enabled.length === 1 ? ids.indexOf(enabled[0]!.id) : null, instance_ids: matching.map(node => node.id), enabled_instance_ids: enabled.map(node => node.id), instance_only: ['text', 'spacer'].includes(definition.id) };
    });
}
function pretty(value: unknown): string { return pythonJson(value, { ensureAscii: false, indent: 2 }); }
function applyFlags(service: ConfigurationService, flags: ConfigArguments['flags']): MutationResult {
    validateItems(flags.items, 'main');
    if (flags['subagent-items'] !== undefined)
        validateItems(flags['subagent-items'], 'subagent');
    let host = clone(DEFAULT_HOST);
    for (const name of ['padding', 'refresh-interval', 'hide-vim-mode-indicator'])
        host = hostOption(host, name, flags[name]);
    return service.mutate('config-apply', (current, settings) => {
        if (installationIdentity(settings, service.context.launch).subagentStatusLine!.state === 'foreign')
            throw new ConfigError('errors.service.claude_code_subagentstatusline_belongs_to_another_renderer', {}, 'ownership_mismatch');
        let display = selectedItems(current, 'main', 'set-items', flags.items as string[]);
        if (flags['subagent-items'] !== undefined)
            display = selectedItems(display, 'subagent', 'set-items', flags['subagent-items'] as string[]);
        for (const name of ['colors', 'palette', 'directory-style', 'separator-style', 'subagent-statusline', 'scope-labels', 'statusline-language'])
            if (flags[name] !== undefined)
                display = displayOption(display, name, flags[name]);
        return [display, settingsWithHost(settings, service.context.launch, host)];
    });
}
export function executeConfig(args: ConfigArguments, service: ConfigurationService, language: Language = readPreferences(service.context.configDir, service.io).ui_language, nextId: () => string = () => randomUUID().replaceAll('-', '')): string {
    const { action, flags } = args;
    if (action === 'language') {
        if (args.subaction === 'show') {
            const preference = readPreferences(service.context.configDir, service.io);
            return flags.json ? pretty({ schema_version: 1, ui_language: preference.ui_language }) : t('cli.language', language, { language: preference.ui_language });
        }
        const preference = setLanguage(service.context.configDir, args.subaction === 'reset' ? 'en' : args.value, service.io);
        return t('cli.language_saved', language, { language: preference.ui_language });
    }
    if (action === 'show') {
        const effective = service.read();
        return flags.json ? pretty(publicConfig(effective)) : formatEffective(effective, language);
    }
    if (action === 'list-items' || action === 'subagents' && args.subaction === 'list-items') {
        const scope = action === 'subagents' ? 'subagent' : 'main', listing = itemListing(scope, service.read());
        return flags.json ? pretty(listing) : listing.map(item => `${item.enabled ? '[x]' : '[ ]'} ${item.id}: ` + t(`items.${scope}.${item.id}.description`, language)).join('\n');
    }
    if (action === 'group') {
        const scope = args.scope!;
        if (args.subaction === 'list') return pretty(groupScope(service.read().display, scope).groups);
        const bool = (value: unknown): boolean => { if (value !== 'on' && value !== 'off') throw new ConfigError('composition.groups.invalid'); return value === 'on'; };
        const request: GroupEdit = { action: args.subaction as GroupEdit['action'], id: args.id };
        if (args.subaction === 'create') {
            request.member_ids = typeof flags.members === 'string' ? flags.members.split(',') : [];
            request.primary_id = typeof flags.primary === 'string' ? flags.primary : '';
            if (flags.linked !== undefined) request.link_visibility = bool(flags.linked);
            if (flags.powerline !== undefined) request.shared_powerline = bool(flags.powerline);
        } else if (args.subaction === 'set') {
            if (args.option === 'primary') request.primary_id = args.value;
            else if (args.option === 'members') request.member_ids = args.value!.split(',');
            else if (args.option === 'linked') request.link_visibility = bool(args.value);
            else if (args.option === 'powerline') request.shared_powerline = bool(args.value);
            else throw new ConfigError('composition.groups.invalid');
        } else if (args.subaction === 'move') {
            request.before = flags.before as string | undefined; request.after = flags.after as string | undefined;
        }
        const result = service.mutate('config-group-' + args.subaction, config => {
            try { return [validateDisplay(editGroup(config, scope, request, nextId)), UNCHANGED]; }
            catch (error) { if (error instanceof AlignmentReferenceError) throw new ConfigError('alignment.references', { ids: error.ids.join(', ') }); throw new ConfigError('composition.groups.invalid'); }
        });
        return formatMutation(result, language);
    }
    if (action === 'alignment') {
        if (args.subaction === 'list') return pretty(service.read().display.layout.alignments ?? []);
        const result = service.mutate('config-alignment-' + args.subaction, config => {
            try {
                if (args.subaction === 'set' && typeof flags.columns !== 'string') throw new Error('alignment.invalid');
                return [validateDisplay(editAlignment(config, args.id!, args.subaction === 'set' ? parseAlignmentColumns(String(flags.columns)) : undefined)), UNCHANGED];
            } catch (error) { if (error instanceof Error && error.message === 'alignment.invalid') throw new ConfigError('alignment.invalid'); throw error; }
        });
        return formatMutation(result, language);
    }
    if (action === 'instance') {
        if (args.subaction === 'list') {
            const nodes = scoped(service.read().display, args.scope!).instances;
            return flags.json ? pretty(nodes) : nodes.map(node => `${node.enabled ? '[x]' : '[ ]'} ${node.id}  ${node.type_id}`).join('\n');
        }
        let selected: string | null = null;
        const result = service.mutate(`config-instance-${args.subaction}`, config => {
            const changed = edit(config, args.scope!, { action: args.subaction!, id: args.id, type_id: args.type_id, option: args.option, value: args.value, after: flags.after as string | undefined, before: flags.before as string | undefined, text: flags.text as string | undefined }, nextId);
            selected = changed.selected;
            return [changed.config, UNCHANGED];
        });
        return formatMutation(result, language) + (selected === null ? '' : '\n' + selected);
    }
    if (action === 'subagents' || ['set-items', 'enable', 'disable', 'order'].includes(action))
        return formatMutation(selection(service, action === 'subagents' ? 'subagent' : 'main', args.subaction ?? action, args.items), language);
    if (action === 'set')
        return formatMutation(setOption(service, args.option!, args.value), language);
    if (action === 'apply')
        return formatMutation(applyFlags(service, flags), language);
    if (action === 'preset' || action === 'import' || action === 'export') {
        if (action === 'import' && flags.select !== undefined) return selectiveImport(service, args.path!, flags);
        if (action === 'import' && ['user','profile','project'].some(key => flags[key] !== undefined)) throw new ConfigError('review.selection.invalid');
        const current = service.read(), protocol = new ConfigurationProtocol(service, undefined, nextId);
        const payload: Record<string, unknown> = { draft: draft(current) };
        if (action === 'preset')
            payload.preset = args.preset;
        else
            payload.path = args.path;
        if (action === 'export')
            payload.overwrite = Boolean(flags.overwrite);
        const transformed = protocol.dispatch({ protocol_version: PROTOCOL_VERSION, operation: action, payload }) as {
            draft: Draft;
            path: string;
        };
        if (action === 'export')
            return t('config.exported', language, { path: transformed.path });
        if (flags['dry-run'])
            return pretty(transformed.draft);
        return formatMutation(service.apply(transformed.draft, current.revision), language);
    }
    if (action === 'item' || action === 'layout') {
        const result = service.mutate(`config-${action}`, config => {
            let updated;
            if (action === 'item')
                updated = editItem(config, args.scope!, legacyId(config, args.scope!, args.id!, true), args.option!, args.value);
            else {
                let rows = args.rows!.map(row => row.split(','));
                if (!flags['by-instance']) {
                    legacyIds(config, 'main', [], true);
                    rows = rows.map(row => row.map(type => legacyId(config, 'main', type)));
                }
                updated = editLayout(config, args.mode!, rows);
            }
            return [updated, UNCHANGED];
        });
        return formatMutation(result, language);
    }
    if (action === 'reset')
        return formatMutation(service.reset(), language);
    throw new ConfigError('errors.commands.unknown_config_action', { action });
}
export function configCommand(argv: readonly string[], service: ConfigurationService, language?: Language): string { return executeConfig(parseConfig(argv), service, language); }
export function parseSlashArguments(raw: string): ConfigArguments {
    const args = splitCommand(raw);
    if (!args)
        throw new ConfigError('errors.commands.invalid_command_arguments', { exc: 'No closing quotation' });
    return parseConfig(args);
}
