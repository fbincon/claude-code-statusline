import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyDecoder, type Key } from '../src/terminal/input.js';

test('a confirmed escape prefix survives delays and unknown frames never dispatch their suffix', () => {
    for (const [frame, expected] of [
        ['\x1b[A', [{key:'up'}]], ['\x1bOD', [{key:'left'}]], ['\x1b[Z', [{key:'tab',shift:true}]],
        ['\x1b[[A', []], ['\x1b\x1b[A', []], ['\x1b[1;5C', []], ['\x1b[<'+'123;'.repeat(100)+'1M', []],
        ['\x1b[M'+String.fromCharCode(32,65,113), []], ['\x1b\r', []], ['\x1bf', []], ['\x1b界', []],
    ] as const) {
        const decoder = new KeyDecoder(), raw = Buffer.from(frame + 'x'), actual: Key[] = [];
        for (const byte of raw) {
            actual.push(...decoder.push(Buffer.from([byte])));
            // A delay only has a meaning when all we have seen is the Esc key itself.
            if (!decoder.pendingEscape) assert.deepEqual(decoder.flushEscape(), []);
        }
        assert.deepEqual(actual, [...expected, {key:'x'}], frame);
    }
    const decoder = new KeyDecoder();
    decoder.push('\x1b['); assert.equal(decoder.pendingEscape, false);
    assert.deepEqual(decoder.flushEscape(), []); assert.deepEqual(decoder.push('B'), [{key:'down'}]);
    decoder.push('\x1b\x1b'); assert.deepEqual(decoder.flushEscape(), [{key:'escape'},{key:'escape'}]);
    decoder.push('\x1b[' + '1'.repeat(100)); assert.deepEqual(decoder.push('\x13Q'), []);
    decoder.push('\x1b['); assert.deepEqual(decoder.push('\x03'), [{key:'c',ctrl:true}]);
});

test('split bracketed paste retains UTF-8 and embedded control bytes in one bounded text event', () => {
    const text = '界👩🏽‍💻\x1b[20x\x13\r';
    const decoder = new KeyDecoder();
    assert.deepEqual([...Buffer.from('\x1b[200~' + text + '\x1b[201~')].flatMap(byte => decoder.push(Buffer.from([byte]))), [{key:text,paste:true}]);
    assert.deepEqual(decoder.push('\x1b[201~'), []);
    assert.deepEqual(decoder.push('\x1b[200~' + 'a'.repeat(17000) + '\x13\x1b[201~z'), [{key:'input-overflow',overflow:true},{key:'z'}]);
});
