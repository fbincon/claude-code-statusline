import test from 'node:test';
import { setup, assert, join, existsSync, readdirSync, readFileSync, selected } from './final-support.js';
import { subprocess, traced } from './final-cli-support.js';
test('tests.integration.test_cli.CliTests.test_version', t => {
    const f = setup(t);
    assert.deepEqual(subprocess(f.root, ['--version']), { status: 0, stdout: 'claude-statusline 2.0.0\n', stderr: '' });
});
test('tests.integration.test_cli.CliTests.test_help_lists_public_commands', t => {
    const f = setup(t), result = subprocess(f.root, ['--help']);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.ok(result.stdout.includes('Linux, Windows and macOS'));
    for (const command of ['config', 'ui', 'runtime', 'render', 'render-subagents', 'hook', 'slash-hook'])
        assert.ok(result.stdout.includes(command));
    assert.deepEqual(readdirSync(f.root), []);
    // configure/install/uninstall/doctor help remains an explicit TS-04 assertion.
});
test('tests.integration.test_cli.CliTests.test_render_invalid_json_is_silent_and_successful', t => {
    assert.deepEqual(subprocess(setup(t).root, ['render'], 'not-json'), { status: 0, stdout: '', stderr: '' });
});
test('tests.integration.test_cli.CliTests.test_render_subagents_invalid_json_is_silent_and_successful', t => {
    assert.deepEqual(subprocess(setup(t).root, ['render-subagents'], 'not-json'), { status: 0, stdout: '', stderr: '' });
});
test('tests.integration.test_cli.CliTests.test_hook_invalid_json_is_silent_and_successful', t => {
    assert.deepEqual(subprocess(setup(t).root, ['hook'], 'not-json'), { status: 0, stdout: '', stderr: '' });
});
test('tests.integration.test_cli.CliTests.test_slash_hook_invalid_json_is_silent_and_successful', t => {
    assert.deepEqual(subprocess(setup(t).root, ['slash-hook'], 'not-json'), { status: 0, stdout: '', stderr: '' });
});
test('tests.integration.test_cli.CliTests.test_all_hot_commands_accept_utf8_bom', t => {
    const f = setup(t), payloads = {
        render: { model: { id: 'claude-测试' }, context_window: { remaining_percentage: 50 } },
        'render-subagents': { columns: 80, tasks: [{ id: 'a', name: '测试', status: 'running' }] },
        hook: { session_id: 'session-bom', prompt_id: 'prompt-bom', hook_event_name: 'UserPromptSubmit' },
        'slash-hook': { hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', command_name: 'statusline-config', command_args: 'help' },
    };
    for (const [command, value] of Object.entries(payloads)) {
        const result = subprocess(f.root, [command], Buffer.from('\ufeff' + JSON.stringify(value)));
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stderr, '');
        if (command !== 'hook')
            assert.ok(result.stdout.length > 0);
    }
    assert.equal(readdirSync(join(f.root, 'runtime/turns')).filter(name => name.endsWith('.json')).length, 1);
});
test('tests.integration.test_cli.CliTests.test_experimental_slash_help_is_one_block_json_object', t => {
    const result = subprocess(setup(t).root, ['slash-hook'], JSON.stringify({ hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', command_name: 'statusline-configure', command_args: '--help' }));
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout.split('\n').length, 2);
    assert.deepEqual(JSON.parse(result.stdout), { decision: 'block', reason: 'Usage: /statusline-configure' });
});
test('tests.integration.test_cli.CliTests.test_hot_paths_do_not_import_curses_or_slash_launcher', t => {
    const f = setup(t);
    for (const [command, payload] of [['render', 'not-json'], ['render-subagents', 'not-json'], ['slash-hook', JSON.stringify({ hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', command_name: 'statusline-config', command_args: 'help' })]]) {
        const result = traced(f.root, [command!], payload!);
        assert.deepEqual(result.modules.filter(url => /curses|\/launcher\.|\/installer\.|\/ui\/session\./u.test(url)), []);
    }
});
test('tests.integration.test_cli.CliTests.test_config_set_items_and_show_json', t => {
    const f = setup(t);
    assert.equal(subprocess(f.root, ['config', 'set-items', 'git', 'tokens']).status, 0);
    const result = subprocess(f.root, ['config', 'show', '--json']);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(selected(JSON.parse(result.stdout).display), ['git', 'tokens']);
});
test('tests.integration.test_cli.CliTests.test_new_items_support_every_cli_item_mutation', t => {
    const f = setup(t);
    for (const args of [['set-items', 'project-name', 'hostname', 'context-used'], ['disable', 'hostname'], ['enable', 'hostname'], ['order', 'context-used', 'hostname', 'project-name']]) {
        const result = subprocess(f.root, ['config', ...args]);
        assert.equal(result.status, 0, result.stderr);
    }
    assert.deepEqual(selected(JSON.parse(subprocess(f.root, ['config', 'show', '--json']).stdout).display), ['context-used', 'hostname', 'project-name']);
    const listed = JSON.parse(subprocess(f.root, ['config', 'list-items', '--json']).stdout);
    for (const id of ['context-used', 'hostname', 'project-name']) {
        const item = listed.find((item: any) => item.id === id);
        assert.equal(item.default_enabled, false);
        assert.equal(item.enabled, true);
    }
});
test('tests.integration.test_cli.CliTests.test_config_validation_error_has_no_traceback', t => {
    const f = setup(t), result = subprocess(f.root, ['config', 'set-items', 'clock']);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /unknown status line item: clock/u);
    assert.doesNotMatch(result.stderr, /Traceback|\bat \w/u);
    assert.ok(!existsSync(f.displayPath));
});
test('tests.integration.test_cli.CliTests.test_config_rejects_status_elapsed_with_status_or_elapsed', t => {
    const f = setup(t), result = subprocess(f.root, ['config', 'subagents', 'set-items', 'status-elapsed', 'status']);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /cannot combine status-elapsed with status or elapsed/u);
    assert.ok(!existsSync(f.displayPath));
});
test('tests.integration.test_cli.CliTests.test_config_apply_updates_display_and_host_settings', t => {
    const f = setup(t, true), result = subprocess(f.root, ['config', 'apply', '--items', 'git', 'tokens', '--subagent-items', 'status', 'tokens', '--subagent-statusline', 'off', '--scope-labels', 'always', '--colors', 'off', '--palette', 'ansi', '--directory-style', 'home', '--separator-style', 'compact', '--padding', '2', '--refresh-interval', '5', '--hide-vim-mode-indicator', 'on']);
    assert.equal(result.status, 0, result.stderr);
    const display = f.display(), settings = JSON.parse(readFileSync(f.settingsPath, 'utf8'));
    assert.deepEqual(selected(display), ['git', 'tokens']);
    assert.deepEqual(selected(display.subagents), ['status', 'tokens']);
    assert.equal(display.subagents.enabled, false);
    assert.equal(display.scope_labels, 'always');
    assert.equal(display.use_colors, false);
    assert.equal(settings.statusLine.padding, 2);
    assert.equal(settings.statusLine.refreshInterval, 5);
    assert.equal(settings.statusLine.hideVimModeIndicator, true);
    assert.deepEqual(settings.permissions, { allow: ['Read'] });
});
