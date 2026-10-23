import test from 'node:test';
import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setup, assert, join, repo, existsSync, readdirSync, readFileSync, writeFileSync, jsonBytes, legacy, selected } from './final-support.js';
import { invoke } from './final-cli-support.js';
import { defaultDisplay, validateDisplay, defaultItem, SCHEMA_VERSION } from '@fbincon/statusline-core/config/display';
import { ROWS, applyPreset } from '@fbincon/statusline-core/config/presets';
import { updateDisplay, edit } from '@fbincon/statusline-core/config/instances';
import { conflicts } from '@fbincon/statusline-core/config/catalog';
import { selectedItems } from '../src/config/operations.js';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { strip } from '@fbincon/statusline-core/rendering/layout';
import { renderEnvironment } from '../src/rendering/environment.js';
import { runtimeContext } from '../src/runtime/context.js';
import { loadRuntime } from '../src/config/backend-preferences.js';
test('tests.config.test_transfer.TransferTests.test_all_presets_are_editable_and_preserve_unrelated_appearance', t => {
    const f = setup(t), original = updateDisplay(defaultDisplay(), { use_colors: false, palette: 'ansi', directory_style: 'home' });
    let serial = 0;
    for (const name of ['developer','minimal','monitoring','multi-agent','left-right','repeated-metrics']) {
        const display = applyPreset(original, name, () => 'unique-' + serial++);
        assert.deepEqual(validateDisplay(display), display);
        assert.equal(display.use_colors, false);
        assert.equal(display.palette, 'ansi');
        assert.equal(display.directory_style, 'home');
        assert.equal(display.formatting.model_name, 'short');
        assert.equal(display.formatting.number_format, 'compact');
        assert.deepEqual(selected(updateDisplay(display, { separator_style: 'compact' })), selected(display));
    }
    const multi = applyPreset(original, 'multi-agent', () => 'unused');
    assert.equal(multi.subagents.hide_completed, true);
    assert.equal(multi.subagents.row_limit, 6);
    assert.equal(multi.subagents.task_max_width, 48);
    const draft = f.read().draft, result = f.call('preset', { draft, preset: 'developer' });
    assert.equal(result.status, 0);
    assert.deepEqual(result.response.result.draft.host, draft.host);
    assert.ok(!existsSync(f.displayPath));
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_aliases_normalize_layout_and_options_without_dropping_settings', t => {
    const f = setup(t), value = legacy(7);
    Object.assign(value, { items: ['prompt-timer'], item_options: { 'prompt-timer': { ...defaultItem(), max_width: 20, priority: 15 } }, layout: { mode: 'explicit', rows: [['prompt-timer']] } });
    const parsed = validateDisplay(value);
    assert.deepEqual(selected(parsed), ['task-timer']);
    assert.deepEqual(parsed.layout.rows, [['task-timer']]);
    const node = parsed.instances.find(n => n.id === 'task-timer')!;
    assert.equal(node.options.max_width, 20);
    assert.equal(node.options.priority, 15);
    assert.ok(!existsSync(f.displayPath));
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_aliases_work_in_item_mutations_and_explicit_layouts', async (t) => {
    const f = setup(t);
    for (const args of [['set-items', 'task-timer'], ['item', 'main', 'prompt-timer', 'label', 'Task'], ['layout', 'explicit', 'prompt-timer']])
        assert.equal((await invoke(['config', ...args], f.context)).status, 0);
    const value = f.display(), enabled = new Set(selected(value));
    assert.deepEqual(selected(value), ['task-timer']);
    assert.deepEqual(value.layout.rows.map(row => row.filter(id => enabled.has(id))), [['task-timer']]);
    assert.equal(value.instances.find(n => n.id === 'task-timer')!.options.label, 'Task');
    const original = readFileSync(f.displayPath);
    for (const args of [['set-items', 'prompt-timer', 'task-timer'], ['layout', 'explicit', 'prompt-timer,task-timer']])
        assert.equal((await invoke(['config', ...args], f.context)).status, 2);
    assert.deepEqual(readFileSync(f.displayPath), original);
    const old = legacy(7);
    old.items = ['task-timer'];
    old.item_options = { 'prompt-timer': defaultItem(), 'task-timer': defaultItem() };
    assert.throws(() => validateDisplay(old), ConfigError);
});
test('tests.runtime.test_task_timing.TaskTimingTests.test_invalid_preferences_hide_derived_timers_and_remain_diagnosable', async (t) => {
    const f = setup(t), path = join(f.root, 'claude-statusline-runtime.json'), bytes = Buffer.from('{"schema_version":2}');
    writeFileSync(path, bytes);
    const data = { session_id: 's' }, config = selectedItems(defaultDisplay(), 'main', 'set-items', ['task-active-timer', 'run-state']);
    const env = await renderEnvironment(config, data, { runtime: runtimeContext(f.root) });
    assert.equal(env.activePoint(data).reason, 'source_unavailable');
    assert.ok(Object.values(env.live(data, 0)).every((point: any) => point.reason === 'source_unavailable'));
    assert.throws(() => loadRuntime(f.root), ConfigError);
    assert.deepEqual(readFileSync(path), bytes);
    // The installer doctor's formatted diagnostics are owned by TS-04.
});
test('tests.rendering.test_statusline_git.GitIntegrationTests.test_end_to_end_statusline_uses_live_directory_for_dir_and_git', t => {
    const f = setup(t), live = join(f.root, 'live'), launch = join(f.root, 'launch');
    mkdirSync(live);
    mkdirSync(launch);
    const git = (...args: string[]) => { const r = spawnSync('git', ['-C', live, ...args], { encoding: 'utf8', timeout: 10000 }); assert.equal(r.status, 0, r.stderr); };
    git('init', '-q', '-b', 'live-branch');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + join(f.root, 'no-hooks'), 'commit', '-q', '--allow-empty', '-m', 'initial');
    const result = spawnSync(process.execPath, [join(repo, 'packages/cli/dist/src/entry.js'), 'render'], { encoding: 'utf8', timeout: 20000, input: JSON.stringify({ model: { id: 'test-model' }, cwd: live, workspace: { current_dir: live, project_dir: launch } }), env: { ...process.env, CLAUDE_CONFIG_DIR: join(f.root, 'config'), COLUMNS: '1000' } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    const plain = strip(result.stdout.trim()), segments = plain.split(' | ');
    assert.equal(segments[1], live);
    assert.equal(segments[2], 'Git live-branch');
    assert.ok(!plain.includes(launch));
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_external_and_client_saves_conflict_in_both_orders', t => {
    const f = setup(t, true);
    for (const clientFirst of [false, true]) {
        const client = f.read(), external = f.read();
        external.draft.host.padding = client.draft.host.padding === 2 ? 3 : 2;
        client.draft.display.use_colors = !client.draft.display.use_colors;
        const settings = JSON.parse(readFileSync(f.settingsPath, 'utf8'));
        settings.permissions.allow.push('Glob');
        writeFileSync(f.settingsPath, jsonBytes(settings));
        if (clientFirst)
            assert.equal(f.save(client).status, 0);
        else
            assert.equal(f.service.apply(external.draft, external.revision).changed, true);
        const before = [readFileSync(f.settingsPath), readFileSync(f.displayPath)], files = readdirSync(f.root, { recursive: true });
        if (clientFirst)
            assert.throws(() => f.service.apply(external.draft, external.revision), (error: unknown) => error instanceof ConfigError && error.code === 'configuration_conflict');
        else {
            const result = f.save(client);
            assert.equal(result.status, 2);
            assert.equal(result.response.error.code, 'configuration_conflict');
        }
        assert.deepEqual([readFileSync(f.settingsPath), readFileSync(f.displayPath)], before);
        assert.deepEqual(readdirSync(f.root, { recursive: true }), files);
        assert.ok(JSON.parse(readFileSync(f.settingsPath, 'utf8')).permissions.allow.includes('Glob'));
    }
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_legacy_draft_error_tracks_the_supported_schema_without_writes', t => {
    const f = setup(t, true), current = f.read(), before = readFileSync(f.settingsPath), files = readdirSync(f.root);
    f.io.lock = () => assert.fail('A rejected legacy draft must not acquire the write lock');
    for (let version = 1; version < SCHEMA_VERSION; version++) {
        const result = f.call('apply', { draft: { ...current.draft, display: legacy(version) }, expected_revision: current.revision });
        assert.equal(result.status, 2);
        assert.equal(result.response.error.code, 'invalid_configuration');
        assert.equal(result.response.error.message, `apply requires the complete schema v${SCHEMA_VERSION} draft returned by read`);
    }
    assert.deepEqual(readFileSync(f.settingsPath), before);
    assert.deepEqual(readdirSync(f.root), files);
    assert.ok(!existsSync(f.displayPath));
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_bound_entry_uses_its_own_identity', async (t) => {
    const f = setup(t, true), request = JSON.stringify({ protocol_version: 17, operation: 'read', payload: {} });
    const result = await invoke(['ui'], { ...f.context, stdin: () => request });
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.equal(JSON.parse(result.stdout).result.installed, true);
    const foreign = await invoke(['ui'], { ...f.context, launch: { executable: process.execPath, args: [join(f.root, 'different-entry.js')] }, stdin: () => request });
    assert.equal(foreign.status, 0);
    assert.equal(JSON.parse(foreign.stdout).result.installed, false);
    assert.equal(JSON.parse(foreign.stdout).result.installation.statusLine.state, 'foreign');
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_cli_curses_and_json_apply_equivalence', async (t) => {
    const f = setup(t, true), initial = readFileSync(f.settingsPath), outputs = [];
    for (const frontend of ['cli', 'service', 'json']) {
        writeFileSync(f.settingsPath, initial);
        rmSync(f.displayPath, { force: true });
        if (frontend === 'cli') {
            const result = await invoke(['config', 'apply', '--items', 'git', 'model-with-effort', '--colors', 'off', '--palette', 'ansi', '--directory-style', 'basename', '--separator-style', 'compact', '--scope-labels', 'always', '--subagent-items', 'status', 'name', 'elapsed', '--subagent-statusline', 'off', '--padding', '4', '--refresh-interval', 'event', '--hide-vim-mode-indicator', 'on'], f.context);
            assert.equal(result.status, 0, result.stderr);
        }
        else {
            const current = f.read();
            let display = selectedItems(current.draft.display, 'main', 'set-items', ['git', 'model-with-effort']);
            display = selectedItems(display, 'subagent', 'set-items', ['status', 'name', 'elapsed']);
            current.draft = { display: updateDisplay(display, { use_colors: false, palette: 'ansi', directory_style: 'basename', separator_style: 'compact', scope_labels: 'always', subagents: { ...display.subagents, enabled: false } }), host: { padding: 4, refresh_interval: 'event', hide_vim_mode_indicator: true } };
            if (frontend === 'json')
                assert.equal(f.save(current).status, 0);
            else
                f.service.apply(current.draft, current.revision);
        }
        outputs.push([f.read().draft, JSON.parse(readFileSync(f.settingsPath, 'utf8'))]);
    }
    assert.deepEqual(outputs[0], outputs[1]);
    assert.deepEqual(outputs[1], outputs[2]);
    // Real external-TUI draft wiring is retained as a TS-04 handoff assertion.
});
test('tests.ui.test_apply_protocol.ApplyProtocolTests.test_curses_expected_snapshot_protects_subagent_owner', t => {
    const f = setup(t, true), current = f.read(), changed = JSON.parse(readFileSync(f.settingsPath, 'utf8'));
    changed.subagentStatusLine.command = 'foreign-renderer';
    writeFileSync(f.settingsPath, jsonBytes(changed));
    const before = readFileSync(f.settingsPath);
    assert.throws(() => f.service.apply(current.draft, current.revision), (error: unknown) => error instanceof ConfigError && error.code === 'configuration_conflict');
    assert.deepEqual(readFileSync(f.settingsPath), before);
    assert.ok(!existsSync(f.displayPath));
});
test('TS-04 wizard and keyboard handoff retains tested core conflicts and spacer moves', () => {
    assert.equal(conflicts('subagent', ['status-elapsed', 'elapsed']), true);
    assert.equal(conflicts('subagent', ['status', 'elapsed']), false);
    const nodes = ['model', 's1', 'git', 's2'].map(id => ({ id, type_id: id.startsWith('s') ? 'spacer' : id, enabled: true, options: defaultItem(), text: null }));
    const display = updateDisplay(defaultDisplay(), { instances: nodes, layout: { mode: 'explicit', rows: [['model', 's1'], ['git', 's2']] } });
    const before = structuredClone(display);
    assert.throws(() => edit(display, 'main', { action: 'move', id: 's1', after: 's2' }, () => 'unused'), ConfigError);
    assert.deepEqual(display, before);
});
