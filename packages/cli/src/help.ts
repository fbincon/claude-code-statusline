import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
const COMMANDS: Readonly<Record<string, string>> = {
    recover: 'recover_installation',
    install: 'configure_claude_code_to_use_this_status_line',
    uninstall: 'remove_only_this_tool_s_claude_code_configuration',
    doctor: 'diagnose_the_installation_without_changing_files',
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
    if (config || ['ui', 'runtime', 'configure', 'install', 'uninstall', 'doctor', 'recover'].includes(command ?? ''))
        lines.push('  --config-dir PATH   ' + t('cli.help.claude_configuration_directory_default_claude_config_dir_or', language));
    if (command === 'install' || command === 'uninstall' || command === 'recover') lines.push('  --dry-run           ' + t('cli.help.report_whether_settings_would_change', language));
    if (command === 'install') {
        const options = {
            force: 'replace_conflicting_statusline_and_subagentstatusline_settings_or_unrelated',
            'experimental-slash-tui': 'enable_external_statusline_configure_stable_default_suspend_on',
            'no-experimental-slash-tui': 'persistently_disable_the_external_statusline_configure_entry',
            'native-editor': 'enable_the_in_session_client_tui_stable_default',
            'no-native-editor': 'persistently_disable_and_remove_owned_native_editor_integration',
            'live-metrics': 'enable_independent_runtime_collection_opt_in_claude_code',
            'no-live-metrics': 'persistently_disable_independent_runtime_collection',
            'native-timing': 'enable_native_task_timing_default_on_compatible_hosts',
            'no-native-timing': 'disable_native_timing_while_retaining_hook_transcript_timing',
        };
        for (const [flag, key] of Object.entries(options)) lines.push('  --' + flag.padEnd(25) + t('cli.help.' + key, language));
    }
    return lines.join('\n') + '\n';
}
