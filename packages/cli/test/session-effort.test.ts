import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_FILENAME } from '@fbincon/statusline-core/config/display';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { newInstance } from '@fbincon/statusline-core/editor/instances';
import { parseResponse } from '@fbincon/statusline-core/editor/backend';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { displayWidth } from '@fbincon/statusline-core/rendering/layout';
import { SESSION_EFFORT_TTL_MS } from '@fbincon/statusline-core/rendering/subagent-effort';
import type { DisplayDraft } from '@fbincon/statusline-core/contracts/ui';
import { lock } from '@fbincon/statusline-platform/files';
import { diagnosisAdapter } from '../src/diagnostics/service.js';
import { render } from '../src/rendering/main.js';
import { previewAdapter } from '../src/rendering/preview.js';
import { runtimeContext } from '../src/runtime/context.js';
import { publishSessionEffort, sessionEffortReader } from '../src/runtime/session-effort.js';
import { setup } from './final-support.js';
import { allFiles } from './runtime-support.js';
import { agentConfig, NOW, task, updateDisplay } from './render-support.js';

const session = 'session-a';
const model = 'claude-sonnet-5';
const mainInput = { session_id: session, model: { id: model }, effort: { level: 'high' } };
const inherited = task({ effort: null, name: null, agentType: 'general-purpose' });
const agentInput = { session_id: session, columns: 120, tasks: [inherited] };
const entry = fileURLToPath(new URL('../src/entry.js', import.meta.url));
const cacheFile = (runtimeRoot: string) => join(runtimeRoot, 'session-effort', 'observations.json');

function display(items: readonly string[] = ['model-with-effort', 'effort']): DisplayDraft {
    return updateDisplay(agentConfig(items), { items: ['model-with-effort'] });
}

test('subagent NDJSON uses recent same-model effort by default and respects each instance override', async t => {
    const f = setup(t), runtimeRoot = join(f.root, 'runtime');
    let now = NOW;
    const runtime = { ...runtimeContext(f.root, { CLAUDE_STATUSLINE_RUNTIME_DIR: runtimeRoot }), nowMs: () => now };
    const run = (input: unknown, subagents = false) => render(() => JSON.stringify(input), {
        configDir: f.root, runtime, now: () => now / 1000,
    }, subagents, '120');
    const row = async (input = agentInput) => {
        const text = await run(input, true);
        assert.equal(text.split('\n').length, 2);
        const record = JSON.parse(text);
        assert.deepEqual(Object.keys(record), ['id', 'content']);
        assert.equal(record.id, inherited.id);
        return record.content as string;
    };
    const write = (config: DisplayDraft) => writeFileSync(join(f.root, CONFIG_FILENAME), JSON.stringify(config));
    const config = display();
    write(config);
    const saved = readFileSync(f.displayPath);
    assert(f.display().subagents.instances.every(node => !Object.hasOwn(node.options, 'effort_fallback')));
    assert.equal(await row(), 'sonnet-5');
    assert.equal(existsSync(runtimeRoot), false);
    const main = await run(mainInput);
    assert.equal(main, `${model} high\n`);
    assert.deepEqual(readFileSync(f.displayPath), saved);
    const cached = allFiles(runtimeRoot);
    assert.equal(await row(), 'sonnet-5/~high · ~high');
    assert.equal(await row({ ...agentInput, session_id: 'session-b' }), 'sonnet-5');
    for (const different of ['claude-sonnet-5[1m]', 'sonnet-5', 'CLAUDE-SONNET-5', ' claude-sonnet-5 ']) {
        assert.doesNotMatch(await row({ ...agentInput, tasks: [{ ...inherited, model: different }] }), /~/u);
    }
    assert.equal(await row({ ...agentInput, tasks: [{ ...inherited, effort: 32 }] }), 'sonnet-5/32 · 32');
    assert.equal(await row({ ...agentInput, tasks: [{ ...inherited, effort: '  ' }] }), 'sonnet-5/~high · ~high');
    assert.equal(await row({ ...agentInput, tasks: [{ ...inherited, effort: {} }] }), 'sonnet-5');
    assert.deepEqual(allFiles(runtimeRoot), cached);

    for (const type of ['model-with-effort', 'effort']) {
        const copy = newInstance(type, config.subagents.instances);
        copy.options.effort_fallback = 'off';
        config.subagents.instances.push(copy);
    }
    write(config);
    assert.equal(await row(), 'sonnet-5/~high · ~high · sonnet-5');
    assert.equal(await row({ ...agentInput, tasks: [{ ...inherited, effort: 'low' }] }), 'sonnet-5/low · low · sonnet-5/low · low');
    config.statusline_language = 'zh-CN';
    write(config);
    assert.equal(await row(), 'sonnet-5/~高 · ~高 · sonnet-5');
    for (const columns of [1, 4, 9, 12]) {
        const content = await row({ ...agentInput, columns });
        assert(displayWidth(content) <= columns);
        if (content.includes('高')) assert.match(content, /~高/u);
    }
    now += SESSION_EFFORT_TTL_MS;
    assert.equal(await row(), 'sonnet-5/~高 · ~高 · sonnet-5');
    now++;
    assert.equal(await row(), 'sonnet-5 · sonnet-5');
    await run(mainInput);
    now++;
    await run({ ...mainInput, effort: undefined });
    assert.equal(await row(), 'sonnet-5 · sonnet-5');
    assert.deepEqual(JSON.parse(readFileSync(cacheFile(runtimeRoot), 'utf8')).observations.map((record: { effort_level: unknown }) => record.effort_level), [null]);
    for (const node of config.subagents.instances) {
        if (node.type_id === 'model-with-effort' || node.type_id === 'effort') node.options.effort_fallback = 'off';
    }
    write(config);
    const before = allFiles(runtimeRoot);
    await run(mainInput);
    assert.equal(await row(), 'sonnet-5 · sonnet-5');
    assert.deepEqual(allFiles(runtimeRoot), before);
});

