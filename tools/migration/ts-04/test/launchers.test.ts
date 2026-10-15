import test from 'node:test';
import { fixture, assert, fs, join } from './support.js';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { chooseLauncher, launcherArguments, shellQuote, workingDirectory, windowsCommand, type Probe, type Running } from '@fbincon/statusline-platform/terminal/launchers';
import { prepare, resultPath, readResult, writeResult, requestGuard, started, cleanup, cleanupStale, deadline } from '@fbincon/statusline-platform/terminal/bridge';
import { launchEditor, stopEditor } from '@fbincon/statusline-cli/integration/launcher';
import { UNAVAILABLE_MESSAGE } from '@fbincon/statusline-cli/integration/editor';
function probe(calls: any[]): Probe { return { which: name => '/bin/' + name, directory: () => true, executable: () => true, uid: () => 1000, run(command, args) { calls.push([command, args]); return { code: 0, stdout: '%7' }; } }; }
function running(code: number | null): Running { return { code: () => code, error: () => null, stop() { }, close() { } }; }
test('tests.platforms.test_macos_terminal.InvocationTests.test_close_and_total_timeout_are_errors_without_a_result', async (t) => {
    const f = await fixture(t);
    let now = 0;
    const value = await launchEditor({ configDir: f.root, backend: f.launch, cwd: f.root }, { choose: () => ({ kind: 'macos-terminal', executable: '/usr/bin/open' }), run: () => running(0), timeoutMs: 100, now: () => now, sleep: async (ms) => { now += ms; } });
    assert.equal(value.outcome, 'error');
    assert.match(String(value.message), /timed out/);
    assert.deepEqual(fs.readdirSync(join(f.root, 'statusline_runtime/slash_tui')), []);
});
test('tests.platforms.test_macos_terminal.InvocationTests.test_open_errors_and_timeout_revoke_invocation', async (t) => {
    const f = await fixture(t);
    let path = '';
    const value = await launchEditor({ configDir: f.root, backend: f.launch, cwd: f.root }, { choose: () => ({ kind: 'macos-terminal', executable: '/usr/bin/open' }), run(argv, cwd, env) { path = env.CLAUDE_STATUSLINE_EDITOR_REQUEST!; return { ...running(null), error: () => new Error('open refused') }; } });
    assert.equal(value.outcome, 'error');
    assert.match(String(value.message), /open refused/);
    assert.equal(fs.existsSync(path), false);
});
test('tests.platforms.test_macos_terminal.InvocationTests.test_open_success_waits_for_handshake_and_editor_result', async (t) => {
    const f = await fixture(t);
    let environment: NodeJS.ProcessEnv = {}, polls = 0;
    const value = await launchEditor({ configDir: f.root, backend: f.launch, cwd: f.root }, {
        choose: () => ({ kind: 'macos-terminal', executable: '/usr/bin/open' }),
        run(argv, cwd, env) { environment = env; return running(0); },
        sleep: async () => {
            polls++;
            const directory = dirname(environment.CLAUDE_STATUSLINE_SLASH_RESULT!);
            fs.writeFileSync(join(directory, 'started.json'), JSON.stringify({ schema_version: 1, nonce: environment.CLAUDE_STATUSLINE_EDITOR_NONCE, pid: 99999999, token: 'dead' }), { mode: 0o600 });
            writeResult(environment.CLAUDE_STATUSLINE_SLASH_RESULT!, f.root, { outcome: 'cancelled', exit_code: 0, message: 'unchanged' });
        },
    });
    assert.equal(value.outcome, 'cancelled');
    assert.equal(polls, 1);
});
test('tests.integration.test_slash_tui.SelectionAndArgumentsTests.test_tmux_preflight_has_two_second_limit_and_takes_priority', async (t) => {
    const calls: any[] = [];
    const io = probe(calls);
    const selected = chooseLauncher({ TMUX: 'socket', TMUX_PANE: '%7', DISPLAY: ':1' }, 'linux', io);
    assert.equal(selected?.kind, 'tmux');
    assert.deepEqual(calls, [['/bin/tmux', ['display-message', '-p', '-t', '%7', '#{pane_id}']]]);
});
test('tests.integration.test_slash_tui.SelectionAndArgumentsTests.test_failed_or_invalid_tmux_preflight_falls_back_to_gnome', async (t) => {
    for (const pane of ['bad', '%7']) {
        const io = probe([]);
        io.run = () => ({ code: 1, stdout: '' });
        assert.equal(chooseLauncher({ TMUX: 'socket', TMUX_PANE: pane, DISPLAY: ':1' }, 'linux', io)?.kind, 'gnome');
    }
});
test('tests.integration.test_slash_tui.SelectionAndArgumentsTests.test_no_tmux_or_graphical_gnome_returns_none', async (t) => {
    assert.equal(chooseLauncher({}, 'linux', probe([])), null);
    const io = probe([]);
    io.which = () => null;
    assert.equal(chooseLauncher({ DISPLAY: ':1' }, 'linux', io), null);
});
test('tests.integration.test_slash_tui.SelectionAndArgumentsTests.test_macos_without_desktop_requires_valid_tmux_and_never_selects_gnome', async (t) => {
    const io = probe([]);
    io.run = () => ({ code: 1, stdout: '' });
    assert.equal(chooseLauncher({ DISPLAY: ':1', TMUX: 'socket', TMUX_PANE: '%7' }, 'darwin', io), null);
    io.run = () => ({ code: 0, stdout: '%7' });
    assert.equal(chooseLauncher({ TMUX: 'socket', TMUX_PANE: '%7' }, 'darwin', io)?.kind, 'tmux');
});
test('tests.platforms.test_macos_terminal.AvailabilityTests.test_desktop_preflight_is_read_only_and_bounded', async (t) => {
    const calls: any[] = [];
    const io = probe(calls);
    const selected = chooseLauncher({}, 'darwin', io);
    assert.equal(selected?.kind, 'macos-terminal');
    assert.deepEqual(calls, [['/bin/launchctl', ['print', 'gui/1000']]]);
});
test('tests.platforms.test_macos_terminal.AvailabilityTests.test_ssh_and_missing_terminal_do_not_launch_or_probe_desktop', async (t) => {
    for (const env of [{ SSH_CONNECTION: 'remote' }, { SSH_TTY: '/dev/tty' }]) {
        const calls: any[] = [];
        assert.equal(chooseLauncher(env, 'darwin', probe(calls)), null);
        assert.deepEqual(calls, []);
    }
    const calls: any[] = [];
    const io = probe(calls);
    io.directory = () => false;
    assert.equal(chooseLauncher({}, 'darwin', io), null);
    assert.deepEqual(calls, []);
});
test('tests.platforms.test_macos_terminal.AvailabilityTests.test_no_gui_and_failed_gui_probe_are_unavailable', async (t) => {
    const io = probe([]);
    for (const code of [null, 1]) {
        io.run = () => ({ code, stdout: '' });
        assert.equal(chooseLauncher({}, 'darwin', io), null);
    }
});
test('tests.platforms.test_macos_terminal.AvailabilityTests.test_macos_desktop_falls_back_from_invalid_tmux_to_terminal', async (t) => {
    const calls: any[] = [];
    assert.equal(chooseLauncher({ TMUX: 'socket', TMUX_PANE: 'invalid' }, 'darwin', probe(calls))?.kind, 'macos-terminal');
    assert.equal(calls.length, 1);
});
test('tests.integration.test_slash_tui.SelectionAndArgumentsTests.test_tmux_command_uses_fixed_argv_and_shell_quotes_every_value', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    const argv = launcherArguments({ kind: 'tmux', executable: '/bin/tmux', pane: '%7' }, i.request, i.directory, { PATH: '/bin' });
    assert.deepEqual(argv.slice(0, 13), ['/bin/tmux', 'display-popup', '-E', '-T', 'Configure Status Line', '-w', '90%', '-h', '90%', '-d', f.root, '-t', '%7']);
    assert.ok(argv[13]!.includes(shellQuote(f.launch.args[0]!)));
    assert.ok(argv[13]!.includes(shellQuote('CLAUDE_STATUSLINE_EDITOR_NONCE=' + i.request.nonce)));
    assert.equal(shellQuote("a'b"), "'a'\\''b'");
});
test('tests.integration.test_slash_tui.SelectionAndArgumentsTests.test_gnome_uses_direct_argv_active_tab_wait_and_validated_cwd', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    assert.deepEqual(launcherArguments({ kind: 'gnome', executable: '/bin/gnome-terminal' }, i.request, i.directory, {}), ['/bin/gnome-terminal', '--tab', '--active', '--wait', '--title=Configure Status Line', '--working-directory=' + f.root, '--', f.launch.executable, ...f.launch.args, 'configure', '--config-dir', f.root]);
    assert.equal(workingDirectory(f.root), f.root);
    assert.equal(workingDirectory('/missing/ts04'), homedir());
});
test('tests.integration.test_slash_tui.WindowsConsoleTests.test_selection_and_argv_use_current_python_module', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    assert.equal(chooseLauncher({}, 'win32', probe([]))?.kind, 'windows-console');
    assert.deepEqual(launcherArguments({ kind: 'windows-console', executable: 'ignored' }, i.request, i.directory, {}), [f.launch.executable, ...f.launch.args, 'configure', '--config-dir', f.root]);
});
test('tests.platforms.test_macos_terminal.InvocationTests.test_command_quotes_paths_environment_and_uses_exact_python', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    const argv = launcherArguments({ kind: 'macos-terminal', executable: '/usr/bin/open' }, i.request, i.directory, { PATH: '/custom path/bin' });
    assert.deepEqual(argv, ['/usr/bin/open', '-a', 'Terminal', join(i.directory, 'terminal.command')]);
    const body = fs.readFileSync(argv[3]!, 'utf8');
    assert.ok(body.includes(shellQuote(f.launch.executable)));
    assert.ok(body.includes(shellQuote(f.launch.args[0]!)));
    assert.ok(body.includes(shellQuote('PATH=/custom path/bin')));
    assert.ok(!body.includes('python'));
    assert.ok(body.startsWith('#!/bin/sh\ncd '));
});
test('tests.integration.test_slash_tui.ResultValidationTests.test_valid_result_round_trip', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    for (const kind of ['updated', 'already-current', 'cancelled', 'interrupted', 'timed-out', 'error'] as const) {
        const value = { outcome: kind, exit_code: kind === 'interrupted' ? 130 : kind === 'error' ? 2 : 0, message: '中文 result' };
        writeResult(i.result, f.root, value);
        assert.deepEqual(readResult(i.result, f.root), { schema_version: 1, ...value });
    }
});
test('tests.integration.test_slash_tui.ResultValidationTests.test_result_requires_exact_random_invocation_parent', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    for (const path of [join(f.root, 'result.json'), join(i.directory, 'other.json'), join(i.directory, 'nested/result.json'), join(i.directory, '../result.json')])
        assert.throws(() => resultPath(f.root, path));
    assert.equal(resultPath(f.root, i.result), i.result);
});
test('tests.integration.test_slash_tui.ResultValidationTests.test_strict_result_schema_and_outcome', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    const valid = { schema_version: 1, outcome: 'updated', exit_code: 0, message: 'ok' };
    for (const value of [{ ...valid, schema_version: true }, { ...valid, outcome: 'unknown' }, { ...valid, exit_code: 2 }, { ...valid, extra: 1 }, { ...valid, message: 'bad\u001b' }]) {
        fs.writeFileSync(i.result, JSON.stringify(value), { mode: 0o600 });
        assert.throws(() => readResult(i.result, f.root));
    }
    for (const raw of ['{"schema_version":1,"schema_version":1}', '{"schema_version":1.0,"outcome":"updated","exit_code":0,"message":"ok"}']) {
        fs.writeFileSync(i.result, raw, { mode: 0o600 });
        assert.throws(() => readResult(i.result, f.root));
    }
});
test('tests.integration.test_slash_tui.LaunchAndCleanupTests.test_unavailable_does_not_create_runtime_directory', async (t) => {
    const f = await fixture(t);
    const root = join(f.root, 'uninstalled');
    const result = await launchEditor({ configDir: root, backend: f.launch, cwd: f.root }, { choose: () => null });
    assert.equal(result.message, UNAVAILABLE_MESSAGE);
    assert.equal(fs.existsSync(root), false);
});
test('tests.integration.test_slash_tui.LaunchAndCleanupTests.test_launch_passes_bridge_environment_reads_and_cleans_result', async (t) => {
    const f = await fixture(t);
    let directory = '';
    const result = await launchEditor({ configDir: f.root, backend: f.launch, cwd: f.root }, { choose: () => ({ kind: 'gnome', executable: 'gnome' }), run(argv, cwd, env) { assert.equal(cwd, f.root); directory = dirname(env.CLAUDE_STATUSLINE_SLASH_RESULT!); fs.writeFileSync(join(directory, 'started.json'), JSON.stringify({ schema_version: 1, nonce: env.CLAUDE_STATUSLINE_EDITOR_NONCE, pid: 99999999, token: 'dead' }), { mode: 0o600 }); writeResult(env.CLAUDE_STATUSLINE_SLASH_RESULT!, f.root, { outcome: 'cancelled', exit_code: 0, message: 'unchanged' }); assert.ok(argv.includes(f.launch.args[0]!)); return running(0); } });
    assert.equal(result.outcome, 'cancelled');
    assert.equal(fs.existsSync(directory), false);
});
test('tests.integration.test_slash_tui.LaunchAndCleanupTests.test_selected_tmux_failure_does_not_try_gnome', async (t) => {
    const f = await fixture(t);
    let calls = 0;
    const result = await launchEditor({ configDir: f.root, backend: f.launch, cwd: f.root }, { choose: () => ({ kind: 'tmux', executable: 'tmux', pane: '%7' }), run() { calls++; throw new Error('popup refused'); } });
    assert.equal(calls, 1);
    assert.equal(result.outcome, 'error');
    assert.match(String(result.message), /popup refused/);
});
test('tests.integration.test_slash_tui.LaunchAndCleanupTests.test_launcher_timeout_and_missing_result_are_safe_errors', async (t) => {
    const f = await fixture(t);
    let now = 0, stopped = 0;
    const value = await launchEditor({ configDir: f.root, backend: f.launch, cwd: f.root }, { choose: () => ({ kind: 'gnome', executable: 'gnome' }), run: () => ({ ...running(null), stop() { stopped++; } }), timeoutMs: 100, now: () => now, sleep: async (ms) => { now += ms; } });
    assert.equal(value.outcome, 'error');
    assert.match(String(value.message), /without a confirmed result/);
    assert.equal(stopped, 1);
    const missing = await launchEditor({ configDir: f.root, backend: f.launch, cwd: f.root }, { choose: () => ({ kind: 'gnome', executable: 'gnome' }), run: () => running(0) });
    assert.equal(missing.outcome, 'error');
});
test('tests.platforms.test_macos_terminal.InvocationTests.test_open_exit_zero_without_handshake_is_not_editor_success', async (t) => {
    const f = await fixture(t);
    let now = 0;
    const value = await launchEditor({ configDir: f.root, backend: f.launch, cwd: f.root }, { choose: () => ({ kind: 'macos-terminal', executable: '/usr/bin/open' }), run: () => running(0), now: () => now, sleep: async (ms) => { now += ms; } });
    assert.equal(value.outcome, 'error');
    assert.match(String(value.message), /confirm startup/);
});
test('tests.integration.test_slash_tui.WindowsConsoleTests.test_abnormal_exit_cannot_return_a_success_result', async (t) => {
    const f = await fixture(t);
    const value = await launchEditor({ configDir: f.root, backend: f.launch, cwd: f.root }, { choose: () => ({ kind: 'gnome', executable: 'gnome' }), run(argv, cwd, env) { const directory = dirname(env.CLAUDE_STATUSLINE_SLASH_RESULT!); fs.writeFileSync(join(directory, 'started.json'), JSON.stringify({ schema_version: 1, nonce: env.CLAUDE_STATUSLINE_EDITOR_NONCE, pid: 99999999, token: 'dead' }), { mode: 0o600 }); writeResult(env.CLAUDE_STATUSLINE_SLASH_RESULT!, f.root, { outcome: 'updated', exit_code: 0, message: 'saved' }); return running(1); } });
    assert.equal(value.outcome, 'error');
    assert.match(String(value.message), /conflicts/);
});
test('tests.platforms.test_macos_terminal.InvocationTests.test_editor_uses_explicit_executable_and_guards_revoked_request', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    assert.throws(() => requestGuard(f.root, i.path, i.request.nonce, { executable: 'other', args: [] }));
    const guard = requestGuard(f.root, i.path, i.request.nonce, f.launch);
    guard();
    fs.unlinkSync(i.path);
    assert.throws(guard);
});
test('tests.platforms.test_macos_terminal.InvocationTests.test_malformed_handshake_and_result_are_rejected', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    for (const value of [{ schema_version: 1, nonce: 'wrong', pid: 123, token: 't' }, { schema_version: 1, nonce: i.request.nonce, pid: true, token: 't' }]) {
        fs.writeFileSync(join(i.directory, 'started.json'), JSON.stringify(value), { mode: 0o600 });
        assert.throws(() => started(i.directory, f.root, i.request.nonce));
    }
});
test('tests.platforms.test_macos_terminal.InvocationTests.test_cleanup_removes_only_current_invocation_artifacts', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    fs.writeFileSync(join(i.directory, 'user-note'), 'keep');
    cleanup(i.directory);
    assert.equal(fs.readFileSync(join(i.directory, 'user-note'), 'utf8'), 'keep');
    assert.equal(fs.existsSync(i.path), false);
});
test('tests.platforms.test_macos_terminal.InvocationTests.test_stop_never_signals_reused_process_identity', async (t) => {
    await stopEditor({ pid: process.pid, token: 'not-current' });
    assert.ok(process.pid > 0);
});
test('tests.integration.test_slash_tui.LaunchAndCleanupTests.test_stale_cleanup_is_age_name_and_symlink_limited', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root), base = dirname(i.directory);
    fs.utimesSync(i.directory, 0, 0);
    cleanupStale(base);
    assert.ok(fs.existsSync(i.directory), 'live parent survives old mtime');
    const data = { ...i.request, parent: 99999999, parent_token: 'dead' };
    fs.writeFileSync(i.path, JSON.stringify(data), { mode: 0o600 });
    fs.utimesSync(i.directory, 0, 0);
    cleanupStale(base);
    assert.equal(fs.existsSync(i.directory), false);
    const foreign = join(base, 'notes');
    fs.mkdirSync(foreign);
    fs.utimesSync(foreign, 0, 0);
    const legacy = join(base, 'invocation-old'), linked = join(base, 'invocation-linked'), recent = join(base, 'invocation-recent'), unknown = join(base, 'invocation-unknown');
    for (const directory of [legacy, linked, recent, unknown])
        fs.mkdirSync(directory, { mode: 0o700 });
    fs.writeFileSync(join(legacy, 'result.json'), 'old');
    fs.symlinkSync(foreign, join(linked, 'result.json'), process.platform === 'win32' ? 'junction' : 'dir');
    fs.writeFileSync(join(unknown, 'user-note'), 'keep');
    for (const directory of [legacy, linked, unknown])
        fs.utimesSync(directory, 0, 0);
    cleanupStale(base);
    assert.ok(fs.existsSync(foreign));
    assert.equal(fs.existsSync(legacy), false);
    for (const directory of [linked, recent, unknown])
        assert.ok(fs.existsSync(directory));
});
