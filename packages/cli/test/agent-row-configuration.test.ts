import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { agentRowCapabilities } from '@fbincon/statusline-core/integration/agent-row-capabilities';
import { configurationReasons } from '@fbincon/statusline-core/rendering/explain';
import { DEFAULT_HOST } from '@fbincon/statusline-core/config/draft';
import { ConfigurationService, draft } from '../src/config/service.js';
import { ProfileService } from '../src/config/profiles.js';
import { capabilities } from '../src/ui/protocol.js';
import { explanationFacts } from '../src/ui/explain.js';
import { parseAdministration } from '../src/integration/arguments.js';
import { agentRowDiagnostics } from '../src/integration/agent-row-diagnostics.js';
import { AGENT_ROW_EVIDENCE_FILE, planAgentRowInstall, type AgentRowPreference } from '../src/integration/agent-row-route.js';
import { AGENT_ROWS, type Diagnostic, type InstallContext } from '../src/integration/model.js';
import { helpText } from '../src/help.js';
import { jsonBytes, setup } from './final-support.js';
import { allFiles } from './runtime-support.js';

function fixture(t: TestContext, version: readonly number[] = [2, 1, 332]) {
    const f = setup(t, true);
    const context: InstallContext = {
        configDir: f.root, io: f.io, launch: f.launch, version,
        host() { throw new Error('unexpected plugin command'); },
    };
    const service = new ConfigurationService({ ...f.context, hostVersion: () => version }, f.io);
    const settings = () => JSON.parse(readFileSync(f.settingsPath, 'utf8'));
    function activate(preference: AgentRowPreference) {
        const plan = planAgentRowInstall(context, settings(), true, {preference});
        assert(plan.change?.desired);
        mkdirSync(dirname(plan.change.path), {recursive: true});
        writeFileSync(plan.change.path, plan.change.desired, {mode: 0o600});
        return plan;
    }
    return { ...f, service, context, settings, activate, profiles: new ProfileService(service) };
}

test('the host version gap and future legacy cutoff agree across the installation and both editors', () => {
    const display = defaultDisplay(), node = display.subagents.instances[0]!;
    for (const [patch, legacy, mod] of [
        [204, false, false], [205, true, false], [322, true, false], [323, false, false],
        [324, false, false], [325, false, false], [326, true, true], [332, true, true], [333, false, true],
    ] as const) {
        const version = [2, 1, patch], supported = legacy || mod;
        assert.deepEqual(agentRowCapabilities(version), {legacy, mod});
        assert.equal(capabilities(version).subagent_rows, supported ? 'supported' : 'unsupported');
        const reasons = configurationReasons({ display, host: DEFAULT_HOST }, 'subagent', node, {
            host_version: version, installation: {main: 'unknown', subagent: 'unknown'}, runtime: null,
        });
        assert(reasons.some(reason => reason.code === (supported ? 'host_supported' : 'unsupported_host')));
    }
    assert.equal(capabilities(null).subagent_rows, 'unknown');
});

test('the renderer preference is an install-only flag with one valid value', () => {
    for (const mode of ['auto', 'legacy', 'mod']) {
        assert.equal(parseAdministration('install', ['--subagent-renderer', mode]).subagentRenderer, mode);
        assert.deepEqual(parseAdministration('install', ['--subagent-renderer=' + mode, '--dry-run']),
            {subagentRenderer: mode, dryRun: true});
    }
    for (const argv of [['--subagent-renderer'], ['--subagent-renderer', '--force'], ['--subagent-renderer=off'],
        ['--subagent-renderer='], ['--subagent-renderer=mod', '--subagent-renderer', 'auto']])
        assert.throws(() => parseAdministration('install', argv));
    for (const cmd of ['setup', 'doctor', 'uninstall', 'recover'])
        assert.throws(() => parseAdministration(cmd, ['--subagent-renderer=legacy']));
    assert.match(helpText('install', 'en'), /--subagent-renderer auto\|mod\|legacy/u);
});

test('a profile never reinstalls the inactive callback in the gap or on the Mod route', t => {
    for (const patch of [323, 325, 332]) {
        const f = fixture(t, [2, 1, patch]), settings = f.settings();
        delete settings.subagentStatusLine;
        if (patch === 332) settings.enabledPlugins = { [AGENT_ROWS.plugin]: true };
        writeFileSync(f.settingsPath, jsonBytes(settings));
        if (patch === 332) {
            const route = f.activate('mod');
            settings.pluginConfigs = { [AGENT_ROWS.plugin]: { options: { installationId: route.installationId } } };
            writeFileSync(f.settingsPath, jsonBytes(settings));
        }
        const before = readFileSync(f.settingsPath);
        const project = join(f.root, 'project'); mkdirSync(project);
        f.profiles.mutate({action:'save', name:'Agents', bind_path:project, display:defaultDisplay(), expected_revision:f.profiles.read().revision});
        const selected = f.profiles.readTarget({kind:'project',path:project});
        selected.display.statusline_language = 'zh-CN';
        f.profiles.applyTarget({display:selected.display,host:selected.host},selected.revision,{kind:'project',path:project});
        assert.deepEqual(readFileSync(f.settingsPath), before);
        assert.equal(f.service.read().subagent_statusline.state, patch === 332 ? 'mod-pending' : 'unsupported');
        if (patch === 332) assert.equal(explanationFacts(f.service).installation.subagent, 'owned');
    }
});

