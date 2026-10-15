import { test, expect, mock } from 'claude-code/testing';

for (const override of [false, true]) test(`runtime argv binding with override=${override}`, {
  options: { backendExecutable: '/node with spaces/node', backendArgs: ['/installed 中文 & $`/entry.js'], configDir: '/config 中文' },
}, async ($, on) => {
  mock.clock(on, { now: 1000 });
  mock.env(on, override ? { CLAUDE_STATUSLINE_RUNTIME_EXECUTABLE: 'legacy-backend' } : {});
  on('session.start', () => ({ cwd: '/work' }));
  on('session.id', () => ({ value: 'binding-session' }));
  on('session.version', () => ({ value: { version: '2.1.296' } }));
  const calls: (readonly string[])[] = [];
  on('process.run', async ($, e) => {
    calls.push(e.argv);
    const count = JSON.parse(e.init?.stdin ?? '{}').payload.observations.length;
    return { value: { exitCode: 0, stdout: JSON.stringify({ protocol_version: 2, result: { backend_version: 'test', enabled: true, accepted: count, ignored: 0 } }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } };
  });
  await $.session.start({ surface: 'terminal', isInteractive: false, cwd: '/work' });
  expect(calls).toEqual([[...(override ? ['legacy-backend'] : ['/node with spaces/node', '/installed 中文 & $`/entry.js']), 'runtime', '--config-dir', '/config 中文']]);
});
