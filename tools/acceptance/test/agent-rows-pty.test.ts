import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Capture } from '../../migration/ts-04/capture.js';
import { AGENTS, openProvider } from '../agent-rows/provider.js';
import { colouredLikeFixture, matchRows, visibleRows } from '../agent-rows/terminal.js';

test('the PTY oracle distinguishes a candidate body and its configured colour from host and foreign rows', () => {
    const screen = new Capture(100, 10), colour = '\x1b[1;38;2;20;175;210m';
    screen.feed('A notification mentioning 核验乙\r\n◯ ' + colour + 'General Purpose\x1b[0m · 核验甲\r\n');
    let rows = visibleRows(screen.buffer);
    assert.equal(rows[0]?.body, 'General Purpose · 核验甲');
    assert(!colouredLikeFixture(rows[0]?.style));
    assert(matchRows(rows, { appearance: 'custom', count: 1 }));
    assert(!matchRows(rows, { appearance: 'custom', count: 2 }));
    screen.feed('◯ general-purpose  核验乙\r\n');
    rows = visibleRows(screen.buffer);
    assert(!matchRows(rows, { appearance: 'custom', count: 2 }));
    assert(matchRows(rows.slice(1), { appearance: 'default', count: 1 }));
    assert(!matchRows([rows[0]!, rows[0]!], { appearance: 'custom', count: 2 }));
    screen.feed('◯ FOREIGN-ROW 核验乙');
    assert(matchRows(visibleRows(screen.buffer).slice(2), { appearance: 'foreign', count: 1 }));
});

test('the visual comparison measures background, bold and separate colours on wide graphemes', () => {
    const screen = new Capture(80, 4);
    screen.feed('◯ \x1b[1;38;2;20;175;210;48;2;49;42;112mGeneral Purpose\x1b[0m · ' +
        '\x1b[1;38;2;255;0;110m核\x1b[38;2;175;48;158m验\x1b[38;2;94;96;206m甲\x1b[0m');
    const style = visibleRows(screen.buffer)[0]!.style!;
    assert(colouredLikeFixture(style));
    assert(!colouredLikeFixture({ ...style, name: { ...style.name, bold: false } }));
    assert(!colouredLikeFixture({ ...style, task: [style.task[0]!, style.task[0]!, style.task[2]!] }));
});

test('the provider holds two independently identified streaming requests and counts auxiliary requests separately', async () => {
    const provider = await openProvider();
    const request = (prompt: string, stream: boolean) => fetch(provider.url + '/v1/messages', { method: 'POST',
        body: JSON.stringify({ model: 'synthetic', messages: [{ role: 'user', content: prompt }], stream }) });
    try {
        const auxiliary = await request('other', false);
        assert.equal((await auxiliary.json()).content[0].text, 'OK');
        const responses = await Promise.all(AGENTS.map(agent => request(agent.prompt, true)));
        for (const response of responses) {
            assert.equal(response.headers.get('content-type'), 'text/event-stream');
            const first = await response.body!.getReader().read();
            assert.match(Buffer.from(first.value!).toString(), /event: message_start/u);
        }
        assert.deepEqual([...provider.received].sort(), AGENTS.map(agent => agent.prompt).sort());
        assert.equal(provider.requests.filter(caller => caller === 'auxiliary').length, 1);
    } finally { await provider.close(); }
});
