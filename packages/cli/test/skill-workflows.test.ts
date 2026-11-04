import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DisplayDraft, Scope } from '@fbincon/statusline-core/contracts/ui';
import { defaultDisplay, validateDisplay } from '@fbincon/statusline-core/config/display';
import { PROFILES_FILENAME } from '@fbincon/statusline-core/config/profiles';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { commandFor } from '@fbincon/statusline-platform/commands';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { ConfigurationService } from '../src/config/service.js';
import { ProfileService } from '../src/config/profiles.js';
import { createStorage, jsonBytes } from '../src/config/storage.js';
import { configCommand } from '../src/config/commands.js';
import { handlePayload } from '../src/integration/slash-hook.js';

function fixture(t: TestContext, display = defaultDisplay()) {
    const configDir = fs.mkdtempSync(join(tmpdir(), 'statusline-skill 中文 '));
    t.after(() => { removeTree(configDir); assert.equal(fs.existsSync(configDir), false); });
    const launch = { executable: process.execPath, args: [fileURLToPath(new URL('../src/entry.js', import.meta.url))] };
    const context = { configDir, launch, hostVersion: () => [2, 1, 296] };
    const displayPath = join(configDir, 'claude-statusline.json'), settingsPath = join(configDir, 'settings.json');
    fs.writeFileSync(displayPath, jsonBytes(validateDisplay(display)), { mode: 0o600 });
    fs.writeFileSync(settingsPath, jsonBytes({
        statusLine: { type: 'command', command: commandFor(launch, 'render') },
        subagentStatusLine: { type: 'command', command: commandFor(launch, 'render-subagents') },
    }), { mode: 0o600 });
    const service = new ConfigurationService(context, createStorage());
    service.read();
    return { configDir, context, service, displayPath, settingsPath };
}
function files(directory: string): Record<string, { bytes: string; mode: number }> {
    const result: Record<string, { bytes: string; mode: number }> = {};
    function visit(path: string): void {
        for (const entry of fs.readdirSync(path, { withFileTypes: true })) {
            const target = join(path, entry.name), name = relative(directory, target).split(sep).join('/');
            if (entry.isDirectory()) visit(target);
            else if (!['statusline_runtime/install.lock', 'statusline_runtime/admin.lock'].includes(name))
                result[name] = { bytes: fs.readFileSync(target).toString('hex'), mode: fs.statSync(target).mode & 0o777 };
        }
    }
    visit(directory);
    return result;
}
function backups(directory: string): string[] {
    const path = join(directory, 'backups', 'statusline');
    return fs.existsSync(path) ? fs.readdirSync(path).sort() : [];
}
function applyArguments(display: DisplayDraft, omitted?: { scope: Scope; id: string }, padding = 0): string[] {
    const items = (scope: Scope) => (scope === 'main' ? display.instances : display.subagents.instances)
        .filter(node => node.enabled && !(omitted?.scope === scope && omitted.id === node.id)).map(node => node.type_id);
    return ['apply', '--items', ...items('main'), '--subagent-items', ...items('subagent'),
        '--subagent-statusline', display.subagents.enabled ? 'on' : 'off', '--scope-labels', display.scope_labels,
        '--statusline-language', display.statusline_language, '--colors', display.use_colors ? 'on' : 'off',
        '--palette', display.palette, '--directory-style', display.directory_style, '--separator-style', display.separator_style,
        '--padding', String(padding), '--refresh-interval', 'event', '--hide-vim-mode-indicator', 'off'];
}

