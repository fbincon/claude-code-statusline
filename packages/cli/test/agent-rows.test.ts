import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BY_SCOPE } from '@fbincon/statusline-core/config/catalog';
import { CONFIG_FILENAME, defaultItem } from '@fbincon/statusline-core/config/display';
import { PROFILES_FILENAME } from '@fbincon/statusline-core/config/profiles';
import type { DisplayDraft, InstanceDraft } from '@fbincon/statusline-core/contracts/ui';
import { decode } from '@fbincon/statusline-core/json';
import { displayWidth, strip, styledUnits } from '@fbincon/statusline-core/rendering/layout';
import { parse } from '@fbincon/statusline-core/rendering/styles';
import { SESSION_EFFORT_TTL_MS } from '@fbincon/statusline-core/rendering/subagent-effort';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { ConfigurationService } from '../src/config/service.js';
import { AGENT_ROW_PROTOCOL_BYTES, renderAgentRowBatch } from '../src/rendering/agent-rows.js';
import { render } from '../src/rendering/main.js';
import { runtimeContext } from '../src/runtime/context.js';
import { AgentDurations } from '../src/runtime/live/durations.js';
import { TaskService } from '../src/runtime/tasks/service.js';
import { contextFor } from '../src/sources/context.js';
import { SourceService } from '../src/sources/service.js';
import { agentConfig, task } from './render-support.js';

function fixture(t: TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'agent rows '));
    t.after(() => removeTree(root));
    const save = (display: DisplayDraft) => writeFileSync(join(root, CONFIG_FILENAME), JSON.stringify(display));
    const payload = (tasks: unknown[], columns = 80) => ({ session_id: 'session', cwd: root, columns, tasks });
    return { root, save, payload };
}

function instance(type: string, text: string | null = null): InstanceDraft {
    return { id: type, type_id: type, enabled: true, options: defaultItem(), text };
}

test('every catalog type uses the callback renderer with identical terminal styles and graphemes', async t => {
    const f = fixture(t);
    const types = [...BY_SCOPE.subagent.keys()];
    assert.equal(types.length, 17);
    for (const language of ['en', 'zh-CN'] as const) {
        const display = agentConfig([], {}, { theme: 'ocean', use_colors: true, statusline_language: language });
        for (const type of types) {
            const node = instance(type, type === 'text' ? '进度 é👩🏽‍💻' : null);
            if (type === 'current-dir') node.options.link = 'on';
            display.subagents.instances = type === 'spacer' ? [instance('name'), node, instance('text', '终')] : [node];
            f.save(display);
            for (const columns of [6, 80]) {
                const agent = task({ id: '代理', name: '探👩🏽‍💻é', cwd: f.root, status: 'completed', _frozen_duration_ms: 42000 });
                const legacy = JSON.parse(await render(() => JSON.stringify(f.payload([agent], columns)), { configDir: f.root }, true));
                const result = await renderAgentRowBatch(decode(JSON.stringify(f.payload([{ ...agent, _row_columns: columns }], columns))), f.root);
                assert.deepEqual(result, [{ id: '代理', body: legacy.content }], language + ' ' + type + ' ' + columns);
                assert(displayWidth(legacy.content) <= columns);
                if (columns === 80) {
                    assert(strip(legacy.content).length > 0, type);
                    if (type === 'current-dir') assert(styledUnits(legacy.content).some(unit => unit.link?.startsWith('file:')));
                    if (type === 'text') assert.match(strip(legacy.content), /é👩🏽‍💻/u);
                }
            }
        }
    }
});

