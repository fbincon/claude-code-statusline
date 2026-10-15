import test from 'node:test';
import { EventEmitter } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { fixture, assert, fs, join, Session } from './support.js';
import { terminal } from '@fbincon/statusline-platform/terminal/session';
import { prepare, cleanup, resultPath, readResult, requestGuard } from '@fbincon/statusline-platform/terminal/bridge';
import { bridgeEnvironment } from '@fbincon/statusline-platform/terminal/launchers';
import { stopEditor } from '@fbincon/statusline-cli/integration/launcher';
import { processToken } from '@fbincon/statusline-platform/processes';
import { terminalColor } from '@fbincon/statusline-core/rendering/colors';
import { openPty } from './pty.js';
test('tests.integration.test_cli.CliTests.test_configure_rejects_non_tty_without_traceback_or_changes', async (t) => {
    const f = await fixture(t), directory = join(f.root, 'fresh');
    const result = spawnSync(process.execPath, [...f.launch.args, 'configure', '--config-dir', directory], { encoding: 'utf8', timeout: 10000, input: '' });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /terminal/);
    assert.ok(!result.stderr.includes('Traceback'));
    assert.equal(fs.existsSync(directory), false);
});
test('tests.ui.test_interactive_config.SaveAndRunTests.test_non_tty_and_uninstalled_are_rejected', async (t) => {
    const f = await fixture(t);
    fs.writeFileSync(f.settingsPath, '{}');
    await assert.rejects(Session.open(f.backend), (error: any) => error.code === 'not_installed');
    assert.equal(fs.existsSync(f.displayPath), false);
});
test('tests.integration.test_cli.CliTests.test_configure_reports_missing_curses_without_traceback', { skip: process.platform === 'win32' ? 'POSIX dependency-free PTY evidence' : false }, async (t) => {
    // D04 retires curses. A real editor works with no Python/curses executable on PATH.
    const f = await fixture(t), p = openPty(f.root, 80, 24, { PATH: '' });
    try {
        await p.wait(value => value.includes('Preview (sample data)'));
        p.send('\x1b');
        await p.exited();
        assert.equal(p.child.exitCode, 0);
        assert.ok(!p.captured().toString().includes('curses'));
    }
    finally {
        await p.close();
    }
});
test('tests.ui.test_interactive_config.SaveAndRunTests.test_bridge_path_rejects_escape_and_reparse_chain', async (t) => {
    const f = await fixture(t), invocation = prepare(f.root, f.launch, f.root), moved = invocation.directory + '-original';
    t.after(() => cleanup(invocation.directory));
    assert.throws(() => resultPath(f.root, invocation.directory + '/../' + invocation.directory.split(/[\\/]/u).at(-1) + '/result.json'));
    fs.renameSync(invocation.directory, moved);
    fs.symlinkSync(moved, invocation.directory, 'junction');
    try {
        assert.throws(() => resultPath(f.root, invocation.result), /Invalid/);
    }
    finally {
        fs.unlinkSync(invocation.directory);
        fs.renameSync(moved, invocation.directory);
    }
});
test('tests.integration.test_slash_tui.ResultValidationTests.test_missing_oversized_symlink_and_non_regular_results_fail', async (t) => {
    const f = await fixture(t), i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    assert.throws(() => readResult(i.result, f.root));
    fs.writeFileSync(i.result, 'x'.repeat(16 * 1024 + 1), { mode: 0o600 });
    assert.throws(() => readResult(i.result, f.root), /oversized/);
    fs.unlinkSync(i.result);
    fs.mkdirSync(i.result);
    assert.throws(() => readResult(i.result, f.root), /Invalid/);
    fs.rmdirSync(i.result);
    if (process.platform !== 'win32') {
        fs.symlinkSync(f.settingsPath, i.result);
        assert.throws(() => readResult(i.result, f.root), /Invalid/);
        fs.unlinkSync(i.result);
    }
    else
        t.diagnostic('File symlink branch is covered on POSIX; Windows directory reparses have a separate assertion.');
});
test('tests.platforms.test_macos_terminal.InvocationTests.test_editor_rejects_non_tty_and_expired_request', async (t) => {
    const f = await fixture(t), expired = prepare(f.root, f.launch, f.root, Date.now() - 40000);
    t.after(() => cleanup(expired.directory));
    assert.throws(() => requestGuard(f.root, expired.path, expired.request.nonce, f.launch), /Expired/);
    const i = prepare(f.root, f.launch, f.root);
    t.after(() => cleanup(i.directory));
    const result = spawnSync(process.execPath, [...f.launch.args, 'configure', '--config-dir', f.root], { encoding: 'utf8', timeout: 10000, env: bridgeEnvironment(i.request, i.directory, process.env), input: '' });
    assert.equal(result.status, 2);
    assert.equal(fs.existsSync(join(i.directory, 'started.json')), false);
    assert.equal(readResult(i.result, f.root).outcome, 'error');
});
test('tests.platforms.test_macos_terminal.InvocationTests.test_stop_terminates_only_verified_editor_and_escalates', { skip: process.platform === 'win32' ? 'POSIX signals; Windows uses native process handles' : false, timeout: 10000 }, async () => {
    const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{}); process.stdout.write("ready"); setInterval(()=>{},1000)'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
    try {
        await new Promise<void>((resolve, reject) => { child.stdout.once('data', () => resolve()); child.once('error', reject); });
        const token = processToken(child.pid!)!;
        assert.ok(token);
        await stopEditor({ pid: child.pid!, token: 'wrong' });
        assert.equal(child.exitCode, null);
        await stopEditor({ pid: child.pid!, token });
        await exited;
        assert.equal(child.signalCode, 'SIGKILL');
    }
    finally {
        if (child.exitCode === null && child.signalCode === null)
            child.kill('SIGKILL');
        await exited;
    }
});
test('tests.ui.test_interactive_config.TerminalColorTests.test_rgb_quantizes_for_256_basic_and_no_color_terminals', () => {
    assert.equal(terminalColor(['rgb', '#ff0000'], 0), null);
    assert.equal(terminalColor(['rgb', '#ff0000'], 8), 1);
    assert.equal(terminalColor(['rgb', '#ff0000'], 16), 9);
    assert.equal(terminalColor(['rgb', '#ff0000'], 256), 9);
    assert.equal(terminalColor(['ansi', 12], 8), 4);
    assert.equal(terminalColor(null, 256), null);
});
function streams() {
    const input = Object.assign(new EventEmitter(), { isTTY: true, isRaw: false, readableFlowing: false, setRawMode(value: boolean) { this.isRaw = value; }, resume() { this.readableFlowing = true; }, pause() { this.readableFlowing = false; } });
    const writes: string[] = [];
    const output = Object.assign(new EventEmitter(), { isTTY: true, columns: 80, rows: 24, write(value: string): boolean { writes.push(value); return true; } });
    return { input, output, writes, options: { input: input as any, output: output as any, term: 'xterm-256color' } };
}
test('tests.ui.test_interactive_config.TerminalColorTests.test_signal_registration_uses_only_available_platform_signals', async () => {
    const f = streams(), signals = process.platform === 'win32' ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const : ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
    const before = signals.map(signal => process.listenerCount(signal));
    const result = terminal({ draw: () => 'frame', key: key => key.key === 'escape' ? 'cancel' : null, interrupted: () => 'signal', timeout: () => 'timeout' }, f.options);
    signals.forEach((signal, i) => assert.equal(process.listenerCount(signal), before[i]! + 1));
    f.input.emit('data', Buffer.from('\x1b'));
    assert.equal(await result, 'cancel');
    signals.forEach((signal, i) => assert.equal(process.listenerCount(signal), before[i]));
    assert.equal(f.input.isRaw, false);
});
test('terminal output backpressure bounds frames and startup failures remove all handlers', async () => {
    const f = streams();
    let frames = 0;
    f.output.write = value => { f.writes.push(value); return value !== 'frame'; };
    const result = terminal({ draw: () => { frames++; return 'frame'; }, key: key => key.key === 'escape' ? 'cancel' : null, interrupted: () => 'signal', timeout: () => 'timeout' }, f.options);
    f.input.emit('data', Buffer.from('x'));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(frames, 1);
    f.output.emit('drain');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(frames, 2);
    f.input.emit('data', Buffer.from('\x1b'));
    f.output.emit('drain');
    assert.equal(await result, 'cancel');
    assert.equal(f.output.listenerCount('drain'), 0);
    const failed = streams();
    await assert.rejects(terminal({ draw() { throw new Error('draw failed'); }, key: () => null, interrupted: () => 'signal', timeout: () => 'timeout' }, failed.options), /draw failed/);
    assert.equal(failed.input.isRaw, false);
    assert.equal(failed.input.listenerCount('data'), 0);
    assert.equal(failed.output.listenerCount('resize'), 0);
});
