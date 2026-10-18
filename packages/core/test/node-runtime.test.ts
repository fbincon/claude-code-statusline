import test from 'node:test';
import assert from 'node:assert/strict';
import { supportedNode, matchesNodeCase, NODE_RUNTIME_RANGE } from '../src/node-runtime.js';

test('product Node support includes both stable LTS series and rejects other or malformed versions', () => {
  assert.equal(NODE_RUNTIME_RANGE, '^22.0.0 || ^24.0.0');
  for (const version of ['22.0.0', '22.23.3', '24.0.0', '24.21.0', '24.22.0']) assert(supportedNode(version));
  for (const version of ['20.99.0', '23.0.0', '25.0.0', '26.0.0', '24.0.0-rc.1', 'v24.0.0', '24.01.0', '24.0', '24.0.0\n', '__proto__']) assert(!supportedNode(version));
  assert(matchesNodeCase('22.23.3', '22.x'));
  assert(matchesNodeCase('24.0.0', '24.0.0'));
  assert(!matchesNodeCase('24.21.0', '24.0.0'));
  assert(!matchesNodeCase('22.23.3', '24.x'));
  assert(!matchesNodeCase('24.21.0', 'latest'));
});
