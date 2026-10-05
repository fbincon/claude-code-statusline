import { test, expect } from 'claude-code/testing';
import { tapStream, usage } from '../lib/streams.ts';
import { cost } from '../lib/costs.ts';

test('stream chunks, result, cancellation and thrown objects pass through unchanged', async () => {
  const chunk = { kind: 'text', text: 'original' };
  const answer = { answer: 'result' };
  let finalized = false;
  async function* source() { try { yield chunk; return answer; } finally { finalized = true; } }
  const seen: unknown[] = [];
  const stream = tapStream(source(), async (item) => { seen.push(item); throw new Error('collector failure'); });
  const next = await stream.next();
  expect(next.value).toBe(chunk);
  expect((await stream.next()).value).toBe(answer);
  expect(finalized).toBe(true);
  const cancelled = tapStream(source(), async () => {});
  await cancelled.next();
  expect((await cancelled.return(answer)).value).toBe(answer);
  const failure = { custom: 'same error' };
  const thrown = tapStream(source(), async () => {});
  await thrown.next();
  let caught: unknown;
  try { await thrown.throw(failure); } catch (e) { caught = e; }
  expect(caught).toBe(failure);
  expect(seen.length).toBe(2);
});

test('usage retains raw zero integers and official cost parsing excludes other sessions and workflows', () => {
  const counts = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  expect(usage(counts)).toEqual(counts);
  expect(usage({ ...counts, input_tokens: -1 })).toBe(null);
  expect(usage({ ...counts, output_tokens: 1.5 })).toBe(null);
  expect(usage({ input_tokens: 0 })).toBe(null);
  const event = { to: 'collector' as const, event: 'api_request', loggedAt: '2026-10-05T00:00:00Z',
    attributes: { 'session.id': 's', 'prompt.id': 'p', request_id: 'server-id', query_source: 'repl_main_thread', cost_usd: 0 } };
  expect(cost(event, 's', [])?.payload.cost_usd).toBe(0);
  expect(cost(event, 'other', [])).toBe(null);
  expect(cost({ ...event, attributes: { ...event.attributes, 'workflow.run_id': 'wf' } }, 's', [])).toBe(null);
});
