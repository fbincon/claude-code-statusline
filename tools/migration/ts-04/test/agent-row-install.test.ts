import test from 'node:test';
import { text } from '@fbincon/statusline-core/i18n/messages';
import { AGENT_ROWS, OWNER_FILE } from '@fbincon/statusline-cli/integration/model';
import { AGENT_ROW_ROUTE_FILE, readAgentRowRoute } from '@fbincon/statusline-cli/integration/agent-row-route';
import { BINDING_FILE } from '@fbincon/statusline-cli/integration/ownership';
import { refreshIntents } from '@fbincon/statusline-cli/recovery/journal';
import { recover } from '@fbincon/statusline-cli/recovery/service';
import { assert, doctor, fresh, fs, join, snapshot } from './install-support.js';

const rowsOnly = { native: false, external: false, nativeTiming: false, liveMetrics: false };

test('a new modern installation binds only the row Mod and repeats without rotating its generation', t => {
    const f = fresh(t, [2, 1, 332]);
    const preview = f.install({ ...rowsOnly, dryRun: true });
    assert(preview.changedPaths.includes(join(f.root, AGENT_ROW_ROUTE_FILE)));
    assert(!fs.existsSync(f.root));
    assert.equal(f.agentRows.calls.length, 0);
    assert.equal(f.install(rowsOnly).failed, false);
    const row = readAgentRowRoute(f.root)!;
    assert.equal(row.mode, 'mod');
    assert.equal(f.agentRows.inputs.installationId, row.installationId);
    assert.equal(f.agentRows.listing()[1][0]!.enabled, true);
    assert.equal(f.json('settings.json').subagentStatusLine, undefined);
    assert.equal(f.runtime.calls.length, 0);
    assert.equal(f.host.calls.length, 0);
    const before = snapshot(f.root);
    const diagnostics = doctor(f.context);
    assert.deepEqual(diagnostics.filter(row => row.level === 'ERROR'), []);
    const messages = diagnostics.flatMap(row => typeof row.message === 'string' ? [] : [row.message]);
    assert.deepEqual(messages.find(message => message.key === 'agent_rows.doctor.disk')?.params, { state: text('agent_rows.disk.verified') });
    const unobserved = text('diagnose.status.not_observed');
    assert.deepEqual(messages.find(message => message.key === 'agent_rows.doctor.evidence')?.params, { loaded: unobserved, verified: unobserved });
    assert.deepEqual(snapshot(f.root), before);
    assert.equal(f.install().changed, false);
    assert.deepEqual(snapshot(f.root), before);
});

test('an old callback stays owned and active throughout the standby installation', t => {
    const f = fresh(t, [2, 1, 322]);
    assert.equal(f.install(rowsOnly).failed, false);
    const legacy = f.json('settings.json').subagentStatusLine;
    assert(legacy.command);
    assert.equal(readAgentRowRoute(f.root), null);
    f.context.version = [2, 1, 326];
    assert.equal(f.install().failed, false);
    const staging = readAgentRowRoute(f.root)!;
    assert.equal(staging.mode, 'standby');
    assert.equal(f.agentRows.inputs.installationId, staging.installationId);
    assert.deepEqual(f.json('settings.json').subagentStatusLine, legacy);
    assert.equal(f.install().changed, false);
    assert.equal(readAgentRowRoute(f.root)?.installationId, staging.installationId);
});

test('the three callback-gap hosts remove an owned legacy setting and retain lifecycle hooks', t => {
    const f = fresh(t, [2, 1, 322]);
    f.install(rowsOnly);
    for (const patch of [323, 324, 325]) {
        f.context.version = [2, 1, patch];
        assert.equal(f.install().failed, false);
        const settings = f.json('settings.json');
        assert.equal(settings.subagentStatusLine, undefined);
        for (const event of ['SubagentStart', 'SubagentStop']) assert.equal(settings.hooks[event].length, 1);
        const before = snapshot(f.root);
        assert.throws(() => f.install({ subagentRenderer: 'mod' }));
        assert.throws(() => f.install({ subagentRenderer: 'legacy' }));
        assert.deepEqual(snapshot(f.root), before);
    }
    assert.equal(f.agentRows.calls.length, 0);
});

test('explicit Mod installation failure restores a previously selected legacy route', t => {
    const f = fresh(t, [2, 1, 332]);
    assert.equal(f.install({ ...rowsOnly, subagentRenderer: 'legacy' }).failed, false);
    const prior = f.read(AGENT_ROW_ROUTE_FILE);
    const old = f.json('settings.json').subagentStatusLine;
    f.agentRows.refused = 'validate';
    assert.equal(f.install({ subagentRenderer: 'mod' }).failed, true);
    assert.deepEqual(f.read(AGENT_ROW_ROUTE_FILE), prior);
    assert.deepEqual(f.json('settings.json').subagentStatusLine, old);
});

