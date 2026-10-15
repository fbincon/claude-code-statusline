import test from 'node:test';
import assert from 'node:assert/strict';
import { Capture } from '../../migration/ts-04/capture.js';
test('terminal capture handles actual host title queries, cursor save/restore and private CSI across chunks', () => {
    const capture = new Capture(30, 4);
    for (const chunk of ['A\x1b7\x1b[2;3H中', '\x1b]0;private title', '\x07\x1b[>0q\x1b[>4m\x1b[<u\x1b8B', '\x1b]8;;https://example.invalid', '\x1b', '\\C\x1b]8;;\x1b\\\x1b[2 q']) capture.feed(chunk);
    assert.equal(capture.buffer[0]!.slice(0, 3).map(cell => cell.data).join(''), 'ABC');
    assert.equal(capture.buffer[1]![2]!.data, '中');
    assert(!capture.buffer.flat().map(cell => cell.data).join('').includes('private'));
    assert.throws(() => new Capture(10, 2).feed('\x1b]0;' + 'x'.repeat(9000)), /Unbounded/);
});
