import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
const COMMANDS: Readonly<Record<string, string>> = {
    update: 'update_package',
    rollback: 'rollback_package',
    setup: 'guided_setup',
    recover: 'recover_installation',
    install: 'configure_claude_code_to_use_this_status_line',
    uninstall: 'remove_only_this_tool_s_claude_code_configuration',
    doctor: 'diagnose_the_installation_without_changing_files',
    diagnose: 'diagnose_supplied_input',
    task: 'task_details',
    source: 'source_management',
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
    group: 'component_groups',
    reset: 'restore_display_and_host_defaults',
    language: 'language',
    profile: 'display_profiles',
    project: 'project_bindings',
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
    if (config || ['setup', 'ui', 'runtime', 'configure', 'install', 'uninstall', 'doctor', 'recover', 'diagnose'].includes(command ?? ''))
        lines.push('  --config-dir PATH   ' + t('cli.help.claude_configuration_directory_default_claude_config_dir_or', language));
    if (config) lines.push('  import PATH --select FIELD,... [--user | --profile NAME | --project PATH] [--dry-run]',
        '  profile import PATH --select FIELD,... [--user | --profile NAME | --project PATH] [--dry-run]');
    if (command === 'setup' || command === 'install' || command === 'uninstall' || command === 'recover') lines.push('  --dry-run           ' + t('cli.help.report_whether_settings_would_change', language));
    if (command === 'install') {
        const options = {
            force: 'replace_conflicting_statusline_and_subagentstatusline_settings_or_unrelated',
            'experimental-slash-tui': 'enable_external_statusline_configure_stable_default_suspend_on',
            'no-experimental-slash-tui': 'persistently_disable_the_external_statusline_configure_entry',
            'native-editor': 'enable_the_in_session_client_tui_stable_default',
            'no-native-editor': 'persistently_disable_and_remove_owned_native_editor_integration',
            'live-metrics': 'enable_independent_runtime_collection_opt_in_claude_code',
            'no-live-metrics': 'persistently_disable_independent_runtime_collection',
            'native-timing': 'enable_native_task_timing_opt_in',
            'no-native-timing': 'disable_native_timing_while_retaining_hook_transcript_timing',
        };
        for (const [flag, key] of Object.entries(options)) lines.push('  --' + flag.padEnd(25) + t('cli.help.' + key, language));
    }
    if (command === 'diagnose') lines.push('', '  --input FILE|- [--scope main|subagent] [--width 120]', '  --json [--input-only] [--observed-at ISO_TIME]', '  ' + t('diagnose.help', language));
    if (command === 'source') lines.push('', '  list|add|edit|review|enable|disable|remove|bind|unbind|refresh|status|cancel|diagnose|auto-on|auto-off', '  --json --file FILE --review REVISION --project PATH --session ID --agent ID', '  --instance ID --scope main|subagent --profile NAME --no-wait --interval SECONDS', '  ' + t('sources.help',language));
    if (command === 'task') lines.push('', '  show --session-id ID [--prompt-id ID] [--json] [--config-dir PATH]', '  ' + t('task.help',language));
    if (command === 'configure') lines.push('', '  [--user | --profile NAME | --project PATH]', '  Ctrl+O  ' + t('profiles.title',language));
    if (command === 'setup') lines.push('', '  ' + t('setup.steps', language));
    if (['update','rollback','recover'].includes(command??'')) lines.push('',
        '  update --check [--version EXACT | --channel latest|beta] [--json]',
        '  update [--version EXACT | --channel latest|beta]',
        '  rollback [--version EXACT]',
        '  recover --package [--version EXACT]',
        '  recover --restore-config BACKUP_ID',
        '  --prefix PATH --config-dir PATH --dry-run --yes',
        '  '+t('management.help',language));
    if (!command || command.startsWith('-')) lines.push('', t('package.help',language));
    if (config) lines.push('', '  profile list|save|rename|delete|preview|activate|import|export', '  project list|bind|unbind|resolve', '  ' + t('profiles.help',language));
    return lines.join('\n') + '\n';
}