test('an empty body hides a row while an unavailable or disabled batch leaves host rows alone', async t => {
    const f = fixture(t), display = agentConfig(['name']);
    const first = { id: 'a', name: 'A', _row_columns: 4 };
    const valid = f.payload([first], 4);
    for (const invalid of [null, [], { ...valid, session_id: '' }, { ...valid, cwd: 'relative' }, { ...valid, columns: '4' },
        { ...valid, columns: 10_001 }, { ...valid, tasks: [first, first] }, ...[{}, { id: '   ' }, { id: 'b', _row_columns: -1 },
            { id: 'b', _row_columns: 5 }, { id: 'b', _row_columns: 1.5 }, { id: 'b', _row_columns: '3' }].map(row => f.payload([first, row], 4))]) {
        assert.deepEqual(await renderAgentRowBatch(invalid, f.root), []);
    }
    display.subagents.enabled = false;
    f.save(display);
    assert.deepEqual(await renderAgentRowBatch(valid, f.root), []);
    display.subagents.enabled = true;
    display.subagents.instances = [];
    f.save(display);
    assert.deepEqual(await renderAgentRowBatch(valid, f.root), [{ id: 'a', body: '' }]);
    display.subagents.instances = [instance('name')];
    f.save(display);
    assert.deepEqual(await renderAgentRowBatch(f.payload([{ ...first, _row_columns: 0 }], 0), f.root), [{ id: 'a', body: '' }]);
});

test('each row fits its own width before it consumes quota or advances continuous Powerline colors', async t => {
    const f = fixture(t), display = agentConfig(['name', 'task'], {}, { use_colors: true, theme: 'dark', separator_style: 'powerline' });
    Object.assign(display.powerline, { color_mode: 'continuous', padding: 'none', end_cap: false });
    f.save(display);
    const rows = (firstWidth: number) => renderAgentRowBatch(f.payload([
        { id: 'first', name: 'A', label: 'X', _row_columns: firstWidth },
        { id: 'second', name: 'B', label: 'Y', _row_columns: 14 },
    ], 14), f.root);
    const narrow = await rows(1), wide = await rows(14), exhausted = await rows(0);
    assert.equal(strip(narrow[0]!.body!), 'A');
    assert.equal(strip(wide[0]!.body!), 'A>X');
    assert.equal(strip(narrow[1]!.body!), strip(wide[1]!.body!));
    const background = (body: string) => parse(styledUnits(body)[0]!.style).background;
    assert.notDeepEqual(background(narrow[1]!.body!), background(wide[1]!.body!));
    assert.deepEqual(background(exhausted[1]!.body!), background(wide[0]!.body!));
    display.subagents = { ...display.subagents, instances: [instance('context-used')], row_limit: 1, hide_completed: true };
    f.save(display);
    const taskRows = (count?: number) => renderAgentRowBatch(f.payload([
        { id: 'ended', status: 'completed', _row_columns: 20 },
        { id: 'first', tokenCount: count, contextWindowSize: 100, _row_columns: 20 },
        { id: 'second', tokenCount: 50, contextWindowSize: 100, _row_columns: 20 },
    ]), f.root);
    assert.deepEqual((await taskRows()).map(row => Boolean(row.body)), [false, false, true]);
    assert.deepEqual((await taskRows(1)).map(row => Boolean(row.body)), [false, true, false]);
});

test('a batch that expands beyond its output budget publishes no partial row decisions', async t => {
    const f = fixture(t), display = agentConfig([]);
    display.subagents.instances = [instance('name'), instance('spacer'), instance('text', '.')];
    f.save(display);
    const columns = 10_000, tasks = Array.from({ length: Math.ceil(AGENT_ROW_PROTOCOL_BYTES / columns) }, (_, i) => ({
        id: String(i), name: 'A', _row_columns: columns,
    }));
    assert.deepEqual(await renderAgentRowBatch(f.payload(tasks, columns), f.root), []);
    const [single] = await renderAgentRowBatch(f.payload(tasks.slice(0, 1), columns), f.root);
    assert.equal(single!.body!.length, columns);
});

test('one-cell grouped subagent rows fit without splitting a grapheme or using a sibling’s width', async t => {
    const f = fixture(t), display = agentConfig(['name', 'task']);
    display.subagents.groups = [{ id: 'words', member_ids: ['name', 'task'], primary_id: 'name', link_visibility: false, shared_powerline: false }];
    f.save(display);
    const rows = await renderAgentRowBatch(f.payload([
        { id: 'a', name: '👩🏽‍💻', label: '描述', _row_columns: 1 },
        { id: 'b', name: '探👩🏽‍💻é', label: '描述', _row_columns: 20 },
    ], 20), f.root);
    assert(displayWidth(rows[0]!.body!) <= 1);
    assert(!rows[0]!.body!.includes('👩'));
    assert.equal(rows[1]!.body, '探👩🏽‍💻é 描述');
});

