/** Isolated public-command walkthroughs against the unchanged showcase package. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { delimiter, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { verifyDelivery } from '../build/verify.js';
import { sha256, npmEntry, readTar } from '../build/files.js';
import { TARGETS } from '../build/model.js';
import { repoRoot } from '../migration/ts-03/common.js';
import { installCandidate } from './install.js';
import { SHOWCASE_BASELINE, assertBaseline, snapshotDirectory, requireRemoved } from './showcase.js';

export interface OperationsOptions { artifact: string; commit: string; output: string; claude?: string; github?: string; previousArtifact?: string }
const PREVIOUS = { version: '3.15.0', sha256: '9064fa583037b57c3b3d0c876fabe6dd15e63c4a9b8e52446e1a2ef9dcabe683' };
export function githubSelection(value: string | undefined): string | null {
    if (value === undefined) return null;
    assert.equal(value, 'fbincon/claude-code-statusline', 'Showcase GitHub access requires the explicitly authorized repository');
    return value;
}
interface Result { status: number; stdout: string; stderr: string }
const write = (path: string, value: unknown) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
const configurationSnapshot = (directory: string) => ({ present: fs.existsSync(directory), files: snapshotDirectory(directory) });

/** npm bin links are ordinary installation entries; record their targets without following them. */
export function installationSnapshot(directory: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const visit = (path: string) => {
        for (const name of fs.readdirSync(path).sort()) {
            const child = join(path, name), stat = fs.lstatSync(child), key = relative(directory, child).replaceAll('\\', '/');
            if (stat.isSymbolicLink()) result[key] = { kind: 'link', target: fs.readlinkSync(child), mode: stat.mode & 0o777 };
            else if (stat.isDirectory()) { result[key] = { kind: 'directory', mode: stat.mode & 0o777 }; visit(child); }
            else { assert(stat.isFile(), 'Unexpected installation entry'); result[key] = { kind: 'file', mode: stat.mode & 0o777, sha256: sha256(fs.readFileSync(child)) }; }
        }
    };
    visit(directory); return result;
}

/** Source state and value have independent meaning: retained data never passes as current success. */
export function requireObservation(value: unknown, state: string, reason: string, expected: unknown, freshness?: string): void {
    assert(value && typeof value === 'object', 'Missing source observation');
    const view = value as Record<string, unknown>;
    assert.equal(view.state, state, 'Source state differs'); assert.equal(view.reason, reason, 'Source reason differs');
    assert.equal(view.value, expected, 'Source value differs');
    if (freshness !== undefined) assert.equal(view.freshness, freshness, 'Source freshness differs');
}

