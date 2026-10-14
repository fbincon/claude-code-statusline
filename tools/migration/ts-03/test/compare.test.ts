import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare } from '../compare.js';
import { inventory } from '../inventory.js';
import { decode } from '@fbincon/statusline-core/json';

test('comparison preserves numeric kinds, missing values, order and encoded file bytes', () => {
  assert.deepEqual(compare(decode('{"a":{"x":1,"y":2}}'), decode('{"a":{"y":2,"x":1}}')), []);
  for (const [a, b] of [['1', '1.0'], ['9007199254740993', '9007199254740992'], ['null', '0'], ['[1,2]', '[2,1]'], ['{}', '{"x":null}'], ['"{ \\"x\\": 1}"', '"{\\"x\\":1}"']]) {
    assert.ok(compare({ a: decode(a!) }, { a: decode(b!) }).length);
  }
  assert.ok(compare({ a: 1 }, {}).length);
  assert.ok(compare({}, { a: 1 }).length);
});

test('coverage accounts for every frozen test while unfinished stage cannot pass', () => {
  const state = inventory(); assert.equal(state.total, 516);
  if (state.pending) assert.throws(() => inventory(true), /still pending/);
});

test('broad and stale comparison exemptions are rejected', () => {
  assert.throws(() => compare({}, {}, [{ case: 'anything', path: '/', before_sha256: '0'.repeat(64), after_sha256: '0'.repeat(64), reason: 'ignore' }]));
});