test('grouped gradients, adaptive indicators, spacers and repeated types match legacy ANSI bytes', async t => {
    const f = fixture(t), display = agentConfig([], {}, { theme: 'ocean', separator_style: 'powerline', use_colors: true });
    const name = instance('name'), context = instance('context-remaining'), copy = { ...instance('name'), id: 'again' };
    name.options.foreground_gradient = ['#456789', '#fedcba'];
    name.options.background_gradient = ['#234567', '#345678'];
    context.options.presentation = 'adaptive';
    copy.options.label = '↳';
    display.powerline.row_background_gradient = ['#001122', '#8899aa'];
    display.subagents.instances = [name, instance('text', '测试'), context, instance('spacer'), copy];
    display.subagents.groups = [{ id: 'title', member_ids: ['name', 'text'], primary_id: 'name', link_visibility: true, shared_powerline: true }];
    const agent = task({ name: '探 é👩🏽‍💻', status: 'running' });
    for (const palette of ['default', 'ansi'] as const) {
        display.palette = palette;
        f.save(display);
        for (const columns of [1, 16, 64]) {
            const expected = JSON.parse(await render(() => JSON.stringify(f.payload([agent], columns)), { configDir: f.root }, true));
            const [row] = await renderAgentRowBatch(f.payload([{ ...agent, _row_columns: columns }], columns), f.root);
            assert.equal(row!.body, expected.content);
            assert(displayWidth(row!.body!) <= columns);
            if (columns === 64) {
                const units = styledUnits(row!.body!);
                assert(units.some(unit => parse(unit.style).background !== null));
                assert(units.some(unit => unit.text === ' ' && parse(unit.style).background === null));
                assert(strip(row!.body!).includes('↳'));
            }
        }
    }
});

test('a new batch observes arriving end evidence and changes or expiration of matching session effort', async t => {
    const f = fixture(t);
    const oldRuntime = process.env.CLAUDE_STATUSLINE_RUNTIME_DIR;
    process.env.CLAUDE_STATUSLINE_RUNTIME_DIR = join(f.root, 'runtime');
    t.after(() => {
        if (oldRuntime === undefined) delete process.env.CLAUDE_STATUSLINE_RUNTIME_DIR;
        else process.env.CLAUDE_STATUSLINE_RUNTIME_DIR = oldRuntime;
    });
    let now = Date.now();
    t.mock.method(Date, 'now', () => now);
    f.save(agentConfig(['status-elapsed', 'model-with-effort']));
    const model = 'claude-sonnet-5';
    const payload = f.payload([{ id: 'ended', model, status: 'completed', startTime: 1000, _row_columns: 80 }]);
    const row = async () => (await renderAgentRowBatch(payload, f.root))[0]!.body;
    assert.equal(await row(), '✓ · sonnet-5');
    const runtime = runtimeContext(f.root), tasks = new TaskService(runtime), durations = new AgentDurations(runtime);
    const event = { session_id: 'session', prompt_id: 'prompt', agent_id: 'ended', hook_event_name: 'SubagentStart' };
    tasks.handle({ session_id: 'session', prompt_id: 'prompt', hook_event_name: 'UserPromptSubmit' });
    tasks.handle(event);
    durations.observe(event, 1000);
    durations.observe({ ...event, hook_event_name: 'SubagentStop' }, 43000);
    for (const level of ['high', 'low']) {
        now++;
        await render(() => JSON.stringify({ session_id: 'session', model: { id: model }, effort: { level } }), { configDir: f.root });
        assert.equal(await row(), '✓ 0m 42s · sonnet-5/~' + level);
    }
    now += SESSION_EFFORT_TTL_MS + 1;
    assert.equal(await row(), '✓ 0m 42s · sonnet-5');
});

