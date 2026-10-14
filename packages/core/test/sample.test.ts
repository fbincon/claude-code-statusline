import { test } from 'node:test';
import assert from 'node:assert/strict';
import { delta, trusted } from '../src/timing/sample.js';

test('same-boot clocks include suspend independently of wall changes; reboot degrades', () => {
  const a = { wall_ns: 2000000000000000001n, boot_ns: 10n, boot_id: 'one' };
  const b = { wall_ns: 1n, boot_ns: 100n, boot_id: 'one' };
  assert.equal(delta(a, b), 90n); assert.ok(trusted(a, b));
  assert.equal(delta(a, { ...b, boot_id: 'two' }), null);
  assert.equal(trusted(a, { ...b, boot_id: 'two' }), false);
  const legacy = { ...a, boot_id: 'windows:guid' };
  assert.equal(trusted(legacy, { ...legacy, boot_ns: 100n }), false);
  assert.equal(delta(legacy, { ...legacy, boot_ns: 100n }), 0n);
  const corrected = { ...a, boot_id: 'windows:v2:guid:10' };
  assert.equal(delta(corrected, { ...corrected, wall_ns: 1n, boot_ns: 100n }), 90n);
});