test('an active standalone effort instance can enable main observation publication on its own', async t => {
    const f = setup(t), runtimeRoot = join(f.root, 'runtime');
    const runtime = { ...runtimeContext(f.root, { CLAUDE_STATUSLINE_RUNTIME_DIR: runtimeRoot }), nowMs: () => NOW };
    const run = (input: unknown, subagents = false) => render(() => JSON.stringify(input), {
        configDir: f.root, runtime, now: () => NOW / 1000,
    }, subagents, '120');
    const config = display(['effort']);
    const standalone = config.subagents.instances.find(node => node.type_id === 'effort')!;
    const save = () => writeFileSync(f.displayPath, JSON.stringify(config));
    config.subagents.enabled = false;
    save();
    await run(mainInput);
    assert.equal(existsSync(runtimeRoot), false);
    config.subagents.enabled = true;
    standalone.enabled = false;
    save();
    await run(mainInput);
    assert.equal(existsSync(runtimeRoot), false);
    standalone.enabled = true;
    save();
    await run(mainInput);
    assert.equal(JSON.parse(await run(agentInput, true)).content, '~high');
    standalone.options.effort_fallback = 'off';
    save();
    await run({ ...mainInput, effort: { level: 'low' } });
    const cached = sessionEffortReader(runtime)(session);
    assert(cached.status === 'observed' && cached.observation.effort_level === 'high');
    assert.equal(JSON.parse(await run(agentInput, true)).content, '');
});

test('cache refuses older writes, isolates configuration namespaces and bounds retention', t => {
    const f = setup(t), runtimeRoot = join(f.root, 'runtime');
    let now = NOW;
    const context = { ...runtimeContext(f.root, { CLAUDE_STATUSLINE_RUNTIME_DIR: runtimeRoot }), nowMs: () => now };
    const peer = { ...context, configDir: join(f.root, 'peer') };
    const read = () => sessionEffortReader(context)(session);
    publishSessionEffort(context, mainInput, now);
    publishSessionEffort(peer, { ...mainInput, effort: { level: 'low' } }, now);
    assert.equal(read().status, 'observed');
    const other = sessionEffortReader(peer)(session);
    assert(other.status === 'observed' && other.observation.effort_level === 'low');
    const previous = read();
    publishSessionEffort(context, { ...mainInput, effort: { level: 'max' } }, now - 1);
    assert.deepEqual(read(), previous);
    now--;
    assert.equal(read().status, 'invalid_field');
    publishSessionEffort(context, { ...mainInput, effort: { level: 'max' } }, now);
    const current = read();
    assert(current.status === 'observed' && current.observation.effort_level === 'max');
    for (let i = 0; i < 103; i++) {
        now++;
        publishSessionEffort(context, { ...mainInput, session_id: 'retained-' + i }, now);
    }
    assert.equal(read().status, 'not_observed');
    assert.equal(sessionEffortReader(context)('retained-102').status, 'observed');
    assert.equal(JSON.parse(readFileSync(cacheFile(runtimeRoot), 'utf8')).observations.length, 100);
});

test('an overlapping CLI publisher keeps rendering when the cache lock is held', async t => {
    const f = setup(t), runtimeRoot = join(f.root, 'runtime');
    const runtime = runtimeContext(f.root, { CLAUDE_STATUSLINE_RUNTIME_DIR: runtimeRoot });
    writeFileSync(f.displayPath, JSON.stringify(display()));
    publishSessionEffort(runtime, mainInput, Date.now());
    const path = cacheFile(runtimeRoot), before = readFileSync(path);
    const held = lock(join(runtimeRoot, 'session-effort', 'observations.lock'));
    try {
        const childInput = { ...mainInput, effort: { level: 'max' } };
        const moduleUrl = new URL('../src/rendering/main.js', import.meta.url).href;
        const script = 'const {render}=await import(process.argv[1]); process.stdout.write(await render(() => process.argv[2]));';
        const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            execFile(process.execPath, ['--input-type=module', '-e', script, moduleUrl, JSON.stringify(childInput)], {
                timeout: 5000, env: { ...process.env, CLAUDE_CONFIG_DIR: f.root, CLAUDE_STATUSLINE_RUNTIME_DIR: runtimeRoot },
            }, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
        });
        assert.match(result.stdout, /max/u);
        assert.equal(result.stderr, '');
        assert.deepEqual(readFileSync(path), before);
    } finally { held(); }
});