test('session project selects the Profile and a bound external observation uses the task project and identity', async t => {
    const f = fixture(t), sessionProject = join(f.root, 'parent'), worktree = join(f.root, 'worktree');
    mkdirSync(sessionProject); mkdirSync(worktree);
    const sourceFile = join(f.root, 'queue.json');
    const sources = new SourceService(new ConfigurationService({ configDir: f.root, launch: { executable: process.execPath, args: [] }, hostVersion: () => null }));
    const change = (action: string, fields = {}) => sources.mutate({ action, id: 'queue', expected_revision: sources.read().revision, ...fields });
    change('add', { source: { name: 'Queue', kind: 'json', scope: { project: worktree, session: 'session', agent: 'tracked' },
        ttl_seconds: 60, settings: { path: sourceFile } } });
    change('enable', { review_revision: sources.review('queue').review_revision });
    const display = agentConfig([]);
    display.subagents.instances = [instance('external-value')];
    display.subagents.instances[0]!.source = change('bind').binding!;
    f.save(agentConfig(['name'], { enabled: false }));
    const profiles = join(f.root, PROFILES_FILENAME);
    const profile = () => writeFileSync(profiles, JSON.stringify({ version: 1, profiles: [{ id: 'p', name: 'Parent', display }],
        bindings: [{ root: sessionProject, profile_id: 'p' }] }));
    profile();
    const payload = { ...f.payload([{ id: 'tracked', cwd: worktree, _row_columns: 80 }, { id: 'other', cwd: worktree, _row_columns: 80 }]), cwd: sessionProject };
    const read = () => renderAgentRowBatch(payload, f.root);
    for (const value of [21, 42]) {
        writeFileSync(sourceFile, JSON.stringify({ value, observed_at: new Date().toISOString() }));
        const rows = await read();
        assert.equal(rows[0]!.body, 'Queue: ' + value);
        assert(!rows[1]!.body!.includes(String(value)));
    }
    const cache = join(f.root, 'statusline_runtime', 'sources', 'observations');
    const files = readdirSync(cache);
    assert.equal(files.length, 1);
    const observation = JSON.parse(readFileSync(join(cache, files[0]!), 'utf8')).current;
    assert.equal(observation.value, 42);
    assert.equal(sources.jobs().length, 0);
    t.mock.method(Date, 'now', () => Date.parse(observation.observed_at) + 60_001);
    assert.match((await read())[0]!.body!, /stale.*Queue: 42/u);
    display.subagents.enabled = false;
    profile();
    assert.deepEqual(await read(), []);
});

test('rendering a bound command reads the last published result without executing the provider', async t => {
    const f = fixture(t), executions = join(f.root, 'executions.txt');
    const config = new ConfigurationService({ configDir: f.root, launch: { executable: process.execPath, args: [] }, hostVersion: () => null });
    // Run manual refreshes below under test control, without a detached worker.
    const sources = new SourceService(config, Date.now, () => {});
    const change = (action: string, fields = {}) => sources.mutate({ action, id: 'count', expected_revision: sources.read().revision, ...fields });
    change('add', { source: { name: 'Runs', kind: 'command', scope: { project: f.root, session: null, agent: null }, ttl_seconds: 300,
        settings: { executable: process.execPath, cwd: f.root, output: 'text', timeout_ms: 10000,
            args: ['-e', "const fs=require('node:fs'); fs.appendFileSync(process.argv[1],'x'); process.stdout.write(fs.readFileSync(process.argv[1]));", executions] } } });
    change('enable', { review_revision: sources.review('count').review_revision });
    const display = agentConfig([]);
    display.subagents.instances = [instance('external-value')];
    display.subagents.instances[0]!.source = change('bind').binding!;
    f.save(display);
    const payload = f.payload([{ id: 'tracked', cwd: f.root, _row_columns: 80 }]);
    const body = async () => (await renderAgentRowBatch(payload, f.root))[0]!.body;
    assert.match((await body())!, /—/u);
    assert(!existsSync(executions));
    const context = contextFor(f.root, 'session', 'tracked');
    for (const expected of ['x', 'xx']) {
        const job = sources.start('count', context, 'test');
        await sources.work(job.id);
        assert.equal(sources.job(job.id).state, 'completed');
        assert.equal(await body(), 'Runs: ' + expected);
        assert.equal(await body(), 'Runs: ' + expected);
        assert.equal(readFileSync(executions, 'utf8'), expected);
    }
});
