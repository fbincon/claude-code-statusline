import { expect, mock, test } from 'claude-code/testing';

for (const sourceRefresh of [false, true]) test(`automatic source lifecycle is independent of metric collection: ${sourceRefresh}`, {
  options: { sourceRefresh, nativeTiming: false, liveMetrics: false },
}, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 });
  mock.env(on, {});
  on('session.start', () => ({ cwd: '/work' }));
  on('session.id', () => ({ value: 'source-session' }));
  on('session.cwd', () => ({ value: '/work' }));
  on('session.version', () => ({ value: { version: '2.1.294' } }));
  on('session.end', ($, e) => ({ sessionId: e.sessionId }));
  const calls: { operation: string; payload: { event: string; seq: number; session_id: string } }[] = [];
  on('process.run', async ($, e) => {
    calls.push(JSON.parse(e.init?.stdin ?? '{}'));
    return { value: { exitCode: 0, stdout: '{}', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } };
  });
  await $.session.start({ surface: 'terminal', isInteractive: false, cwd: '/work' });
  await clock.advance(5000);
  await $.session.end({ reason: 'other', sessionId: 'source-session', resume: { id: 'source-session' } });
  await clock.advance(5000);
  if (sourceRefresh) {
    expect(calls.map(c => c.operation)).toEqual(['source_lifecycle', 'source_lifecycle', 'source_lifecycle']);
    expect(calls.map(c => c.payload.event)).toEqual(['tick', 'tick', 'end']);
    expect(calls.map(c => c.payload.seq)).toEqual([0, 1, 2]);
    expect(calls.every(c => c.payload.session_id === 'source-session')).toBe(true);
  } else expect(calls.length).toBe(0);
});
