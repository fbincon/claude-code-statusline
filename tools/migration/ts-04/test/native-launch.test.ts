import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, assert, fs, join } from './support.js';
import { startWindows, shellQuote } from '@fbincon/statusline-platform/terminal/launchers';
import { launchEditor } from '@fbincon/statusline-cli/integration/launcher';
import { which } from '@fbincon/statusline-platform/commands';
import { openPty } from './pty.js';
const helper = fileURLToPath(new URL('./console-child.js', import.meta.url));
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const windows = { skip: process.platform !== 'win32' ? 'Native Windows console' : false, timeout: 15000 };
test('tests.integration.test_slash_tui.WindowsConsoleTests.test_popen_uses_new_console_real_cwd_and_no_redirection', windows, async (t) => {
    const f = await fixture(t), receipt = join(f.root, 'console.json');
    const child = startWindows([process.execPath, helper, 'once', receipt, '中文 & $` spaces'], f.root, process.env);
    try {
        const deadline = performance.now() + 8000;
        while (child.code() === null && performance.now() < deadline)
            await pause(20);
        assert.equal(child.code(), 0);
        assert.deepEqual(JSON.parse(fs.readFileSync(receipt, 'utf8')), { input_tty: true, output_tty: true, cwd: f.root, argv: ['中文 & $` spaces'] });
    }
    finally {
        child.close();
    }
});
test('tests.integration.test_slash_tui.WindowsConsoleTests.test_timeout_terminates_and_reaps_windows_child', windows, async (t) => {
    const f = await fixture(t), receipt = join(f.root, 'held-console.json');
    const child = startWindows([process.execPath, helper, 'hold', receipt], f.root, process.env);
    try {
        const deadline = performance.now() + 8000;
        while (!fs.existsSync(receipt) && performance.now() < deadline)
            await pause(20);
        assert.ok(fs.existsSync(receipt));
        assert.equal(child.code(), null);
        child.stop();
        assert.equal(child.code(), 1);
    }
    finally {
        child.close();
    }
});
test('tests.integration.test_tmux_popup.TmuxPopupIntegrationTests.test_popup_cancel_isolated_from_underlying_pane_and_cleans_up', {
    skip: process.platform === 'win32' || !which('tmux') ? 'POSIX tmux popup requires tmux' : false, timeout: 15000,
}, async (t) => {
    const f = await fixture(t), socket = join(f.root, 'tmux.sock'), tmux = which('tmux')!, underlay = join(f.root, 'underlay-input');
    const run = (...args: string[]) => spawnSync(tmux, ['-S', socket, ...args], { encoding: 'utf8', timeout: 5000, env: { ...process.env, TERM: 'xterm-256color' } });
    const program = 'const fs=require("node:fs");process.stdout.write("UNDERLAY_READY");process.stdin.once("data",data=>{fs.writeFileSync(process.argv[1],data);process.exit(0);});';
    const created = run('-f', '/dev/null', 'new-session', '-d', '-s', 'ts04', '-x', '100', '-y', '30', [process.execPath, '-e', program, underlay].map(shellQuote).join(' '));
    assert.equal(created.status, 0, created.stderr);
    run('set-option', 'status', 'off');
    const client = openPty(f.root, 100, 30, { PATH: process.env.PATH }, 'en', { executable: process.execPath, args: [helper, 'tmux', tmux, '-S', socket, 'attach-session', '-t', 'ts04'] });
    try {
        await client.wait(value => value.includes('UNDERLAY_READY'));
        const pane = run('display-message', '-p', '-t', 'ts04', '#{pane_id}').stdout.trim();
        const server = run('display-message', '-p', '-t', 'ts04', '#{socket_path},#{pid},0').stdout.trim();
        const before = f.bytes();
        const result = launchEditor({ configDir: f.root, backend: f.launch, cwd: f.root }, { env: { ...process.env, TMUX: server, TMUX_PANE: pane }, timeoutMs: 10000 });
        await client.wait(value => value.includes('Preview (sample data)'), 8000);
        client.send('\x1b');
        // Keep consuming the real terminal while the popup and launcher exit.
        let completed = false;
        result.finally(() => { completed = true; });
        while (!completed) {
            client.captured();
            await pause(20);
        }
        assert.equal((await result).outcome, 'cancelled');
        assert.deepEqual(f.bytes(), before);
        assert.equal(fs.existsSync(underlay), false);
        assert.deepEqual(fs.readdirSync(join(f.root, 'statusline_runtime/slash_tui')), []);
        client.send('after\n');
        await client.exited();
        assert.equal(fs.readFileSync(underlay, 'utf8').trim(), 'after');
    }
    finally {
        run('kill-server');
        await client.close();
    }
});
