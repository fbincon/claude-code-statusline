import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve, delimiter } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { quoteArgument, splitCommand } from '@fbincon/statusline-platform/commands';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { installCandidate } from './install.js';
import { verifyDelivery } from '../build/verify.js';
import { repoRoot } from '../migration/ts-03/common.js';
import { FOREIGN, inspectSession, NAME_COLOR, SAMPLE_KEY, type ExpectedRows } from './agent-rows/terminal.js';
import { verifiedHost, VERSIONS, type Version } from './agent-rows/hosts.js';

const MOD = 'statusline-agent-rows@claude-statusline-agent-rows-local';
const SYSTEM_PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
interface Scenario {
    id: string; version: Version; mode: 'auto' | 'mod' | 'legacy'; appearance: ExpectedRows['appearance'];
    foreign?: boolean; gap?: boolean; limit?: number;
}
export const SCENARIOS: readonly Scenario[] = [
    { id: 'legacy-322', version: '2.1.322', mode: 'auto', appearance: 'custom' },
    { id: 'gap-323', version: '2.1.323', mode: 'auto', appearance: 'default', gap: true },
    { id: 'gap-325', version: '2.1.325', mode: 'auto', appearance: 'default', gap: true },
    { id: 'auto-326', version: '2.1.326', mode: 'auto', appearance: 'custom' },
    { id: 'auto-332', version: '2.1.332', mode: 'auto', appearance: 'custom' },
    { id: 'limited-332', version: '2.1.332', mode: 'mod', appearance: 'custom', limit: 1 },
    { id: 'legacy-332', version: '2.1.332', mode: 'legacy', appearance: 'custom' },
    { id: 'foreign-332', version: '2.1.332', mode: 'auto', appearance: 'foreign', foreign: true },
];
type Candidate = ReturnType<typeof installCandidate>;
type Host = Awaited<ReturnType<typeof verifiedHost>>;
function write(path: string, value: unknown) {
    fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}
