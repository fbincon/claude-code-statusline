import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedRecord, recordKeys, recordEntries, recordValues } from '../src/ordered-record.js';
test('bounded ordered dictionaries retain Python deletion/reinsertion order at large history sizes', () => {
    const record = orderedRecord(Array.from({ length: 10000 }, (_, i) => [String(10000 - i), i] as const));
    const before = Object.keys(record);
    for (const key of before.slice(0, 5000))
        delete record[key];
    record['10000'] = -1;
    const expected = [...before.slice(5000), '10000'];
    assert.deepEqual(recordKeys(record), expected);
    assert.deepEqual(Object.keys(record), expected);
    assert.deepEqual(recordEntries(record), Object.entries(record));
    assert.deepEqual(recordValues(record), Object.values(record));
});
test('fast internal iterations preserve enumerable data and normal property descriptor invariants', () => {
    const record = orderedRecord([['__proto__', 1], ['a', 2]]), symbol = Symbol('metadata');
    Object.defineProperty(record, 'hidden', { value: 3, enumerable: false });
    Object.defineProperty(record, symbol, { value: 4 });
    Object.defineProperty(record, 'locked', { value: 5, enumerable: true, configurable: false, writable: false });
    assert.deepEqual(recordKeys(record), ['__proto__', 'a', 'locked']);
    assert.deepEqual(recordEntries(record), Object.entries(record));
    assert.equal(Reflect.deleteProperty(record, 'locked'), false);
    assert.equal(Reflect.set(record, 'locked', 6), false);
    assert.deepEqual(Reflect.ownKeys(record), ['__proto__', 'a', 'hidden', symbol, 'locked']);
    assert.equal(Object.getPrototypeOf(record), Object.prototype);
    assert.equal(record['__proto__'], 1);
});
