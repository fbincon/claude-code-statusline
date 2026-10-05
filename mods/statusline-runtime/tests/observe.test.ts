import { test, expect, mock } from 'claude-code/testing';
import type { Observation } from '../lib/generated-contracts.ts';

test('collector passes synthetic request content and result through, without inventing real usage', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 });
  mock.env(on, { CLAUDE_STATUSLINE_RUNTIME_EXECUTABLE: 'test-backend' });
  on('session.start', () => ({ cwd: '/work' }));
  on('session.id', () => ({ value: 's' }));
  on('session.version', () => ({ value: { version: '2.1.289' } }));
  on('turn.start', ($, e) => ({ turnId: e.turnId }));
  on('classic.UserPromptSubmit', () => ({}));
  const rows: Observation[] = [];
  on('process.run', async ($, e) => {
    const request = JSON.parse(e.init?.stdin ?? '{}');
    rows.push(...request.payload.observations);
    return { value: { exitCode: 0, stdout: JSON.stringify({ protocol_version: 1, result: {
      backend_version: 'test', enabled: true, accepted: request.payload.observations.length, ignored: 0,
    } }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } };
  });
  const answer = { turnId: 't', index: 0, answer: 'unchanged', toolUses: [], stopReason: 'end_turn' as const,
    usage: { model: 'test', input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
  on('turn.step', async function* () {
    yield { kind: 'text' as const, index: 0, text: 'unchanged' };
    yield { kind: 'stop' as const, stopReason: 'end_turn' as const, usage: answer.usage };
    return answer;
  });
  await $.session.start({ surface: 'terminal', isInteractive: false, cwd: '/work' });
  await $.classic.UserPromptSubmit({ prompt: 'private prompt', prompt_id: 'p' });
  await $.turn.start({ text: 'private prompt', turnId: 't' });
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'test', messageCount: 1 });
  expect((await stream.next()).value).toEqual({ kind: 'text', index: 0, text: 'unchanged' });
  await stream.next();
  expect((await stream.next()).value).toEqual(answer);
  await clock.advance(1000);
  const end = rows.find(row => row.kind === 'request_end');
  expect(end?.payload.native).toBe(false);
  expect(end?.payload.usage).toBe(null);
  expect(rows.some(row => row.kind === 'request_first')).toBe(false);
  expect(JSON.stringify(rows).includes('private prompt')).toBe(false);
});