test('auto falls back to legacy only on a host known to execute it', t => {
    for (const [patch, expected] of [[332, 'legacy'], [333, 'builtin']] as const) {
        const f = fresh(t, [2, 1, patch]);
        f.agentRows.refused = 'validate';
        assert.equal(f.install(rowsOnly).failed, true);
        assert.equal(readAgentRowRoute(f.root)?.mode, expected);
        assert.equal(Boolean(f.json('settings.json').subagentStatusLine), expected === 'legacy');
    }
});

test('foreign rendering and an explicit plugin opt-out survive installation and removal', t => {
    const f = fresh(t, [2, 1, 332]);
    const other = { type: 'command', command: '"/elsewhere/claude-statusline" render-subagents' };
    f.put('settings.json', { subagentStatusLine: other });
    assert.equal(f.install(rowsOnly).failed, false);
    assert.deepEqual(f.json('settings.json').subagentStatusLine, other);
    assert.equal(f.agentRows.calls.length, 0);
    assert.throws(() => f.install({ force: true, subagentRenderer: 'mod' }));
    assert.deepEqual(f.json('settings.json').subagentStatusLine, other);
    const disabled = f.json('settings.json');
    delete disabled.subagentStatusLine;
    disabled.enabledPlugins = { [AGENT_ROWS.plugin]: false };
    f.put('settings.json', disabled);
    assert.equal(f.install().failed, false);
    assert.equal(readAgentRowRoute(f.root)?.reason, 'mod-disabled');
    assert.equal(f.agentRows.calls.length, 0);
    assert.equal(f.json('settings.json').enabledPlugins[AGENT_ROWS.plugin], false);
    assert.equal(f.uninstall().failed, false);
    assert.equal(readAgentRowRoute(f.root)?.reason, 'mod-disabled');
    assert.equal(f.json('settings.json').enabledPlugins[AGENT_ROWS.plugin], false);
});

test('uninstall releases only owned agent-row files and remembers a disabled installed Mod', t => {
    const f = fresh(t, [2, 1, 330]);
    assert.equal(f.install(rowsOnly).failed, false);
    f.agentRows.enabled(false);
    const note = f.put(AGENT_ROWS.name + '/mine.txt', Buffer.from('keep'));
    assert.equal(f.uninstall().failed, false);
    assert.equal(fs.readFileSync(note, 'utf8'), 'keep');
    assert.equal(readAgentRowRoute(f.root)?.reason, 'mod-disabled');
    assert.equal(f.agentRows.plugins.length, 0);
    assert.equal(f.agentRows.markets.length, 0);
});

test('a newer row Mod ownership protocol blocks removal without changing the plugin', t => {
    const f = fresh(t, [2, 1, 332]);
    assert.equal(f.install(rowsOnly).failed, false);
    const path = join(AGENT_ROWS.name, OWNER_FILE);
    f.put(path, { ...f.json(path), protocol_version: AGENT_ROWS.protocol + 1 });
    const before = snapshot(f.root);
    assert.equal(f.uninstall().failed, true);
    assert.deepEqual(snapshot(f.root), before);
    assert.equal(f.agentRows.listing()[1][0]?.enabled, true);
});

for (const stage of ['disabled', 'temporarily-enabled', 'not-reinstalled'] as const)
    test('row refresh recovery restores the disabled preference after ' + stage, t => {
        const f = fresh(t, [2, 1, 332]);
        assert.equal(f.install(rowsOnly).failed, false);
        f.agentRows.enabled(false);
        f.put(BINDING_FILE, { ...f.json(BINDING_FILE), refresh_disabled: [AGENT_ROWS.name] });
        if (stage === 'temporarily-enabled') f.agentRows.enabled(true);
        if (stage === 'not-reinstalled') f.agentRows.run(['uninstall', AGENT_ROWS.plugin, '--scope', 'user']);
        const before = snapshot(f.root);
        assert.equal(recover(f.context, true).changed, false);
        assert.deepEqual(snapshot(f.root), before);
        f.agentRows.calls.length = 0;
        assert.equal(recover(f.context).changed, true);
        assert.deepEqual(refreshIntents(f.root), []);
        assert.equal(readAgentRowRoute(f.root)?.reason, 'mod-disabled');
        assert(f.json('settings.json').subagentStatusLine?.command);
        assert.equal(f.agentRows.listing()[1][0]?.enabled, stage === 'not-reinstalled' ? undefined : false);
        assert.equal(f.agentRows.calls.some(call => ['install', 'enable'].includes(call.args[0]!)), false);
        assert.equal(recover(f.context).changed, false);
    });

test('ordinary install can finish a disabled row refresh with a stored forced renderer', t => {
    const f = fresh(t, [2, 1, 332]);
    assert.equal(f.install({ ...rowsOnly, subagentRenderer: 'mod' }).failed, false);
    f.agentRows.enabled(false);
    f.put(BINDING_FILE, { ...f.json(BINDING_FILE), refresh_disabled: [AGENT_ROWS.name] });
    const result = f.install();
    assert.equal(result.changed, true);
    assert.equal(result.failed, false);
    assert.equal(f.agentRows.listing()[1][0]?.enabled, false);
    assert.equal(readAgentRowRoute(f.root)?.preference, 'mod');
    assert.deepEqual(refreshIntents(f.root), []);
});