test('a newly bound profile can use the known legacy grace period while it awaits Mod installation', t => {
    for (const [patch, supportedLegacy] of [[326, true], [332, true], [333, false]] as const) {
        const f = fixture(t, [2, 1, patch]), settings = f.settings();
        delete settings.subagentStatusLine;
        writeFileSync(f.settingsPath, jsonBytes(settings));
        const display = defaultDisplay(); display.subagents.enabled = false;
        writeFileSync(f.displayPath, jsonBytes(display));
        f.profiles.mutate({action:'save', name:'Local rows', bind_path:f.root, display:defaultDisplay(), expected_revision:f.profiles.read().revision});
        assert.equal(typeof f.settings().subagentStatusLine?.command === 'string', supportedLegacy);
    }
});

test('Profile saves conserve the reviewed legacy command and reject stale renderer generations', t => {
    const f = fixture(t), settings = f.settings();
    settings.subagentStatusLine.annotation = 'retain existing options';
    writeFileSync(f.settingsPath, jsonBytes(settings));
    assert.equal(f.activate('auto').mode, 'standby');
    const before = readFileSync(f.settingsPath), current = f.service.read();
    assert.equal(current.subagent_statusline.state, 'standby');
    const scope = {kind:'user'} as const;
    for (const enabled of [false, true]) {
        const user = f.profiles.readTarget(scope);
        user.display.subagents.enabled = enabled;
        f.profiles.applyTarget({display:user.display, host:user.host}, user.revision, scope);
        assert.deepEqual(readFileSync(f.settingsPath), before);
    }
    assert.equal(f.service.read().subagent_statusline.state, 'standby');
    f.profiles.mutate({action:'save', name:'Rows', bind_path:f.root, display:defaultDisplay(), expected_revision:f.profiles.read().revision});
    assert.deepEqual(readFileSync(f.settingsPath), before);
    f.activate('mod');
    assert.throws(() => f.service.apply(draft(current), current.revision), {code:'configuration_conflict'});
});

test('a bound project can request rows while user rows are off, and unreadable session evidence never blocks saving the display', t => {
    const f = fixture(t), settings = f.settings();
    delete settings.subagentStatusLine;
    settings.enabledPlugins = { [AGENT_ROWS.plugin]: true };
    writeFileSync(f.settingsPath, jsonBytes(settings));
    const plan = f.activate('auto');
    settings.pluginConfigs = { [AGENT_ROWS.plugin]: { options: { installationId: plan.installationId } } };
    writeFileSync(f.settingsPath, jsonBytes(settings));
    f.profiles.mutate({action:'save', name:'Rows', bind_path:f.root, display:defaultDisplay(), expected_revision:f.profiles.read().revision});
    const user = f.service.read();
    user.display.subagents.enabled = false;
    f.service.apply(draft(user), user.revision);
    assert.deepEqual(f.service.read().subagent_statusline, { enabled: false, installed: true, state: 'mod-pending' });
    const path = join(f.root, AGENT_ROW_EVIDENCE_FILE);
    writeFileSync(path, '{invalid', {mode:0o600});
    const incomplete = f.service.read();
    assert.equal(incomplete.subagent_statusline.state, 'mod-unverified');
    incomplete.display.statusline_language = 'zh-CN';
    assert(f.service.apply(draft(incomplete), incomplete.revision).changed);
    assert.equal(readFileSync(path,'utf8'), '{invalid');
});

test('a modern host with a foreign row command can save its own draft and retains the foreign entry', t => {
    const f = fixture(t), settings = f.settings();
    settings.subagentStatusLine = {type:'command',command:'other-renderer'};
    writeFileSync(f.settingsPath, jsonBytes(settings));
    const original = readFileSync(f.settingsPath), current = f.service.read();
    current.display.statusline_language = 'zh-CN';
    f.service.apply(draft(current), current.revision);
    assert.deepEqual(readFileSync(f.settingsPath), original);
});

test('row diagnostics distinguish a configured key from a compatible host and preserve all on-disk files', t => {
    const f = fixture(t, [2, 1, 323]), before = allFiles(f.root), diagnostics: Diagnostic[] = [];
    agentRowDiagnostics(f.context, f.settings(), defaultDisplay(), diagnostics);
    const messages = diagnostics.map(row => row.message).filter(msg => typeof msg !== 'string');
    const route = messages.find(msg => msg.key === 'agent_rows.doctor.route')!;
    assert.equal(route.params.mode,'builtin');
    assert.equal(route.params.legacy, 'owned');
    assert.equal((route.params.reason as {key:string}).key,'agent_rows.reason.callback-gap');
    const evidence = messages.find(msg => msg.key === 'agent_rows.doctor.evidence')!;
    assert.equal((evidence.params.verified as {key:string}).key,'diagnose.status.not_observed');
    assert.deepEqual(allFiles(f.root), before);
});
