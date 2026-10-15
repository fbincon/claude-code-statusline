import test from 'node:test';
import assert from 'node:assert/strict';
import { binding } from '../src/integration/binding.js';

test('backend binding preserves literal argv and replaces the complete prefix for legacy overrides', () => {
  const args = ['/installed 中文 & $`/entry.js', ''];
  const options = { backendExecutable: '/node with spaces/node', backendArgs: args };
  const launch = binding(options);
  assert.deepEqual(launch, { executable: options.backendExecutable, args });
  args.push('later');
  assert.equal(launch.args.length, 2);
  assert.deepEqual(binding(options, '/legacy/python-cli'), { executable: '/legacy/python-cli', args: [] });
  assert.deepEqual(binding(), { executable: 'claude-statusline', args: [] });
  assert.deepEqual(binding({ backendExecutable: 'legacy' }), { executable: 'legacy', args: [] });
});

test('backend binding rejects malformed arguments before launching a process', () => {
  for (const backendArgs of ['script', [42], ['bad\0arg'], {}, false]) assert.throws(() => binding({ backendArgs }), TypeError);
  for (const backendExecutable of ['', 42, 'bad\npath', 'bad\0path']) assert.throws(() => binding({ backendExecutable }), TypeError);
  assert.throws(() => binding({}, 'bad\rpath'), TypeError);
});
