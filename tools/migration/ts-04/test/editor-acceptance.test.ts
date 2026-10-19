import test from 'node:test';
import { spawn } from 'node:child_process';
import { fixture, assert, fs, join } from './support.js';
import { openPty } from './pty.js';
import { prepare, cleanup, readResult } from '@fbincon/statusline-platform/terminal/bridge';
import { bridgeEnvironment } from '@fbincon/statusline-platform/terminal/launchers';
import { lock } from '@fbincon/statusline-platform/files';
import { processToken } from '@fbincon/statusline-platform/processes';
const posix = { skip: process.platform === 'win32' ? 'POSIX PTY; Windows has separate console acceptance' : false, timeout: 15000 };
const ready = (p: ReturnType<typeof openPty>) => p.wait(o => o.includes('Preview (sample data)'));
function bridge(f: {
    root: string;
}) { const base = join(f.root, 'statusline_runtime/slash_tui'); fs.mkdirSync(base, { recursive: true, mode: 0o700 }); const directory = fs.mkdtempSync(join(base, 'invocation-')); const path = join(directory, 'result.json'); return { path, env: { CLAUDE_STATUSLINE_SLASH_RESULT: path, CLAUDE_STATUSLINE_SLASH_DEADLINE_SECONDS: '570' } }; }
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_escape_leaves_both_files_byte_identical', posix, async (t) => {
    const f = await fixture(t);
    await f.session.save();
    const before = f.bytes(), p = openPty(f.root);
    try {
        await ready(p);
        p.send(' \x1b');
        await p.exited();
        assert.equal(p.child.exitCode, 0);
        assert.deepEqual(f.bytes(), before);
        assert.deepEqual(p.attributes(), p.before);
    }
    finally {
        await p.close();
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_first_save_migrates_built_in_defaults_to_schema_two', posix, async (t) => {
    const f = await fixture(t), p = openPty(f.root);
    try {
        await ready(p);
        p.send('\x13');
        await p.exited();
        assert.equal(p.child.exitCode, 0);
        assert.equal(JSON.parse(fs.readFileSync(f.displayPath, 'utf8')).schema_version, 8);
        assert.equal(fs.readdirSync(join(f.root, 'backups/statusline')).length, 1);
    }
    finally {
        await p.close();
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_toggle_move_settings_numeric_edit_and_save', posix, async (t) => {
    const f = await fixture(t);
    f.e.page = 'settings';
    const down = f.state.rows().findIndex(r => r.key === 'padding');
    const p = openPty(f.root);
    try {
        await ready(p);
        p.send(' \x1b[C\t\t' + '\x1b[B'.repeat(down) + '3\r\x13');
        await p.exited();
        assert.equal(p.child.exitCode, 0);
        const settings = JSON.parse(fs.readFileSync(f.settingsPath, 'utf8'));
        assert.equal(settings.statusLine.padding, 3);
        const display = JSON.parse(fs.readFileSync(f.displayPath, 'utf8'));
        assert.equal(display.instances.find((i: any) => i.id === 'model-with-effort').enabled, false);
    }
    finally {
        await p.close();
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_too_small_resize_recovers_and_can_cancel', posix, async (t) => {
    const f = await fixture(t), before = f.bytes(), p = openPty(f.root, 32, 12);
    try {
        await p.wait(o => o.includes('Terminal too small') && o.includes('\x1b[12;1H'));
        // A resize may overtake unread input. Observe each disabled key being
        // processed at the small size before changing the PTY dimensions.
        for (const key of [' ', '\x13']) {
            const start = p.captured().toString('utf8').length;
            p.send(key);
            await p.wait(output => {
                const fresh = output.slice(start);
                return fresh.includes('\x1b[H') && fresh.includes('\x1b[12;1H') &&
                    fresh.includes('Terminal too small');
            });
            assert.deepEqual(f.bytes(), before);
        }
        p.resize(80, 24);
        await ready(p);
        p.send('\x1b');
        await p.exited();
        assert.equal(p.child.exitCode, 0);
        assert.deepEqual(f.bytes(), before);
        assert.deepEqual(p.attributes(), p.before);
    }
    finally {
        await p.close();
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_signals_restore_terminal_and_use_standard_exit_codes', posix, async (t) => {
    const f = await fixture(t), before = f.bytes();
    for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]] as const) {
        const p = openPty(f.root);
        try {
            await ready(p);
            p.child.kill(signal);
            await p.exited();
            assert.equal(p.child.exitCode, code);
            assert.deepEqual(p.attributes(), p.before);
            assert.deepEqual(f.bytes(), before);
        }
        finally {
            await p.close();
        }
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_bridge_save_current_and_cancel_write_results_without_summary', posix, async (t) => {
    const f = await fixture(t);
    for (const [keys, expected] of [['\x13', 'updated'], ['\x13', 'already-current'], ['\x1b', 'cancelled']]) {
        const b = bridge(f), p = openPty(f.root, 80, 24, b.env);
        try {
            await ready(p);
            p.send(keys!);
            await p.exited();
            assert.equal(p.child.exitCode, 0);
            assert.equal(readResult(b.path, f.root).outcome, expected);
            const output = p.captured().toString();
            assert.ok(output.endsWith('\x1b[?1049l'));
        }
        finally {
            await p.close();
        }
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_bridge_ctrl_c_and_signals_write_interrupted_results', posix, async (t) => {
    const f = await fixture(t);
    for (const signal of [null, 'SIGTERM', 'SIGHUP'] as const) {
        const b = bridge(f), p = openPty(f.root, 80, 24, b.env);
        try {
            await ready(p);
            if (signal)
                p.child.kill(signal);
            else
                p.send('\x03');
            await p.exited();
            const result = readResult(b.path, f.root);
            assert.equal(result.outcome, 'interrupted');
            assert.equal(result.exit_code, signal === 'SIGTERM' ? 143 : signal === 'SIGHUP' ? 129 : 130);
            assert.deepEqual(p.attributes(), p.before);
        }
        finally {
            await p.close();
        }
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_bridge_short_deadline_times_out_without_writes', posix, async (t) => {
    const f = await fixture(t), before = f.bytes(), b = bridge(f), p = openPty(f.root, 80, 24, { ...b.env, CLAUDE_STATUSLINE_SLASH_DEADLINE_SECONDS: '0.15' });
    try {
        await p.exited();
        assert.equal(readResult(b.path, f.root).outcome, 'timed-out');
        assert.deepEqual(f.bytes(), before);
        assert.deepEqual(p.attributes(), p.before);
    }
    finally {
        await p.close();
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_bridge_editor_error_writes_error_result_without_traceback', posix, async (t) => {
    const f = await fixture(t), b = bridge(f);
    fs.writeFileSync(f.displayPath, '{broken');
    const before = f.bytes(), p = openPty(f.root, 80, 24, b.env);
    try {
        await p.exited();
        assert.equal(p.child.exitCode, 2);
        assert.equal(readResult(b.path, f.root).outcome, 'error');
        assert.deepEqual(f.bytes(), before);
        assert.ok(!p.captured().toString().includes('Traceback'));
    }
    finally {
        await p.close();
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_uninstalled_invalid_config_and_terminal_failure_are_clean_errors', posix, async (t) => {
    for (const kind of ['uninstalled', 'invalid', 'terminal']) {
        const f = await fixture(t);
        if (kind === 'uninstalled')
            fs.writeFileSync(f.settingsPath, '{}');
        if (kind === 'invalid')
            fs.writeFileSync(f.displayPath, '{broken');
        const before = f.bytes(), p = openPty(f.root, 80, 24, kind === 'terminal' ? { TERM: 'dumb' } : {});
        try {
            await p.exited();
            assert.equal(p.child.exitCode, 2);
            assert.deepEqual(f.bytes(), before);
            assert.ok(!p.captured().toString().includes('Traceback'));
            assert.deepEqual(p.attributes(), p.before);
        }
        finally {
            await p.close();
        }
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_terminal_command_cancel_uses_explicit_installation_with_different_path', posix, async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root), p = openPty(f.root, 80, 24, { ...bridgeEnvironment(i.request, i.directory, {}), PATH: '/unrelated/bin' });
    try {
        await ready(p);
        p.send('\x1b');
        await p.exited();
        assert.equal(p.child.exitCode, 0);
        assert.equal(readResult(i.result, f.root).outcome, 'cancelled');
        assert.ok(fs.existsSync(join(i.directory, 'started.json')));
    }
    finally {
        await p.close();
        cleanup(i.directory);
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_terminal_command_save_returns_result_and_commits_once', posix, async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root), p = openPty(f.root, 80, 24, bridgeEnvironment(i.request, i.directory, {}));
    try {
        await ready(p);
        p.send(' \r');
        await p.exited();
        assert.equal(p.child.exitCode, 0);
        assert.equal(readResult(i.result, f.root).outcome, 'updated');
        assert.equal(fs.readdirSync(join(f.root, 'backups/statusline')).length, 1);
    }
    finally {
        await p.close();
        cleanup(i.directory);
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_terminal_revoked_request_interrupts_editor_without_saving', posix, async (t) => {
    const f = await fixture(t), before = f.bytes(), i = prepare(f.root, f.launch, f.root), p = openPty(f.root, 80, 24, bridgeEnvironment(i.request, i.directory, {}));
    try {
        await ready(p);
        p.send(' ');
        fs.unlinkSync(i.path);
        await p.exited();
        assert.equal(p.child.exitCode, 130);
        assert.deepEqual(f.bytes(), before);
        assert.equal(fs.existsSync(i.result), false);
        assert.deepEqual(p.attributes(), p.before);
    }
    finally {
        await p.close();
        cleanup(i.directory);
    }
});
test('tests.integration.test_cli_tui.ConfigurePtyTests.test_terminal_parent_exit_interrupts_editor_without_saving', posix, async (t) => {
    const f = await fixture(t), before = f.bytes(), i = prepare(f.root, f.launch, f.root);
    const parent = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
    await new Promise<void>(resolve => parent.once('spawn', resolve));
    i.request.parent = parent.pid!;
    i.request.parent_token = processToken(parent.pid!)!;
    fs.writeFileSync(i.path, JSON.stringify(i.request), { mode: 0o600 });
    const p = openPty(f.root, 80, 24, bridgeEnvironment(i.request, i.directory, {}));
    try {
        await ready(p);
        parent.kill('SIGTERM');
        await p.exited();
        assert.equal(p.child.exitCode, 130);
        assert.deepEqual(f.bytes(), before);
        assert.equal(fs.existsSync(i.result), false);
    }
    finally {
        parent.kill('SIGKILL');
        await p.close();
        cleanup(i.directory);
    }
});
test('tests.platforms.test_macos_terminal.CommitGuardTests.test_parent_ending_after_ui_save_prevents_transaction_under_lock', posix, async (t) => {
    const f = await fixture(t), before = f.bytes(), i = prepare(f.root, f.launch, f.root), p = openPty(f.root, 80, 24, bridgeEnvironment(i.request, i.directory, {}));
    let release: (() => void) | undefined;
    try {
        await ready(p);
        release = lock(join(f.root, 'statusline_runtime/install.lock'));
        p.send(' \x13');
        // Save now keeps the screen open until commit succeeds. The held lock
        // prevents publication while the parent invocation is revoked.
        await new Promise(r => setTimeout(r, 50));
        fs.unlinkSync(i.path);
        release();
        release = undefined;
        await p.exited();
        assert.equal(p.child.exitCode, 130);
        assert.deepEqual(f.bytes(), before);
    }
    finally {
        release?.();
        await p.close();
        cleanup(i.directory);
    }
});
test('tests.ui.test_interactive_config.SaveAndRunTests.test_bridge_write_failure_happens_after_completed_editor_outcome', posix, async (t) => {
    const f = await fixture(t), b = bridge(f), p = openPty(f.root, 80, 24, b.env);
    try {
        await ready(p);
        fs.mkdirSync(b.path);
        p.send(' \x13');
        await p.exited();
        assert.equal(p.child.exitCode, 2);
        assert.ok(fs.existsSync(f.displayPath));
        assert.equal(JSON.parse(fs.readFileSync(f.displayPath, 'utf8')).instances[0].enabled, false);
        assert.deepEqual(p.attributes(), p.before);
    }
    finally {
        await p.close();
    }
});
test('tests.ui.test_interactive_config.TerminalColorTests.test_idle_input_polls_for_signals_without_repainting_the_vt_frame', posix, async (t) => {
    const f = await fixture(t), p = openPty(f.root);
    try {
        await ready(p);
        await p.wait(o => o.includes('\x1b[24;1H'));
        await new Promise(r => setTimeout(r, 50));
        const before = p.captured().length;
        await new Promise(r => setTimeout(r, 320));
        assert.equal(p.captured().length, before);
        p.child.kill('SIGTERM');
        await p.exited();
        assert.equal(p.child.exitCode, 143);
    }
    finally {
        await p.close();
    }
});
test('tests.ui.test_interactive_config.TerminalColorTests.test_resize_key_refreshes_pdcurses_dimensions', posix, async (t) => {
    const f = await fixture(t), p = openPty(f.root);
    try {
        await ready(p);
        p.resize(120, 30);
        await p.wait(o => o.includes('\x1b[30;1H'));
        p.send('\x1b');
        await p.exited();
        assert.equal(p.child.exitCode, 0);
        assert.deepEqual(p.attributes(), p.before);
    }
    finally {
        await p.close();
    }
});
test('tests.ui.test_terminal.TerminalTests.test_non_ansi_cursor_capabilities_do_not_enable_vt_painting', posix, async (t) => {
    const f = await fixture(t), p = openPty(f.root, 80, 24, { TERM: 'dumb' });
    try {
        await p.exited();
        assert.equal(p.child.exitCode, 2);
        assert.ok(!p.captured().toString().includes('\x1b[?1049h'));
        assert.ok(p.captured().toString().includes('ANSI/VT'));
        assert.deepEqual(p.attributes(), p.before);
    }
    finally {
        await p.close();
    }
});
