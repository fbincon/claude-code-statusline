import test from 'node:test';
import { setup, assert, fs, join, pythonJson, writeLines } from './runtime-support.js';
import { agentConfig, config, env } from './render-support.js';
import { AgentDurations } from '../src/runtime/live/durations.js';
import { renderEnvironment } from '../src/rendering/environment.js';
import { renderPayload, renderTask } from '@fbincon/statusline-core/rendering/subagents';
import { configuredRows } from '@fbincon/statusline-core/rendering/items';
import { strip, displayWidth } from '@fbincon/statusline-core/rendering/layout';
import { previewAdapter } from '../src/rendering/preview.js';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
test('tests.runtime.live.test_durations.FrozenAgentTests.test_repeated_refreshes_freeze_ended_agent_without_live_metrics', async (t) => {
    const f = setup(t);
    f.event('UserPromptSubmit', 0);
    f.event('SubagentStart', 1, { agent_id: 'a' });
    const source = new AgentDurations(f.context), event = { session_id: 's', agent_id: 'a', hook_event_name: 'SubagentStart' };
    source.observe(event, 1000);
    source.observe(event, 1500);
    source.observe({ ...event, hook_event_name: 'SubagentStop' }, 43000);
    source.observe({ ...event, hook_event_name: 'SubagentStop' }, 99000);
    const cfg = agentConfig(['status-elapsed']), data = { session_id: 's', tasks: [{ id: 'a', status: 'completed', startTime: 1000 }] };
    const sources = await renderEnvironment(cfg, data, { runtime: f.context }, true);
    for (const now of [45000, 100000, 999999])
        assert.equal(renderPayload(data, cfg, sources, now)[0]!.content, '✓ 0m 42s');
    assert.ok(!fs.existsSync(join(f.root, 'claude-statusline-runtime.json')));
});
test('tests.runtime.live.test_durations.FrozenAgentTests.test_terminal_agent_without_end_evidence_keeps_status_only', () => {
    const cfg = agentConfig(['status-elapsed']), task = { id: 'a', status: 'completed', startTime: 1000 };
    assert.equal(renderTask(task, cfg, env, 80, 999999), '✓');
    assert.equal(renderTask({ ...task, _frozen_duration_ms: -1 }, cfg, env, 80, 999999), '✓');
});
test('tests.rendering.test_statusline_rate_limits.RateLimitIntegrationTests.test_wide_output_places_limits_between_context_and_tokens', async (t) => {
    const f = setup(t), path = join(f.root, 'session.jsonl');
    writeLines(path, [{ type: 'cost-state', modelUsage: { 'test-model': { cacheReadInputTokens: 10, inputTokens: 20, cacheCreationInputTokens: 5, outputTokens: 5 } } }]);
    const data = { model: { id: 'test-model' }, session_id: 'wide-session', transcript_path: path, context_window: { remaining_percentage: 88, context_window_size: 1000000 }, rate_limits: { five_hour: { used_percentage: 23 }, seven_day: { used_percentage: 41 }, spend_limit: { used_percentage: 63 } } }, cfg = defaultDisplay();
    const sources = await renderEnvironment(cfg, data, { runtime: f.context });
    assert.deepEqual(configuredRows(data, cfg, 998, sources).map(strip).join('\n').split(' | '), ['test-model', 'Context 88% left · 1M window', '5h 77% left · weekly 59% left · spend 37% left', 'hit 10 · miss 25 · out 5']);
});
test('tests.rendering.test_statusline_rate_limits.RateLimitIntegrationTests.test_narrow_output_wraps_without_orphan_separators', async (t) => {
    const f = setup(t), path = join(f.root, 'session.jsonl');
    writeLines(path, [{ type: 'cost-state', modelUsage: { 'test-model': { cacheReadInputTokens: 10, inputTokens: 20, cacheCreationInputTokens: 5, outputTokens: 5 } } }]);
    const data = { model: { id: 'test-model' }, session_id: 'narrow-session', transcript_path: path, context_window: { remaining_percentage: 88, context_window_size: 1000000 }, rate_limits: { five_hour: { used_percentage: 23 }, seven_day: { used_percentage: 41 }, spend_limit: { used_percentage: 63 } } }, cfg = defaultDisplay();
    const sources = await renderEnvironment(cfg, data, { runtime: f.context }), rows = configuredRows(data, cfg, 32, sources);
    assert.ok(rows.length > 1);
    for (const row of rows) {
        assert.ok(displayWidth(row) <= 32);
        assert.ok(!strip(row).startsWith(' | ') && !strip(row).endsWith(' | '));
        assert.notEqual(strip(row).trim(), '|');
    }
    for (const part of ['Context 88% left', 'weekly 59% left', 'hit 10 · miss 25 · out 5'])
        assert.ok(rows.map(strip).join('\n').includes(part));
});
test('preview service returns spans for both scopes without filesystem observations', async () => {
    const adapter = await previewAdapter('/test/home'), draft = { display: defaultDisplay(), host: { ...DEFAULT_HOST, padding: 4 } };
    for (const width of [2, 40, 80, 120]) {
        const output = adapter(draft, width) as {
            sample: boolean;
            main: {
                text: string;
            }[][];
            subagents: {
                text: string;
            }[][];
        };
        assert.equal(output.sample, true);
        assert.ok(output.main.length);
        assert.ok(output.subagents.length);
        for (const spans of [...output.main, ...output.subagents])
            assert.ok(displayWidth(spans.map(s => s.text).join('')) <= width);
    }
});
