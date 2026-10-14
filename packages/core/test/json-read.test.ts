import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from '../src/json-read.js';
import { integer, isLosslessNumber } from '../src/json.js';
import { clone } from '../src/config/validation.js';
import { pythonJson } from '../src/json-text.js';
import { equalSettings } from '../src/json-equality.js';
test('public JSON syntax diagnostics retain exact positions and numeric kinds', () => {
    for (const [raw, message] of [['{', 'Expecting property name enclosed in double quotes: line 1 column 2 (char 1)'], ['[1,]', 'Illegal trailing comma before end of array: line 1 column 3 (char 2)'], ['{"中文":1,}', 'Illegal trailing comma before end of object: line 1 column 8 (char 7)'], ['true false', 'Extra data: line 1 column 6 (char 5)'], ['"\\x"', 'Invalid \\escape: line 1 column 2 (char 1)'], ['"\\u123x"', 'Invalid \\uXXXX escape: line 1 column 3 (char 2)'], ['"abc', 'Unterminated string starting at: line 1 column 1 (char 0)']])
        assert.throws(() => readJson(raw!), { message });
    const data = readJson('{"n":9007199254740993,"f":1.0,"z":-0.0,"__proto__":1}') as Record<string, unknown>;
    assert.equal(integer(data.n), 9007199254740993n);
    assert.ok(isLosslessNumber(data.f));
    assert.throws(() => integer(data.f));
    assert.equal(Object.hasOwn(data, '__proto__'), true);
    assert.throws(() => readJson('{"x":1,"\\u0078":1}', { duplicate(key) { throw new Error(key); } }), { message: 'x' });
    assert.throws(() => readJson('{"x":NaN}', { constant(value) { throw new Error(value); } }), { message: 'NaN' });
});
test('settings members retain input order and exact numbers across copy and unrelated updates', () => {
    const input = '{"10": 1.0, "2": 9007199254740993, "nested": {"9": -0.0, "1": 1e+20}, "__proto__": false}';
    const parsed = readJson(input) as Record<string, unknown>, copied = clone(parsed);
    assert.equal(pythonJson(copied, { ensureAscii: false }), input);
    copied['3'] = 7;
    assert.deepEqual(Object.keys(copied), ['10', '2', 'nested', '__proto__', '3']);
    delete copied['10'];
    copied['10'] = 4;
    assert.deepEqual(Object.keys(copied), ['2', 'nested', '__proto__', '3', '10']);
    assert.equal(pythonJson(parsed, { ensureAscii: false }), input);
});
test('settings equality follows Python numeric equality while serialization retains the original kind', () => {
    assert.equal(equalSettings(readJson('{"x":1.0}'), { x: 1 }), true);
    assert.equal(equalSettings(readJson('{"x":9007199254740993}'), { x: 9007199254740992 }), false);
    assert.equal(equalSettings(readJson('{"x":-0.0}'), { x: 0 }), true);
    const raw = readJson('{"legacy":NaN,"overflow":1e400}');
    assert.equal(equalSettings(raw, clone(raw)), true);
    assert.throws(() => pythonJson(raw));
    assert.equal(pythonJson(raw, { allowNan: true }), '{"legacy": NaN, "overflow": Infinity}');
});
