import test from 'node:test';
import { fixture } from './support.js';
import { taskRefreshPty } from './task-refresh-pty.js';

test('both external task views observe completion, continuation and the current prompt without keys', {
    skip: process.platform === 'win32' && 'POSIX PTY',
    timeout: 90_000,
}, async t => {
    const { root, launch } = await fixture(t);
    await taskRefreshPty(root, launch, root);
});
