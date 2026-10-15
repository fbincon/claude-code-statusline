import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedRecord, orderedDataRecord, forEachRecord, recordKeys, recordEntries, recordValues } from '../src/ordered-record.js';
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
test('lazy native dictionary order survives later numeric IDs, symbols and reinsertion', () => {
    const record = orderedDataRecord({ first: 1, second: 2 }) as Record<string | symbol, unknown>;
    const symbol = Symbol('meta');
    record[symbol] = 3;
    record['9'] = 4;
    record['2'] = 5;
    delete record.first;
    record.first = 6;
    Object.defineProperty(record, 'hidden', { value: 7, enumerable: false });
    assert.deepEqual(Reflect.ownKeys(record), ['second', symbol, '9', '2', 'first', 'hidden']);
    const visited: unknown[] = [];
    forEachRecord(record, (value, key) => visited.push([key, value]));
    assert.deepEqual(visited, [['second', 2], ['9', 4], ['2', 5], ['first', 6]]);
    Object.preventExtensions(record);
    assert.equal(Reflect.set(record, '1', 8), false);
    assert.deepEqual(Object.keys(record), ['second', '9', '2', 'first']);
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