export async function showcaseOperations(options: OperationsOptions) {
    const github = githubSelection(options.github), artifactPath = resolve(options.artifact), output = resolve(options.output);
    assert.equal(options.commit, SHOWCASE_BASELINE.commit); assert.equal(sha256(fs.readFileSync(artifactPath)), SHOWCASE_BASELINE.tarball_sha256);
    const artifact = verifyDelivery(artifactPath, options.commit);
    assertBaseline({ version: artifact.source.application_version, commit: artifact.source.commit, tarball_sha256: artifact.sha256 });
    fs.mkdirSync(output, { mode: 0o700 });
    const installed = installCandidate(artifactPath, options.commit), config = installed.env.CLAUDE_CONFIG_DIR;
    const project = join(installed.temporary, 'source project 中文'), definitions = join(installed.temporary, 'definitions');
    fs.mkdirSync(project); fs.mkdirSync(definitions);
    let ordinal = 0, failure: unknown, cleanupFailure: unknown;
    const observations: Record<string, unknown>[] = [], jobs: { id: string; env: NodeJS.ProcessEnv }[] = [];
    const logs: { file: string; sha256: string }[] = [];
    const env: NodeJS.ProcessEnv = { ...installed.env, DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        ANTHROPIC_API_KEY: 'showcase-no-model-calls', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9' };
    const remember = (label: string, value: Record<string, unknown>) => observations.push({ label, ...value });
    const invoke = (label: string, args: string[], expected = [0], input = '', selectedEnv = env): Result => {
        const response = spawnSync(installed.node, [installed.entry, ...args], { cwd: project, env: selectedEnv, input,
            encoding: 'utf8', timeout: ['update', 'rollback'].includes(args[0] ?? '') ? 180000 : 45000, maxBuffer: 8 * 1024 * 1024 });
        const result = { status: response.status ?? -1, stdout: response.stdout ?? '', stderr: response.stderr ?? '' };
        const file = String(++ordinal).padStart(3, '0') + '-' + label + '.json';
        write(join(output, file), { args, ...result, ...(response.error ? { error: response.error.message } : {}) });
        logs.push({ file, sha256: sha256(fs.readFileSync(join(output, file))) });
        assert(!response.error, label + ': process failed'); assert(expected.includes(result.status), label + ': unexpected exit ' + result.status);
        return result;
    };
    const json = (label: string, args: string[], expected = [0], selectedEnv = env) => JSON.parse(invoke(label, args, expected, '', selectedEnv).stdout);
    const source = (label: string, args: string[], expected = [0], selectedEnv = env) => json(label, ['source', ...args, '--json'], expected, selectedEnv);
    const registry = () => source('source-list', ['list']);
    const define = (id: string, definition: unknown, edit = false, selectedEnv = env) => {
        const file = join(definitions, id + '-' + ordinal + '.json'); write(file, definition);
        const added = source(id + (edit ? '-edit' : '-add'), [edit ? 'edit' : 'add', id, '--file', file], [0], selectedEnv);
        assert.equal(added.sources.find((row: any) => row.id === id).enabled, false);
    };
    const enable = (id: string, selectedEnv = env) => {
        const before = configurationSnapshot(config), review = source(id + '-review', ['review', id], [0], selectedEnv);
        assert.deepEqual(configurationSnapshot(config), before, 'Source review must preserve configuration');
        const enabled = source(id + '-enable', ['enable', id, '--review', review.review_revision], [0], selectedEnv);
        assert.equal(enabled.sources.find((row: any) => row.id === id).enabled, true); return review.review_revision as string;
    };
    const bind = (id: string) => {
        const before = json('instances-before', ['config', 'instance', 'main', 'list', '--json']) as any[];
        invoke(id + '-add-instance', ['config', 'instance', 'main', 'add', 'external-value']);
        const after = json('instances-after', ['config', 'instance', 'main', 'list', '--json']) as any[];
        const nodes = after.filter(row => !before.some(old => old.id === row.id)); assert.equal(nodes.length, 1);
        source(id + '-bind', ['bind', id, '--instance', nodes[0].id, '--scope', 'main']);
    };
    const inspect = (id: string, selectedEnv = env, root = project) => {
        const before = configurationSnapshot(config), result = source(id + '-diagnose', ['diagnose', id, '--project', root], [0], selectedEnv);
        assert.deepEqual(configurationSnapshot(config), before, 'Source diagnosis must not refresh or change configuration'); return result;
    };
    const render = (label: string) => invoke(label, ['render'], [0], JSON.stringify({ session_id: 'showcase-operations',
        model: { id: 'showcase-fixture' }, workspace: { current_dir: project }, columns: 120 }));
    const waitFor = async (predicate: () => boolean, label: string) => {
        const end = Date.now() + 10000; while (!predicate() && Date.now() < end) await delay(50);
        assert(predicate(), label);
    };
    const claim = (id: string) => join(config, 'statusline_runtime/sources/jobs', id + '.json.claim');
    const settled = async (id: string) => waitFor(() => !fs.existsSync(claim(id)), 'Cancelled worker did not release its claim');
    let installedFiles = 0, host: string | null = null;
    try {
        assert.deepEqual(JSON.parse(fs.readFileSync(join(installed.root, 'candidate.json'), 'utf8')), artifact.source);
        const otherNative = TARGETS.filter(target => target !== process.platform + '-' + process.arch).map(target => 'node_modules/@koromix/koffi-' + target + '/');
        for (const [name, digest] of Object.entries(artifact.source.files)) {
            const path = join(installed.root, name);
            if (!fs.existsSync(path) && otherNative.some(prefix => name.startsWith(prefix))) continue;
            assert.equal(sha256(fs.readFileSync(path)), digest, 'Installed file differs: ' + name); installedFiles++;
        }
        if (options.claude) {
            const binary = fs.realpathSync(resolve(options.claude));
            host = execFileSync(binary, ['--version'], { env, encoding: 'utf8', timeout: 10000 }).trim();
            assert.match(host, /^2\./u); fs.symlinkSync(binary, join(installed.nodeDir, process.platform === 'win32' ? 'claude.exe' : 'claude'));
        }
        let before = configurationSnapshot(config);
        const setup = invoke('setup-dry-run-empty', ['setup', '--dry-run'], options.claude ? [0] : [1]);
        assert.deepEqual(configurationSnapshot(config), before, 'Setup dry run created or changed configuration');
        invoke('setup-no-tty', ['setup'], [2]); assert.deepEqual(configurationSnapshot(config), before);
        const installFlags = ['--no-native-editor', '--no-experimental-slash-tui', '--no-live-metrics', '--no-native-timing'];
        invoke('install-dry-run', ['install', '--dry-run', ...installFlags]); assert.deepEqual(configurationSnapshot(config), before);
        invoke('install', ['install', ...installFlags]);
        before = configurationSnapshot(config); const doctor = invoke('doctor', ['doctor']);
        assert(!doctor.stdout.includes('[ERROR]')); assert.deepEqual(configurationSnapshot(config), before, 'Doctor left changed configuration');
        invoke('setup-dry-run-installed', ['setup', '--dry-run'], options.claude ? [0] : [1]);
        invoke('recover-dry-run', ['recover', '--dry-run']); assert.deepEqual(configurationSnapshot(config), before);
        remember('setup-install-doctor', { passed: true, setup_dry_run_exit: setup.status, non_tty_exit: 2,
            absent_and_installed_dry_runs_unchanged: true, doctor_exit: doctor.status, doctor_persistent_files_unchanged: true,
            native_editor: false, external_slash_tui: false, live_metrics: false, native_timing: false });
        invoke('minimal-preset', ['config', 'preset', 'minimal']); invoke('compact-separators', ['config', 'set', 'separator-style', 'compact']);

        const localFile = join(project, 'queue.json'), local = 'showcase-queue';
        fs.writeFileSync(localFile, JSON.stringify({ value: 0, observed_at: new Date().toISOString() }));
        define(local, { kind: 'json', name: 'Showcase queue', scope: { project: null, session: null, agent: null }, ttl_seconds: 300,
            settings: { path: localFile, pointer: '/value', observed_at_pointer: '/observed_at', unit: 'jobs' } });
        const rejected = source('stale-review-rejected', ['enable', local, '--review', 'unreviewed'], [2]); assert.equal(rejected.error.code, 'review');
        assert.equal(registry().sources.find((row: any) => row.id === local).enabled, false);
        enable(local); bind(local); render('json-render-zero'); let diagnosis = inspect(local);
        requireObservation(diagnosis.view, 'valid', 'valid', 0, 'current');
        fs.writeFileSync(localFile, JSON.stringify({ observed_at: new Date().toISOString() })); render('json-render-missing'); diagnosis = inspect(local);
        requireObservation(diagnosis.view, 'missing', 'missing', 0); // Explicit retained success; not fabricated zero.
        fs.writeFileSync(localFile, JSON.stringify({ value: 7, observed_at: new Date(Date.now() - 600000).toISOString() }));
        render('json-render-stale'); diagnosis = inspect(local); requireObservation(diagnosis.view, 'valid', 'valid', 7, 'stale');
        fs.writeFileSync(localFile, '{"value":'); render('json-render-invalid'); diagnosis = inspect(local);
        requireObservation(diagnosis.view, 'error', 'read_error', 7, 'stale');
        removeTree(localFile); requireRemoved(localFile); render('json-render-missing-file'); diagnosis = inspect(local);
        requireObservation(diagnosis.view, 'missing', 'missing_file', 7, 'stale');
        source('json-disable', ['disable', local]); diagnosis = inspect(local); requireObservation(diagnosis.view, 'disabled', 'disabled', null);
        remember('local-json', { passed: true, rejected_unreviewed_enable: true, zero: { state: 'valid', value: 0 },
            missing: { state: 'missing', retained_value: 0 }, stale: { state: 'valid', freshness: 'stale', value: 7 },
            invalid: { state: 'error', retained_value: 7 }, missing_file: { state: 'missing', retained_value: 7 }, disabled_value: null,
            input_kind: 'isolated local JSON fixture read by installed renderer', diagnosis_readonly: true });

        const command = 'showcase-command', modeFile = join(project, 'command-mode'), started = join(project, 'command-started');
        const script = `const fs=require('node:fs');const mode=fs.existsSync(${JSON.stringify(modeFile)})?fs.readFileSync(${JSON.stringify(modeFile)},'utf8'):'';if(mode==='fail')process.exit(7);if(mode==='slow'){fs.writeFileSync(${JSON.stringify(started)},'started');setTimeout(()=>process.stdout.write('late'),8000);}else process.stdout.write('42');`;
        define(command, { kind: 'command', name: 'Showcase command', scope: { project, session: null, agent: null }, ttl_seconds: 300,
            settings: { executable: installed.node, args: ['-e', script], cwd: project, input: {}, output: 'text', timeout_ms: 15000 } });
        const review = enable(command); bind(command);
        let job = source('command-refresh', ['refresh', command, '--project', project]); assert.equal(job.state, 'completed');
        diagnosis = inspect(command); requireObservation(diagnosis.view, 'valid', 'valid', '42', 'current');
        fs.writeFileSync(modeFile, 'fail'); job = source('command-failure', ['refresh', command, '--project', project], [2]);
        assert.equal(job.state, 'failed'); assert.equal(job.result.exit_code, 7); diagnosis = inspect(command);
        requireObservation(diagnosis.view, 'error', 'exit', '42', 'current');
        fs.writeFileSync(modeFile, 'slow');
        const begin = async () => {
            removeTree(started); requireRemoved(started);
            const running = source('command-start', ['refresh', command, '--project', project, '--no-wait']);
            assert.equal(running.state, 'running'); jobs.push({ id: running.id, env });
            await waitFor(() => fs.existsSync(started) && fs.existsSync(claim(running.id)), 'Command did not reach its controlled running state'); return running.id as string;
        };
        let id = await begin(); job = source('command-cancel', ['cancel', id], [2]); assert.equal(job.state, 'cancelled'); await settled(id);
        diagnosis = inspect(command); requireObservation(diagnosis.view, 'error', 'cancelled', '42');
        source('command-auto-on', ['auto-on', command, '--review', review, '--interval', '300']);
        id = await begin(); source('command-auto-off', ['auto-off', command]);
        job = source('manual-job-survives-auto-off', ['status', id]); assert.equal(job.state, 'running');
        assert.equal(registry().sources.find((row: any) => row.id === command).enabled, true);
        source('command-cancel-after-auto-off', ['cancel', id], [2]); await settled(id);
        id = await begin(); source('command-disable', ['disable', command]);
        job = source('disabled-job-status', ['status', id], [2]); assert.equal(job.state, 'cancelled'); await settled(id);
        diagnosis = inspect(command); requireObservation(diagnosis.view, 'disabled', 'disabled', null);
        const disabled = source('disabled-refresh-rejected', ['refresh', command, '--project', project], [2]); assert.equal(disabled.error.code, 'disabled');
        remember('command-lifecycle', { passed: true, successful_value: '42', failure_exit_code: 7, failure_retains_value: true,
            whole_job_cancel_exit: 2, automatic_off_preserves_manual_job_and_enablement: true,
            disable_cancels_and_prevents_refresh: true, workers_released: true, input_kind: 'explicit reviewed local fixture command' });

        const exported = join(project, 'bound.profile.json');
        invoke('bound-profile-save', ['config', 'profile', 'save', 'Showcase bound sources', '--json']);
        invoke('bound-profile-export', ['config', 'profile', 'export', 'Showcase bound sources', exported, '--json']);
        const profile = JSON.parse(fs.readFileSync(exported, 'utf8'));
        assert(profile.display.instances.filter((row: any) => row.type_id === 'external-value').length >= 2);
        assert(profile.display.instances.every((row: any) => !row.source?.binding), 'Export retained a local source binding');
        const recipient = join(installed.temporary, 'recipient-config'), receivingEnv = { ...env, CLAUDE_CONFIG_DIR: recipient };
        invoke('recipient-profile-import', ['config', 'profile', 'import', exported, '--json'], [0], '', receivingEnv);
        const recipientSources = source('recipient-sources', ['list'], [0], receivingEnv);
        assert.equal(recipientSources.sources.length, 0); assert.equal(recipientSources.bindings.length, 0);
        assert(!fs.existsSync(join(recipient, 'claude-statusline-sources.json')), 'Import created source authorization');
        remember('portable-source-isolation', { passed: true, exported_bindings_cleared: true, recipient_sources: 0, recipient_authorization_file_absent: true });

        if (options.previousArtifact) {
            const previous = resolve(options.previousArtifact); assert.equal(sha256(fs.readFileSync(previous)), PREVIOUS.sha256, 'Wrong public v3.15.0 package bytes');
            const previousManifest = JSON.parse(readTar(previous).get('package.json')!.toString('utf8'));
            assert.equal(previousManifest.name, artifact.source.name); assert.equal(previousManifest.version, PREVIOUS.version);
            const prefix = join(installed.temporary, 'tutorial-prefix'), versionConfig = join(installed.temporary, 'tutorial-config');
            fs.mkdirSync(prefix); fs.mkdirSync(versionConfig);
            const userconfig = join(installed.temporary, 'tutorial-user.npmrc'), globalconfig = join(installed.temporary, 'tutorial-global.npmrc');
            fs.writeFileSync(userconfig, ''); fs.writeFileSync(globalconfig, '');
            const versionEnv: NodeJS.ProcessEnv = { ...env, CLAUDE_CONFIG_DIR: versionConfig, npm_execpath: npmEntry(),
                npm_config_registry: 'https://registry.npmjs.org/', npm_config_userconfig: userconfig, npm_config_globalconfig: globalconfig,
                npm_config_cache: join(installed.temporary, 'tutorial-cache'), npm_config_prefer_online: 'true' };
            for (const key of ['HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY']) if (process.env[key] !== undefined) versionEnv[key] = process.env[key];
            const bootstrap = spawnSync(installed.node, [npmEntry(), 'install', '--global', '--prefix', prefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', previous],
                { cwd: project, env: versionEnv, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
            write(join(output, 'tutorial-bootstrap.json'), { status: bootstrap.status, stdout: bootstrap.stdout, stderr: bootstrap.stderr,
                previous: PREVIOUS, offline: true, ignore_scripts: true });
            assert.equal(bootstrap.status, 0, 'Isolated 3.15.0 package bootstrap failed');
            const tutorialRoot = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules', artifact.source.name);
            const installedVersion = () => JSON.parse(fs.readFileSync(join(tutorialRoot, 'package.json'), 'utf8')).version;
            assert.equal(installedVersion(), PREVIOUS.version);
            const command = (action: string, version: string, flag: string) => [action, '--version', version, '--prefix', prefix, '--config-dir', versionConfig, flag];
            let prefixBefore = installationSnapshot(prefix), configBefore = configurationSnapshot(versionConfig);
            invoke('tutorial-upgrade-dry-run', command('update', SHOWCASE_BASELINE.version, '--dry-run'), [0], '', versionEnv);
            assert.deepEqual(installationSnapshot(prefix), prefixBefore, 'Upgrade dry run changed the installation');
            assert.deepEqual(configurationSnapshot(versionConfig), configBefore, 'Upgrade dry run changed configuration');
            invoke('tutorial-upgrade', command('update', SHOWCASE_BASELINE.version, '--yes'), [0], '', versionEnv);
            assert.equal(installedVersion(), SHOWCASE_BASELINE.version);
            assert.deepEqual(JSON.parse(fs.readFileSync(join(tutorialRoot, 'candidate.json'), 'utf8')), artifact.source);
            let verified = 0;
            for (const [name, digest] of Object.entries(artifact.source.files)) {
                const path = join(tutorialRoot, name);
                if (!fs.existsSync(path) && otherNative.some(other => name.startsWith(other))) continue;
                assert.equal(sha256(fs.readFileSync(path)), digest, 'Updated tutorial file differs: ' + name); verified++;
            }
            prefixBefore = installationSnapshot(prefix); configBefore = configurationSnapshot(versionConfig);
            invoke('tutorial-rollback-dry-run', command('rollback', PREVIOUS.version, '--dry-run'), [0], '', versionEnv);
            assert.equal(installedVersion(), SHOWCASE_BASELINE.version);
            assert.deepEqual(installationSnapshot(prefix), prefixBefore, 'Rollback dry run changed the installation');
            assert.deepEqual(configurationSnapshot(versionConfig), configBefore, 'Rollback dry run changed configuration');
            remember('version-tutorial', { passed: true, from: PREVIOUS, to: SHOWCASE_BASELINE, bootstrap: 'verified public tgz; offline npm install --global --ignore-scripts',
                registry: 'https://registry.npmjs.org/', manager: 'verified installed v3.16.0 entry', upgrade_dry_run_unchanged: true,
                upgrade_yes_completed: true, installed_files_verified: verified, rollback_dry_run_unchanged: true,
                live_integration_used: false, crash_suite_repeated: false });
        } else remember('version-tutorial', { requested: false, result: 'not run; requires --previous-artifact PUBLIC_3.15.0_TGZ and explicit public registry access' });

        if (github) {
            const githubEnv: NodeJS.ProcessEnv = { ...env, PATH: installed.nodeDir + delimiter + (process.env.PATH ?? ''),
                HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, GH_PROMPT_DISABLED: '1', GH_PAGER: 'cat' };
            for (const key of ['GH_CONFIG_DIR', 'GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN',
                'XDG_CONFIG_HOME', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY'])
                if (process.env[key] !== undefined) githubEnv[key] = process.env[key];
            const gh = (args: string[]) => execFileSync('gh', args, { cwd: repoRoot, env: githubEnv, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
            // Status output may contain credential summaries: retain neither it nor environment values.
            const status = spawnSync('gh', ['auth', 'status', '--hostname', 'github.com'], { cwd: repoRoot, env: githubEnv, encoding: 'utf8', timeout: 30000 });
            assert.equal(status.status, 0, 'Existing gh authentication unavailable');
            const account = gh(['api', '--hostname', 'github.com', 'user', '--jq', '.login']).trim(); assert.equal(account, 'fbincon');
            const permissions = JSON.parse(gh(['api', '--hostname', 'github.com', 'repos/' + github, '--jq', '.permissions']));
            assert.equal(permissions.pull, true, 'Current gh account lacks repository read permission');
            const git = (args: string[]) => execFileSync('git', args, { cwd: repoRoot, env: { ...githubEnv, GIT_OPTIONAL_LOCKS: '0' }, encoding: 'utf8' }).trim();
            const branch = git(['symbolic-ref', '--short', 'HEAD']), head = git(['rev-parse', 'HEAD']);
            const origin = git(['remote', 'get-url', 'origin']); assert(['https://github.com/' + github, 'https://github.com/' + github + '.git', 'git@github.com:' + github + '.git'].includes(origin));
            define('showcase-forge', { kind: 'github', name: 'Showcase GitHub', scope: { project: repoRoot, session: null, agent: null }, ttl_seconds: 300,
                settings: { host: 'github.com', repository: github, branch, account, pr: null } }, false, githubEnv);
            enable('showcase-forge', githubEnv);
            job = source('github-refresh', ['refresh', 'showcase-forge', '--project', repoRoot], [0], githubEnv);
            assert.equal(job.state, 'completed'); diagnosis = inspect('showcase-forge', githubEnv, repoRoot);
            assert.equal(diagnosis.view.state, 'valid'); assert(['valid', 'no_pr'].includes(diagnosis.view.reason));
            source('github-disable', ['disable', 'showcase-forge'], [0], githubEnv);
            remember('github-readonly', { passed: true, repository: github, account, branch, head, current_gh_read_permission: true,
                state: diagnosis.view.state, reason: diagnosis.view.reason, ci: diagnosis.view.fields?.ci ?? null,
                observed_at: diagnosis.view.observed_at, source_disabled_afterward: true, writes_to_github: 0 });
        } else remember('github-readonly', { requested: false, result: 'not run; requires explicit --github fbincon/claude-code-statusline' });
    } catch (error) { failure = error; }
    finally {
        try {
            for (const job of jobs) {
                const existing = source('cleanup-job-status', ['status', job.id], [0, 2], job.env);
                if (existing.state === 'running') source('cleanup-job-cancel', ['cancel', job.id], [0, 2], job.env);
                await settled(job.id);
            }
            installed.cleanup(); requireRemoved(installed.temporary);
        } catch (error) { cleanupFailure = error; }
    }
    const scrub = (value: string) => value.split(installed.temporary).join('<isolated-installation>').split(repoRoot).join('<repository>').split(homedir()).join('<home>');
    const collectorFiles = ['tools/acceptance/showcase-operations.ts', 'tools/acceptance/showcase.ts', 'tools/acceptance/install.ts'];
    const result = { status: failure || cleanupFailure ? 'fail' : 'pass', product: SHOWCASE_BASELINE,
        collector: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
            files: Object.fromEntries(collectorFiles.map(path => [path, sha256(fs.readFileSync(join(repoRoot, path)))])),
            compiled_sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
            working_tree_changes: Boolean(execFileSync('git', ['status', '--porcelain=v1', '--', ...collectorFiles], { cwd: repoRoot, encoding: 'utf8' }).trim()) },
        host, installed_files_verified: installedFiles, model_calls: 0, model_request_attempts: 0,
        physical_acceptance: false, human_acceptance: false, real_user_configuration_changed: false,
        isolated_installation_removed: !fs.existsSync(installed.temporary), observations, command_logs: logs,
        ...(failure ? { error: scrub(failure instanceof Error ? failure.message : String(failure)) } : {}),
        ...(cleanupFailure ? { cleanup_error: scrub(cleanupFailure instanceof Error ? cleanupFailure.message : String(cleanupFailure)) } : {}) };
    write(join(output, 'summary.json'), result);
    if (failure || cleanupFailure) throw new Error('Showcase operations failed; inspect private summary: ' + output);
    return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, output: { type: 'string' }, claude: { type: 'string' }, github: { type: 'string' }, 'previous-artifact': { type: 'string' } } });
    if (!values.artifact || !values.commit || !values.output) throw new Error('Require --artifact PUBLIC_TGZ --commit PRODUCT_SHA --output NEW_DIRECTORY [--claude BINARY] [--github fbincon/claude-code-statusline] [--previous-artifact PUBLIC_3.15.0_TGZ]');
    const result = await showcaseOperations({ artifact: values.artifact, commit: values.commit, output: values.output, claude: values.claude, github: values.github, previousArtifact: values['previous-artifact'] });
    console.log(JSON.stringify({ status: result.status, installed_files_verified: result.installed_files_verified, journeys: result.observations.length, model_calls: 0, output: resolve(values.output) }));
}