const read = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
function workspace(root: string) {
    const home = join(root, 'home'), config = join(root, 'config'), project = join(root, 'project'), temp = join(root, 'tmp');
    for (const path of [home, config, project, temp]) fs.mkdirSync(path, { mode: 0o700, recursive: true });
    write(join(config, '.claude.json'), { hasCompletedOnboarding: true, theme: 'dark',
        customApiKeyResponses: { approved: [SAMPLE_KEY.slice(-20)], rejected: [] }, projects: { [project]: { hasTrustDialogAccepted: true } } });
    return { root, home, config, project, temp };
}
type Workspace = ReturnType<typeof workspace>;
function environment(w: Workspace, candidate: Candidate, host: Host) {
    const bin = join(w.root, host.version);
    if (!fs.existsSync(bin)) {
        fs.mkdirSync(bin);
        fs.symlinkSync(host.executable, join(bin, 'claude'));
    }
    return { HOME: w.home, USERPROFILE: w.home, TMPDIR: w.temp, CLAUDE_CONFIG_DIR: w.config, PATH: [bin, candidate.nodeDir, SYSTEM_PATH].join(delimiter),
        LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', SHELL: '/bin/bash', TERM: 'xterm-256color', COLORTERM: 'truecolor',
        DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', ANTHROPIC_API_KEY: SAMPLE_KEY, ANTHROPIC_BASE_URL: 'http://127.0.0.1:9' };
}
function invoke(candidate: Candidate, w: Workspace, env: NodeJS.ProcessEnv, args: string[], requireSuccess = true) {
    const result = spawnSync(candidate.node, [candidate.entry, ...args], { cwd: w.project, env, encoding: 'utf8', timeout: 90_000, maxBuffer: 1024 * 1024 });
    if (result.error) throw result.error;
    if (requireSuccess) assert.equal(result.status, 0, args.join(' ') + '\n' + result.stdout + result.stderr);
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}
function configure(candidate: Candidate, w: Workspace, env: NodeJS.ProcessEnv, limit?: number) {
    for (const args of [
        ['config', 'subagents', 'set-items', 'name', 'task'],
        ['config', 'item', 'subagent', 'name', 'foreground', '#' + NAME_COLOR],
        ['config', 'set', 'statusline-language', 'zh-CN'],
        ...(limit === undefined ? [] : [['config', 'set', 'subagent-row-limit', String(limit)]]),
    ]) invoke(candidate, w, env, args);
}
function foreignCommand(work: Workspace, node: string) {
    const file = join(work.root, 'foreign.cjs'), marker = join(work.root, 'foreign-calls.ndjson');
    fs.writeFileSync(file, `const fs = require('node:fs');
const tasks = JSON.parse(fs.readFileSync(0, 'utf8')).tasks;
fs.appendFileSync(${JSON.stringify(marker)}, JSON.stringify(tasks.map(row => row.id)) + '\\n');
for (const row of tasks) console.log(JSON.stringify({id:row.id, content:${JSON.stringify(FOREIGN)}+' '+row.label}));
`);
    return { setting: { type: 'command', command: [node, file].map(quoteArgument).join(' ') }, marker };
}
function installation(path: string) {
    const settings = read(path);
    return { legacy: settings.subagentStatusLine ?? null, mod: settings.enabledPlugins?.[MOD] ?? null };
}
interface StageOptions { handoff?: boolean; reopen?: boolean }
async function runStage(candidate: Candidate, host: Host, work: Workspace, output: string, scenario: Scenario, options: StageOptions) {
    fs.mkdirSync(output, { mode: 0o700 });
    const env = environment(work, candidate, host), settings = join(work.config, 'settings.json');
    const foreign = scenario.foreign || scenario.gap ? foreignCommand(work, candidate.node) : undefined;
    if (scenario.foreign) write(settings, { ...(fs.existsSync(settings) ? read(settings) : {}), subagentStatusLine: foreign!.setting });
    const install = options.reopen ? null : invoke(candidate, work, env, ['install', '--subagent-renderer', scenario.mode,
        '--no-native-editor', '--no-native-timing', '--no-live-metrics', '--no-experimental-slash-tui'], !scenario.foreign);
    if (install) write(join(output, 'install.json'), install);
    const start = installation(settings);
    if (scenario.foreign) assert.deepEqual(start.legacy, foreign!.setting);
    else if (scenario.gap) { assert.equal(start.legacy, null); assert.notEqual(start.mod, true); }
    else if (scenario.mode === 'legacy' || host.version === '2.1.322') {
        assert.equal(splitCommand(start.legacy?.command)?.at(-1), 'render-subagents'); assert.notEqual(start.mod, true);
    } else {
        assert.equal(start.mod, true);
        if (options.handoff) assert.equal(splitCommand(start.legacy?.command)?.at(-1), 'render-subagents');
        else assert.equal(start.legacy, null);
    }
    const actual = await inspectSession({ executable: host.executable, config: work.config, project: work.project, env, output,
        expected: { appearance: scenario.appearance, count: scenario.limit ?? 2 },
        ...(scenario.gap ? { settingsOverride: { subagentStatusLine: foreign!.setting } } : {}),
        ...(options.handoff ? { readyAfterRender: () => installation(settings).legacy === null,
            setNameColor: (colour: string) => { invoke(candidate, work, env, ['config', 'item', 'subagent', 'name', 'foreground', '#' + colour]); } } : {}) });
    if (foreign) {
        const called = fs.existsSync(foreign.marker) ? fs.readFileSync(foreign.marker, 'utf8').trim().split('\n').map(line => JSON.parse(line)) as string[][] : [];
        if (scenario.gap) assert.deepEqual(called, [], 'A gap host unexpectedly called the legacy callback');
        else assert(actual.agent_ids.every(id => called.some(batch => batch.includes(id))), 'Foreign callback did not receive both agents');
    }
    const finish = installation(settings);
    if (scenario.foreign) assert.deepEqual(finish.legacy, foreign!.setting);
    if (options.handoff) { assert.equal(finish.legacy, null); assert.equal(finish.mod, true); }
    const doctor = invoke(candidate, work, env, ['--language', 'en', 'doctor'], false);
    write(join(output, 'doctor.json'), doctor);
    return { scenario: scenario.id, host: host.version, host_sha256: host.sha256, preference: scenario.mode, install_code: install?.code ?? null,
        bindings_before: start, bindings_after: finish, ...actual, terminal_sha256: sha256(fs.readFileSync(join(output, 'terminal.ansi'))) };
}

interface Options { artifact: string; commit: string; hosts: string; output: string; selected?: string }
async function matrix(options: Options) {
    assert.equal(process.platform, 'linux');
    // The child namespace is private. Never bring up interfaces on the parent namespace.
    assert.notEqual(fs.readlinkSync('/proc/self/ns/net'), process.env.ROW_PROBE_PARENT_NET);
    const interfaces: { ifname: string }[] = JSON.parse(execFileSync('ip', ['-json', 'link', 'show'], { encoding: 'utf8' }));
    assert.deepEqual(interfaces.map(item => item.ifname), ['lo']);
    execFileSync('ip', ['link', 'set', 'dev', 'lo', 'up']);
    assert.deepEqual(Object.keys(networkInterfaces()), ['lo'], 'Only the loopback interface may be present');
    assert(networkInterfaces().lo?.every(address => address.internal));
    assert.equal(fs.readFileSync('/proc/net/route', 'utf8').trim().split('\n').length, 1);
    const selected = SCENARIOS.filter(row => !options.selected || row.id === options.selected);
    const migration = !options.selected || options.selected === 'migration';
    assert(selected.length || migration, 'Unknown --case');
    fs.mkdirSync(options.output, { mode: 0o700 });
    const delivery = verifyDelivery(options.artifact, options.commit);
    const candidate = installCandidate(options.artifact, options.commit);
    const results: Awaited<ReturnType<typeof runStage>>[] = [];
    const driverFiles = ['tools/acceptance/agent-rows', 'tools/acceptance/agent-rows/hosts', 'tools/acceptance/agent-rows/provider',
        'tools/acceptance/agent-rows/terminal', 'tools/migration/ts-04/capture', 'tools/migration/ts-04/test/pty'];
    const driver = driverFiles.map(file => {
        const source = file + '.ts', archived = delivery.sourceEntries.get(source);
        return { source, source_sha256: sha256(fs.readFileSync(join(repoRoot, source))),
            candidate_source_sha256: archived ? sha256(archived) : null,
            executed_js_sha256: sha256(fs.readFileSync(join(repoRoot, 'dist', 'typescript', file + '.js'))) };
    });
    const receipt = { schema_version: 1, status: 'running', complete_matrix: !options.selected, candidate_commit: options.commit,
        artifact_sha256: candidate.packed.sha256, source_archive_sha256: read(join(dirname(options.artifact), 'build-manifest.json')).source.sha256,
        source_manifest_sha256: delivery.source.source_manifest_sha256,
        driver_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(), driver,
        platform: process.platform, architecture: process.arch, node: process.version, network_interfaces: ['lo'],
        provider: 'local deterministic Messages API simulator', external_model_calls: 0, billed_usd: 0,
        scope: 'Actual installed candidate in a Linux PTY. No physical desktop, IDE or paid-provider observations.',
        results, current_scenario: '', error: '' };
    const persist = () => write(join(options.output, 'receipt.json'), receipt);
    try {
        persist();
        const hosts = new Map<Version, Host>(), isolated = workspace(join(candidate.temporary, 'version-check'));
        const env = { PATH: SYSTEM_PATH, HOME: isolated.home, CLAUDE_CONFIG_DIR: isolated.config };
        for (const version of VERSIONS.filter(v => selected.some(s => s.version === v) || migration && ['2.1.322', '2.1.332'].includes(v))) {
            hosts.set(version, await verifiedHost(options.hosts, version, env, isolated.project));
        }
        const stage = async (scenario: Scenario, work: Workspace, stageOptions: StageOptions = {}) => {
            process.stdout.write('Agent rows: ' + scenario.id + '\n');
            receipt.current_scenario = scenario.id; persist();
            results.push(await runStage(candidate, hosts.get(scenario.version)!, work, join(options.output, scenario.id), scenario, stageOptions));
            persist();
        };
        for (const scenario of selected) {
            const work = workspace(join(candidate.temporary, scenario.id));
            configure(candidate, work, environment(work, candidate, hosts.get(scenario.version)!), scenario.limit);
            await stage(scenario, work);
        }
        if (migration) {
            const work = workspace(join(candidate.temporary, 'migration'));
            configure(candidate, work, environment(work, candidate, hosts.get('2.1.322')!));
            const starting = { ...SCENARIOS[0]!, id: 'migration-legacy' };
            await stage(starting, work);
            const display = fs.readFileSync(join(work.config, 'claude-statusline.json'));
            await stage({ ...starting, id: 'migration-upgrade', version: '2.1.332' }, work, { handoff: true });
            await stage({ ...starting, id: 'migration-reopen', version: '2.1.332' }, work, { reopen: true });
            await stage({ ...starting, id: 'migration-downgrade' }, work);
            assert.deepEqual(fs.readFileSync(join(work.config, 'claude-statusline.json')), display, 'Migration changed the display configuration');
        }
        if (!options.selected) {
            const expected = results[0]!.rows.map(row => row.body).sort();
            for (const result of results.filter(r => r.rows.length === 2 && r.rows.every(row => row.custom))) {
                assert.deepEqual(result.rows.map(row => row.body).sort(), expected, 'Rendered bodies differ from the legacy reference: ' + result.scenario);
            }
            assert.equal(results.find(r => r.scenario === 'limited-332')!.rows[0]!.label,
                results.find(r => r.scenario === 'auto-332')!.rows[0]!.label, 'The single visible row must be the first eligible host row');
        }
        receipt.status = 'pass'; receipt.current_scenario = '';
    } catch (error) {
        receipt.status = 'fail'; receipt.error = String(error);
        throw error;
    } finally {
        persist();
        candidate.cleanup();
        assert(!fs.existsSync(candidate.temporary), 'Installed fixture was not removed');
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, hosts: { type: 'string' },
        output: { type: 'string' }, case: { type: 'string' }, isolated: { type: 'boolean' } } });
    assert(values.artifact && values.commit && /^[0-9a-f]{40}$/u.test(values.commit) && values.hosts && values.output,
        'Require --artifact TGZ --commit FULL_SHA --hosts DIRECTORY --output NEW_DIRECTORY [--case ID]');
    if (values.isolated) {
        assert(process.env.ROW_PROBE_PARENT_NET, 'Use the public launcher to isolate the network');
        await matrix({ artifact: resolve(values.artifact), commit: values.commit, hosts: resolve(values.hosts), output: resolve(values.output), selected: values.case });
    } else {
        assert.equal(process.platform, 'linux', 'This probe requires Linux user and network namespaces');
        const result = spawnSync('unshare', ['--user', '--map-root-user', '--net', process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2), '--isolated'],
            { stdio: 'inherit', env: { PATH: [dirname(process.execPath), SYSTEM_PATH].join(delimiter), LANG: 'C.UTF-8', TMPDIR: process.env.TMPDIR || '/var/tmp',
                ROW_PROBE_PARENT_NET: fs.readlinkSync('/proc/self/ns/net') } });
        if (result.error) throw result.error;
        process.exitCode = result.status ?? 1;
    }
}