test('diagnosis reports actual effort provenance and historical limits without changing cache bytes or modes', async t => {
    const f = setup(t), runtimeRoot = join(f.root, 'runtime'), path = cacheFile(runtimeRoot);
    const runtime = { ...runtimeContext(f.root, { CLAUDE_STATUSLINE_RUNTIME_DIR: runtimeRoot }), nowMs: () => NOW + 2 * SESSION_EFFORT_TTL_MS };
    publishSessionEffort({ ...runtime, nowMs: () => NOW }, mainInput, NOW);
    const before = allFiles(f.root), draft = { display: display(), host: DEFAULT_HOST };
    const adapter = await diagnosisAdapter(f.service, { runtime });
    const input = { ...agentInput, tasks: [inherited, task({ id: 'explicit', effort: 18 }), task({ id: 'other', model: 'other', effort: null })] };
    const at = (now: number) => new Date(now).toISOString();
    const inspect = (time: number, include_local = true) => {
        const result = adapter({ draft, scope: 'subagent', width: 120, input, observed_at: at(time), include_local });
        parseResponse('diagnose', { exitCode: 0, stdout: JSON.stringify({ protocol_version: PROTOCOL_VERSION, result }), stderr: '' });
        return { output: result.output[0]!.spans.map(span => span.text).join(''),
            evidence: result.instances.filter(node => node.enabled).map(node => node.evidence.filter(e => e.source !== 'supplied_input')) };
    };
    const matched = inspect(NOW + 1);
    assert.equal(matched.output, 'sonnet-5/~high · ~high');
    assert.deepEqual(matched.evidence[0], matched.evidence[1]);
    assert.deepEqual(matched.evidence[0]!.map(({ source, scope, status, observed_at }) => [source, scope, status, observed_at]), [
        ['inherited_session', 'subagent:task-1', 'observed', at(NOW)],
        ['configured', 'subagent:explicit', 'observed', at(NOW + 1)],
        ['unavailable', 'subagent:other', 'association_unavailable', at(NOW)],
    ]);
    for (const [time, includeLocal, status] of [
        [NOW + 1, false, 'input_only'], [NOW - 1, true, 'newer_than_input'], [NOW + SESSION_EFFORT_TTL_MS + 1, true, 'stale'],
    ] as const) {
        const result = inspect(time, includeLocal);
        assert.equal(result.output, 'sonnet-5');
        for (const evidence of result.evidence) {
            assert.equal(evidence[0]!.source, 'unavailable');
            assert.equal(evidence[0]!.status, status);
            assert.equal(evidence[1]!.source, 'configured');
        }
    }
    const preview = await previewAdapter();
    const previewRows = () => preview(draft, 120).subagents.map(row => row.map(span => span.text).join(''));
    assert.deepEqual(previewRows(), ['sonnet-5/high · high', 'opus/~high · ~high']);
    draft.display.subagents.instances.find(node => node.type_id === 'effort')!.options.effort_fallback = 'off';
    const mixed = inspect(NOW + 1);
    assert.equal(mixed.output, 'sonnet-5/~high');
    assert.equal(mixed.evidence[0]![0]!.source, 'inherited_session');
    assert.equal(mixed.evidence[1]![0]!.source, 'unavailable');
    assert.equal(mixed.evidence[1]![0]!.status, 'not_observed');
    assert.equal(mixed.evidence[1]![1]!.source, 'configured');
    draft.display.subagents.instances.find(node => node.type_id === 'model-with-effort')!.options.effort_fallback = 'off';
    assert.deepEqual(previewRows(), ['sonnet-5/high · high', 'opus']);
    assert.deepEqual(allFiles(f.root), before);
    writeFileSync(path, '{ corrupt', { mode: 0o600 });
    draft.display = display();
    assert.equal(inspect(NOW + 1).evidence[0]![0]!.status, 'invalid_field');
    assert.equal(readFileSync(path, 'utf8'), '{ corrupt');
    publishSessionEffort(runtime, mainInput, runtime.nowMs());
    if (process.platform !== 'win32') assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(sessionEffortReader(runtime)(session).status, 'observed');
});

test('instance CLI persists both effort fallback modes for each eligible type', t => {
    const f = setup(t);
    writeFileSync(f.displayPath, JSON.stringify(display()));
    const set = (scope: 'main' | 'subagent', id: string, value: string) => spawnSync(process.execPath,
        [entry, 'config', '--config-dir', f.root, 'instance', scope, 'set', id, 'effort-fallback', value], { encoding: 'utf8', timeout: 5000 });
    for (const type of ['model-with-effort', 'effort']) {
        for (const value of ['off', 'session']) {
            const result = set('subagent', type, value);
            assert.equal(result.status, 0, result.stderr);
            assert.equal(f.display().subagents.instances.find(node => node.id === type)!.options.effort_fallback, value);
        }
        assert.equal(set('subagent', type, 'auto').status, 2);
    }
    assert.equal(set('main', 'model-with-effort', 'off').status, 2);
    assert.equal(set('subagent', 'name', 'off').status, 2);
});
