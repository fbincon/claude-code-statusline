import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
const COMMANDS: Readonly<Record<string, string>> = {
    configure: 'open_the_interactive_status_line_configuration_editor',
    config: 'view_or_change_status_line_display_settings',
    ui: 'serve_one_internal_json_configuration_request',
    runtime: 'serve_one_independent_live_observation_json_request',
    render: 'render_status_line_json_received_on_stdin',
    'render-subagents': 'render_subagent_status_line_tasks_as_ndjson',
    hook: 'record_a_claude_lifecycle_hook_received_on_stdin',
    'slash-hook': 'handle_claude_statusline_slash_command_hooks',
};
const CONFIG: Readonly<Record<string, string>> = {
    show: 'show_effective_configuration',
    'list-items': 'list_supported_display_items',
    'set-items': 'replace_enabled_items_and_their_order',
    enable: 'append_display_items',
    disable: 'remove_display_items',
    order: 'reorder_all_enabled_items',
    subagents: 'view_or_change_subagent_row_items',
    set: 'set_one_display_or_host_option',
    apply: 'atomically_apply_a_complete_guided_configuration',
    preset: 'apply_an_editable_display_preset',
    import: 'validate_and_import_portable_display_json',
    export: 'export_portable_tool_configuration',
    item: 'set_one_scoped_item_format_priority_width',
    layout: 'select_auto_layout_or_explicit_comma_separated_rows',
    instance: 'set_one_scoped_item_format_priority_width',
    reset: 'restore_display_and_host_defaults',
    language: 'language',
};
/** Human help is localized; command and option identifiers remain stable. */
export function helpText(command: string | undefined, language: Language): string {
    const config = command === 'config';
    const lines = [
        t('cli.usage', language) + 'claude-statusline [--language LANGUAGE] ' + (config ? 'config [--config-dir PATH] COMMAND' : 'COMMAND'),
        '', t('cli.description', language), '', t('cli.positionals', language) + ':',
        ...Object.entries(config ? CONFIG : COMMANDS).map(([name, key]) => '  ' + name.padEnd(18) + t('cli.help.' + key, language)),
        '', t('cli.options', language) + ':',
        '  -h, --help          ' + t('cli.help.help', language),
        '  --language LANGUAGE ' + t('cli.help.language_override', language),
    ];
    if (config || command === 'ui' || command === 'runtime' || command === 'configure')
        lines.push('  --config-dir PATH   ' + t('cli.help.claude_configuration_directory_default_claude_config_dir_or', language));
    return lines.join('\n') + '\n';
}
