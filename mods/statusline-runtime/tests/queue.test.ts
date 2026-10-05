import { test, expect } from 'claude-code/testing';
import { Queue, confirmedResponse } from '../lib/queue.ts';

test('exact retry identities survive concurrent enqueue and acknowledgements', () => {
  const queue = new Queue();
  queue.bind('s', 1000);
  queue.push('heartbeat', {host_version: '2.1.289', loaded_at_ms: 1000}, 1000);
  const batch = queue.batch();
  queue.push('prompt', {}, 1010, {prompt_id: 'p'});
  expect(queue.batch()[0]).toEqual(batch[0]);
  queue.acknowledge(batch);
  expect(queue.pending.length).toBe(1);
  expect(queue.pending[0]?.prompt_id).toBe('p');
  const old = queue.batch();
  queue.bind('s', 2000);
  queue.push('heartbeat', {host_version: '2.1.289', loaded_at_ms: 2000}, 2000);
  queue.acknowledge(old);
  expect(queue.pending.length).toBe(1);
});

test('overflow stays bounded and preserves bootstrap while marking a sequence gap', () => {
  const queue = new Queue();
  queue.bind('s', 1000);
  queue.push('heartbeat', {host_version: '2.1.289', loaded_at_ms: 1000}, 1000);
  for (let i=0; i<2000; i++) queue.push('permission', {mode: 'plan', live: false}, 1001+i);
  expect(queue.pending.length).toBe(1024);
  expect(queue.pending[0]?.seq).toBe(0);
  expect(queue.dropped).toBe(true);
  expect(queue.batch().length).toBe(256);
});

test('backend refusal, malformed envelopes and version mismatches cannot acknowledge data', () => {
  const good = {protocol_version: 2, result: {backend_version: 'test', enabled: true, accepted: 1, ignored: 0}};
  expect(confirmedResponse(JSON.stringify(good), 'test')).toBe(true);
  expect(confirmedResponse(JSON.stringify(good), 'other')).toBe(false);
  expect(confirmedResponse('not json', '')).toBe(false);
  expect(confirmedResponse(JSON.stringify({protocol_version: 2, error: {code: 'refused'}}), '')).toBe(false);
});
