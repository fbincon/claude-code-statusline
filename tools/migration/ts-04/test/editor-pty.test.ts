import test from 'node:test';
import { fixture, assert, fs, join } from './support.js';
import { openPty } from './pty.js';
const posix = { skip: process.platform === 'win32' ? 'POSIX PTY; Windows uses separate console acceptance' : false, timeout: 15000 };
for (const [width, height] of [[64, 18], [64, 19], [64, 20], [80, 24], [120, 30], [80, 48]])
    test(`real external TS editor save and full terminal restoration at ${width}x${height}`, posix, async (t) => {
        const f = await fixture(t), pty = openPty(f.root, width, height);
        try {
            await pty.wait(output => output.includes('Configure Status Line'));
            pty.send(' \x13');
            await pty.exited();
            assert.equal(pty.child.exitCode, 0);
            assert.ok(fs.existsSync(f.displayPath));
            assert.equal(JSON.parse(fs.readFileSync(f.displayPath, 'utf8')).instances[0].enabled, false);
            assert.deepEqual(pty.attributes(), pty.before);
            assert.ok(pty.captured().includes(Buffer.from('\x1b[?1049l')));
            assert.ok(pty.captured().toString().includes('Status line configuration updated.'));
        }
        finally {
            await pty.close();
        }
    });
test('real external TS editor cancel, Unicode input and resize preserve configuration bytes', posix, async (t) => {
    const f = await fixture(t), bytes = f.bytes(), pty = openPty(f.root);
    try {
        await pty.wait(output => output.includes('Configure Status Line'));
        pty.send('/中文 é 👩🏽‍💻');
        await pty.wait(output => output.includes('中文'));
        pty.resize(32, 12);
        await pty.wait(output => output.includes('Terminal too small'));
        pty.resize(120, 30);
        await pty.wait(output => output.includes('\x1b[30;1H'));
        pty.send('\x07\x1b');
        await pty.exited();
        assert.equal(pty.child.exitCode, 0);
        assert.deepEqual(f.bytes(), bytes);
        assert.deepEqual(pty.attributes(), pty.before);
    }
    finally {
        await pty.close();
    }
});
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]] as const)
    test(`external TS editor restores terminal after ${signal}`, posix, async (t) => {
        const f = await fixture(t), bytes = f.bytes(), pty = openPty(f.root);
        try {
            await pty.wait(output => output.includes('Configure Status Line'));
            pty.child.kill(signal);
            await pty.exited();
            assert.equal(pty.child.exitCode, code);
            assert.deepEqual(f.bytes(), bytes);
            assert.deepEqual(pty.attributes(), pty.before);
        }
        finally {
            await pty.close();
        }
    });
test('bridge timeout returns a bounded result without summary or configuration writes', posix, async (t) => {
    const f = await fixture(t), bytes = f.bytes(), directory = join(f.root, 'statusline_runtime/slash_tui/invocation-test');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const result = join(directory, 'result.json'), pty = openPty(f.root, 80, 24, { CLAUDE_STATUSLINE_SLASH_RESULT: result, CLAUDE_STATUSLINE_SLASH_DEADLINE_SECONDS: '0.2' });
    try {
        await pty.exited();
        assert.equal(pty.child.exitCode, 0);
        assert.equal(JSON.parse(fs.readFileSync(result, 'utf8')).outcome, 'timed-out');
        assert.deepEqual(f.bytes(), bytes);
        assert.deepEqual(pty.attributes(), pty.before);
    }
    finally {
        await pty.close();
    }
});
