import test from 'node:test';
import assert from 'node:assert/strict';
import { requireCompletedTurn, requirePublicReplayText, requireCompletedRendering } from '../showcase-replay.js';

test('actual-task replay refuses running, unfinished and unfrozen observations', () => {
    const completed = { status: 'completed', active_agents: {}, prompt_id: 'observed-prompt', duration_ns: 12000000000n, ended_wall_ns: 1700000000000000000n };
    requireCompletedTurn(completed);
    for (const change of [{ status: 'running' }, { active_agents: { agent: {} } }, { duration_ns: null }, { ended_wall_ns: null }])
        assert.throws(() => requireCompletedTurn({ ...completed, ...change }));
});

test('completed-render observation reads text through ANSI styles without accepting a running timer', () => {
    requireCompletedRendering('\x1b[38;2;142;211;211mok Task total time 0m 14s\x1b[0m');
    requireCompletedRendering('\x1b[1;36mok 任务耗时 0m 14s\x1b[0m');
    assert.throws(() => requireCompletedRendering('\x1b[1;36mrun Task total time 0m 14s\x1b[0m'));
});

test('public replay output rejects private paths, credentials, identities and Powerline', () => {
    requirePublicReplayText('Main · ok 0m 12s\nAgent one · ok · 0m 4s');
    for (const value of ['/home/user/private', '/tmp/private-fixture', 'ANTHROPIC_API_KEY', 'apiKeyHelper', 'Bearer private-token', 'sk-not-a-real-key', '\ue0b0'])
        assert.throws(() => requirePublicReplayText(value));
    assert.throws(() => requirePublicReplayText('recorded-private-session', ['recorded-private-session']));
});