test('guided apply changes the user default and shared host fields while retaining a bound profile and unasked appearance', t => {
    const original = defaultDisplay();
    original.palette = 'ansi'; original.theme = 'blossom';
    original.instances[0]!.options.label = 'Current user label 中文';
    const f = fixture(t, original), profiles = new ProfileService(f.service), project = join(f.configDir, 'bound project');
    fs.mkdirSync(project);
    profiles.mutate({ action: 'save', name: 'Daily', display: original, bind_path: project, expected_revision: profiles.read().revision });
    const profilePath = join(f.configDir, PROFILES_FILENAME), beforeProfile = files(f.configDir)[PROFILES_FILENAME], beforeBackups = backups(f.configDir);
    const candidate = structuredClone(original); candidate.use_colors = false;
    configCommand(applyArguments(candidate, undefined, 2), f.service);
    const user = JSON.parse(configCommand(['show', '--json'], f.service)), bound = profiles.readTarget({ kind: 'project', path: project });
    assert.equal(user.scope, 'user');
    assert.equal(user.display.use_colors, false);
    assert.equal(user.host.padding, 2);
    assert.equal(bound.display.use_colors, true);
    assert.equal(bound.host.padding, 2);
    assert.equal(bound.configuration.reason, 'profile');
    assert.equal(user.display.palette, 'ansi');
    assert.equal(user.display.theme, 'blossom');
    assert.deepEqual(user.display.instances, original.instances);
    assert.deepEqual(files(f.configDir)[PROFILES_FILENAME], beforeProfile);
    assert.ok(fs.existsSync(profilePath));
    assert.equal(backups(f.configDir).length, beforeBackups.length + 1, 'All guided answers must share one configuration transaction');
    const unbound = join(f.configDir, 'unbound project'); fs.mkdirSync(unbound);
    assert.equal(profiles.readTarget({ kind: 'project', path: unbound }).display.use_colors, false);
});

test('incompatible type selection retains grouped and aligned configuration bytes, modes and backups', t => {
    for (const kind of ['main-group', 'subagent-group', 'alignment'] as const) {
        const display = defaultDisplay();
        let omitted: { scope: Scope; id: string }, expected: string;
        if (kind === 'main-group') {
            display.groups = [{ id: 'quota', member_ids: ['five-hour-limit', 'weekly-limit'], primary_id: 'five-hour-limit', link_visibility: true, shared_powerline: false }];
            omitted = { scope: 'main', id: 'weekly-limit' }; expected = 'composition.groups.invalid';
        } else if (kind === 'subagent-group') {
            display.subagents.groups = [{ id: 'identity', member_ids: ['status-elapsed', 'name'], primary_id: 'status-elapsed', link_visibility: true, shared_powerline: false }];
            omitted = { scope: 'subagent', id: 'name' }; expected = 'composition.groups.invalid';
        } else {
            const ids = display.instances.map(node => node.id);
            display.layout = { mode: 'explicit', rows: [ids.slice(0, 5), ids.slice(5)], alignments: [{ id: 'summary', columns: [[{ kind: 'instance', id: 'current-dir' }, { kind: 'instance', id: 'tokens' }]] }] };
            omitted = { scope: 'main', id: 'current-dir' }; expected = 'alignment.references';
        }
        const f = fixture(t, display), before = files(f.configDir), beforeBackups = backups(f.configDir);
        assert.throws(() => configCommand(applyArguments(display, omitted), f.service), (error: unknown) => {
            assert.ok(error instanceof ConfigError); assert.equal(error.key, expected); assert.equal(error.code, 'invalid_configuration');
            if (kind === 'alignment') assert.deepEqual(error.params, { ids: 'summary' });
            return true;
        });
        assert.deepEqual(files(f.configDir), before, kind);
        assert.deepEqual(backups(f.configDir), beforeBackups, kind);
    }
});

test('advanced slash commands use the same literal arguments and saved display as terminal configuration', async t => {
    const terminal = fixture(t), hook = fixture(t), label = 'Label 中文 ; $(echo no) `value`';
    for (const args of [
        ['item', 'main', 'model-with-effort', 'foreground', 'ansi:5'],
        ['instance', 'main', 'set', 'model-with-effort', 'label', label],
        ['group', 'main', 'list', '--json'], ['alignment', 'list', '--json'], ['layout', 'auto'], ['preset', 'minimal'],
    ]) {
        const expected = configCommand(args, terminal.service);
        const command_args = args.map(value => "'" + value.replaceAll("'", "'\\''") + "'").join(' ');
        const response = await handlePayload({ hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', command_name: 'statusline-config', command_args }, hook.context);
        assert.ok(response);
        const actual = JSON.parse(response);
        assert.equal(actual.decision, 'block');
        assert.deepEqual(hook.service.read().display, terminal.service.read().display);
        if (args[0] === 'instance') assert.equal(hook.service.read().display.instances[0]!.options.label, label);
        if (['group', 'alignment'].includes(args[0]!)) assert.equal(actual.reason, expected);
    }
    const before = files(hook.configDir);
    for (const command_args of ['profile list', 'project list']) {
        const result = JSON.parse((await handlePayload({ hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', command_name: 'statusline-config', command_args }, hook.context))!);
        assert.equal(result.decision, 'block');
        assert.ok(result.reason.includes('was not changed'));
    }
    assert.deepEqual(files(hook.configDir), before);
});
