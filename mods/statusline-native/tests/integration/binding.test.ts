import { test, expect } from 'claude-code/testing';
import { START, RUN, setup } from '../fixtures.ts';

test('native hook passes the installed Node entry and literal arguments', {
  options: { backendExecutable: '/node with spaces/node', backendArgs: ['/installed 中文 & $`/entry.js'] },
}, async ($, on) => {
  const f = setup(on, '');
  await $.session.start(START);
  await $.command.run(RUN);
  expect(f.calls.length > 0).toBe(true);
  expect(f.calls[0]!.argv).toEqual(['/node with spaces/node', '/installed 中文 & $`/entry.js', 'ui', '--config-dir', '/tmp/config 中文 $`']);
});

test('native executable override discards the installed argument prefix', {
  options: { backendExecutable: '/node', backendArgs: ['/installed/entry.js'] },
}, async ($, on) => {
  const f = setup(on);
  await $.session.start(START);
  await $.command.run(RUN);
  expect(f.calls[0]!.argv).toEqual(['/tmp/bin with spaces/claude-statusline', 'ui', '--config-dir', '/tmp/config 中文 $`']);
});
