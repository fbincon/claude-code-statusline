import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import type { ReadStream, WriteStream } from 'node:tty';
import { terminal, type TerminalClient } from '../src/terminal/session.js';

type Submit = (apply: () => boolean) => void;
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
function streams() {
    const input = Object.assign(new PassThrough(), {
        isTTY: true, isRaw: false,
        setRawMode(value: boolean) { this.isRaw = value; return this; },
    });
    const output = Object.assign(new PassThrough(), { isTTY: true, columns: 80, rows: 24 });
    const chunks: string[] = [];
    output.on('data', chunk => chunks.push(String(chunk)));
    const options = { input: input as unknown as ReadStream, output: output as unknown as WriteStream, term: 'xterm' };
    return { input, output, options, chunks };
}

test('terminal observes initially, after each key and resize, and on idle ticks without drawing unchanged snapshots', async t => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const { input, output, options } = streams();
    const pages: string[] = [];
    let page = 'a', submit!: Submit, draws = 0, closes = 0;
    const finished = terminal({
        observe(next, columns, rows) { submit = next; pages.push(page + ':' + columns + 'x' + rows); },
        draw() { draws++; return 'frame'; },
        key(event) {
            if (event.key === 'q') return 'closed';
            if (event.key !== 'resize') page = event.key;
            return null;
        },
        interrupted: () => 'interrupted', timeout: () => 'timeout', closing() { closes++; },
    }, options);
    await turn();
    assert.equal(draws, 1);
    input.write('ba');
    await turn();
    assert.deepEqual(pages, ['a:80x24', 'b:80x24', 'a:80x24']);
    assert.equal(draws, 2);
    t.mock.timers.tick(250);
    assert.equal(pages.length, 4);
    submit(() => false);
    await turn();
    assert.equal(draws, 2);
    output.columns = 90;
    output.emit('resize');
    await turn();
    assert.equal(pages.at(-1), 'a:90x24');
    submit(() => true);
    await turn();
    assert.equal(draws, 4);
    input.write('q');
    assert.equal(await finished, 'closed');
    assert.equal(input.isRaw, false);
    assert.equal(closes, 1);
    submit(() => assert.fail('apply after closing'));
    t.mock.timers.tick(1000);
    await turn();
    assert.equal(draws, 4);
    assert.equal(pages.length, 5);
});

test('observations with identical visible ANSI bytes skip stdout while keys and resize still repaint', async () => {
    const { input, output, options, chunks } = streams();
    const plain = '\x1b[Hstatus', bold = '\x1b[H\x1b[1mstatus';
    let content = plain, consumers = 1, submit!: Submit;
    const frames = () => chunks.filter(chunk => chunk.startsWith('\x1b[H'));
    const finished = terminal({
        observe(next) { submit = next; }, draw: () => content,
        key(event) {
            if (event.key === 'q') return 0;
            if (event.key === 'p') content = plain;
            return null;
        },
        interrupted: () => 1, timeout: () => 2,
    }, options);
    await turn();
    submit(() => { consumers++; return true; });
    await turn();
    assert.equal(consumers, 2);
    assert.deepEqual(frames(), [plain]);
    submit(() => { content = bold; return true; });
    submit(() => true);
    await turn();
    assert.deepEqual(frames(), [plain, bold]);
    input.write('p');
    await turn();
    submit(() => true);
    await turn();
    output.emit('resize');
    await turn();
    assert.deepEqual(frames(), [plain, bold, plain, plain]);
    input.write('q');
    assert.equal(await finished, 0);
});

test('terminal leaves a key-responsive session while an observation waits and drops the late reply', async () => {
    const { input, options } = streams();
    let resolveRead!: () => void, observations = 0, applied = false, closed = false;
    const read = new Promise<void>(resolve => { resolveRead = resolve; });
    const finished = terminal({
        observe(submit) {
            if (observations++ === 0) void read.then(() => submit(() => { applied = true; return true; }));
        },
        closing() { closed = true; },
        draw: () => 'frame', key: key => key.key === 'q' ? 0 : null,
        interrupted: () => 1, timeout: () => 2,
    }, options);
    input.write('q');
    assert.equal(await finished, 0);
    assert(closed);
    resolveRead();
    await turn();
    assert.equal(applied, false);
});

test('queued publication honors terminal backpressure and the deadline before applying', async () => {
    const { input, options } = streams();
    let drain!: () => void, submit!: Submit, now = 0, applied = false, closes = 0;
    const writes: string[] = [];
    const output = Object.assign(new Writable({
        highWaterMark: 1,
        write(chunk, _encoding, done) {
            const value = String(chunk);
            writes.push(value);
            if (value === 'frame') drain = done;
            else done();
        },
    }), { isTTY: true, columns: 80, rows: 24 });
    const finished = terminal({
        observe(value) { submit = value; }, draw: () => 'frame', key: () => null,
        interrupted: () => 'interrupted', timeout: () => 'timeout', closing() { closes++; },
    }, { ...options, output: output as unknown as WriteStream, deadline: 20, now: () => now });
    await turn();
    submit(() => { applied = true; return true; });
    await turn();
    assert.equal(applied, false);
    now = 20;
    drain();
    assert.equal(await finished, 'timeout');
    assert.equal(applied, false);
    assert.equal(closes, 1);
    assert.equal(input.isRaw, false);
    assert(writes.at(-1)?.endsWith('\x1b[?1049l'));
});

test('terminal closes the observer on input end, revocation, and initialization failures', async () => {
    for (const exit of ['end', 'guard', 'tty']) {
        const { input, options } = streams();
        let closes = 0, revoked = false, submit!: Submit;
        const client: TerminalClient<number> = {
            observe(value) { submit = value; },
            guard() { if (revoked) throw new Error('revoked'); },
            closing() { closes++; },
            draw: () => 'frame', key: () => null, interrupted: () => 129, timeout: () => 0,
        };
        if (exit === 'tty') input.isTTY = false;
        const result = terminal(client, options);
        if (exit === 'end') {
            input.end();
            assert.equal(await result, 129);
        } else if (exit === 'guard') {
            revoked = true;
            submit(() => assert.fail('applied after revocation'));
            await assert.rejects(result, /revoked/);
        } else await assert.rejects(result, /TTY required/);
        assert.equal(closes, 1);
        assert.equal(input.isRaw, false);
    }
});
