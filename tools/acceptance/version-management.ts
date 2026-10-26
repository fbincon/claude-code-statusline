import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname, delimiter, relative, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { npmEntry, readTar } from '../build/files.js';
import { compareVersions } from '@fbincon/statusline-core/management/compatibility';
import { HISTORICAL_RELEASES, type HistoricalRelease } from './historical-releases.js';
import { prepareHistorical } from './historical-inputs.js';
import type { installCandidate } from './install.js';
import { officialEnvironment } from './install.js';
import { VERSION_OPERATION_MS, VERSION_SEQUENCE_MS, OFFICIAL_VERSION_SEQUENCE_MS } from './budgets.js';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
export interface VersionHost {
    executable: string;
    args: readonly string[];
    version: string;
}
type Input = Pick<ReturnType<typeof installCandidate>, 'temporary' | 'node' | 'root' | 'entry' | 'env'> & {
    artifact: string;
    npm: string;
    legacy: string;
    legacyManifest: any;
    historicalVersion: HistoricalRelease;
    historicalSha256: string;
    trace: string;
    host?: VersionHost;
};
export async function installedVersionManagement(installed: ReturnType<typeof installCandidate>, host?: VersionHost, tracePath?: string): Promise<Record<string, unknown>> {
    const first = await historicalSequence(installed, '3.7.0', host, tracePath);
    const target = JSON.parse(fs.readFileSync(join(installed.root, 'package.json'), 'utf8')).version;
    if (compareVersions(target, '3.8.0') > 0)
        first.previous_release = await historicalSequence(installed, '3.8.0', host, tracePath ? tracePath + '.3.8.0.jsonl' : undefined);
    return first;
}
async function historicalSequence(installed: ReturnType<typeof installCandidate>, historicalVersion: HistoricalRelease, host?: VersionHost, tracePath?: string): Promise<Record<string, unknown>> {
    // Keep the established Unicode/shell-character fixture depth: Node 22.0.0 on
    // Windows can lose package type resolution when recovery manifests grow deeper.
    const temporary = fs.realpathSync.native(fs.mkdtempSync(join(dirname(installed.temporary), 'ts05 version 中文 $` & ')));
    try {
        return await historicalSequenceIn(installed, historicalVersion, temporary, host, tracePath);
    } finally {
        removeTree(temporary);
    }
}
async function historicalSequenceIn(installed: ReturnType<typeof installCandidate>, historicalVersion: HistoricalRelease, temporary: string, host?: VersionHost, tracePath?: string): Promise<Record<string, unknown>> {
    const legacy = join(temporary, 'historical-' + historicalVersion + '.tgz');
    await prepareHistorical(historicalVersion, legacy);
    const historicalSha256 = HISTORICAL_RELEASES[historicalVersion];
    assert.equal(createHash('sha256').update(fs.readFileSync(legacy)).digest('hex'), historicalSha256);
    const trace = tracePath ?? (process.env.TS04_INSTALLED_REPORT ? process.env.TS04_INSTALLED_REPORT + '.version-management.' + historicalVersion + '.jsonl' : join(temporary, 'version-management-trace.jsonl'));
    fs.mkdirSync(dirname(trace), { recursive: true });
    fs.writeFileSync(trace, '', { mode: 0o600 });
    const input: Input = { temporary, node: installed.node, root: installed.root, entry: installed.entry, env: host ? officialEnvironment({ ...installed, temporary }) as typeof installed.env : installed.env, artifact: installed.packed.tarball, npm: npmEntry(), legacy, legacyManifest: JSON.parse(readTar(legacy).get('package.json')!.toString('utf8')), historicalVersion, historicalSha256, trace, host };
    const program = `import {versionManagementChild} from ${JSON.stringify(import.meta.url)};console.log(JSON.stringify(await versionManagementChild(JSON.parse(process.argv[1]))));`;
    const result = spawnSync(installed.node, ['--input-type=module', '-e', program, JSON.stringify(input)], { cwd: installed.directory, encoding: 'utf8', timeout: host ? OFFICIAL_VERSION_SEQUENCE_MS : VERSION_SEQUENCE_MS, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    const diagnostics = result.stderr + result.stdout + '\n' + fs.readFileSync(trace, 'utf8').slice(-16000);
    assert.equal(result.error, undefined, diagnostics);
    assert.equal(result.status, 0, diagnostics);
    return JSON.parse(result.stdout);
}
export async function versionManagementChild(input: Input): Promise<Record<string, unknown>> {
    const { historicalVersion, historicalSha256 } = input;
    const manifest = JSON.parse(fs.readFileSync(join(input.root, 'package.json'), 'utf8')), targetVersion = manifest.version;
    const incompatibleVersion = (Number(targetVersion.split('.')[0]) + 1) + '.0.0';
    const targetBytes = fs.readFileSync(input.artifact), legacyBytes = fs.readFileSync(input.legacy);
    const sri = (bytes: Buffer) => 'sha512-' + createHash('sha512').update(bytes).digest('base64');
    let registry = '', badIntegrity = false;
    const server = createServer((request, response) => {
        if (request.url === '/target.tgz' || request.url === '/legacy.tgz') {
            response.end(request.url === '/target.tgz' ? targetBytes : legacyBytes);
            return;
        }
        if (decodeURIComponent(request.url ?? '').replace(/\/$/u, '') !== '/@fbincon/claude-code-statusline') {
            response.statusCode = 404;
            response.end('{}');
            return;
        }
        const target = { ...manifest, dist: { tarball: registry + 'target.tgz', integrity: badIntegrity ? 'sha512-' + Buffer.alloc(64).toString('base64') : sri(targetBytes) } };
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ name: manifest.name, 'dist-tags': { latest: targetVersion }, versions: {
                [targetVersion]: target, [historicalVersion]: { ...input.legacyManifest, dist: { tarball: registry + 'legacy.tgz', integrity: sri(legacyBytes) } },
                [incompatibleVersion]: { ...target, version: incompatibleVersion, statuslineCompatibility: { ...manifest.statuslineCompatibility, node: { '26': '26.0.0' } } },
            } }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    registry = 'http://127.0.0.1:' + (server.address() as {
        port: number;
    }).port + '/';
    const prefix = join(input.temporary, 'update prefix 中文'), configDir = join(input.temporary, 'update-config'), hostBin = join(input.temporary, 'version-only-host'), root = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules', manifest.name), entry = join(root, 'node_modules/@fbincon/statusline-cli/dist/src/entry.js');
    fs.mkdirSync(hostBin);
    const hostRoot = join(hostBin, 'node_modules/@anthropic-ai/claude-code');
    fs.mkdirSync(hostRoot, { recursive: true });
    fs.writeFileSync(join(hostRoot, 'package.json'), JSON.stringify({ bin: { claude: 'cli.js' } }));
    const hostSource = input.host ? `#!/usr/bin/env node\nconst {spawnSync}=require('node:child_process');const r=spawnSync(${JSON.stringify(input.host.executable)},[...${JSON.stringify(input.host.args)},...process.argv.slice(2)],{stdio:'inherit',shell:false});process.exit(r.status??2);\n` : "#!/usr/bin/env node\nif(process.argv[2]!=='--version')process.exit(2);console.log('2.1.258 (version-only acceptance fixture)');\n";
    fs.writeFileSync(join(hostRoot, 'cli.js'), hostSource);
    if (process.platform === 'win32')
        fs.writeFileSync(join(hostBin, 'claude.cmd'), '@echo off\r\n');
    else {
        fs.writeFileSync(join(hostBin, 'claude'), hostSource);
        fs.chmodSync(join(hostBin, 'claude'), 0o700);
    }
    const userconfig = join(input.temporary, 'update-user-npmrc'), globalconfig = join(input.temporary, 'update-global-npmrc');
    fs.writeFileSync(userconfig, '');
    fs.writeFileSync(globalconfig, '');
    const env = { ...input.env, PATH: hostBin + delimiter + input.env.PATH, npm_execpath: input.npm, npm_config_registry: registry, npm_config_userconfig: userconfig, npm_config_globalconfig: globalconfig, npm_config_cache: join(input.temporary, 'update-cache'), npm_config_prefer_online: 'true', CLAUDE_CONFIG_DIR: configDir };
    let sequence = 0;
    const timings: { command: string; elapsed_ms: number }[] = [];
    const trace = (value: Record<string, unknown>) => fs.appendFileSync(input.trace, JSON.stringify({ at: new Date().toISOString(), node: process.version, ...value }) + '\n');
    const transaction = () => {
        try {
            const marker = JSON.parse(fs.readFileSync(join(prefix, '.claude-statusline-operation.json'), 'utf8'));
            const operation = JSON.parse(fs.readFileSync(join(configDir, 'statusline_runtime/package-management/transactions', marker.id, 'operation.json'), 'utf8'));
            return { stage: operation.stage, version: operation.version, results: operation.results, executors: operation.executors?.length ?? 0 };
        } catch { return null; }
    };
    const invoke = (args: string[], success = true, inputData = '') => new Promise<{
        code: number | null;
        stdout: string;
        stderr: string;
    }>((resolve, reject) => {
        const id = ++sequence, started = performance.now(), label = args[0] === '--input-type=module' ? 'crash-after-package-verification' : basename(args[0]!) + ' ' + args.slice(1, 3).join(' ');
        trace({ phase: 'start', id, command: label, argv: args[0] === '--input-type=module' ? ['<controlled crash checkpoint>'] : args });
        const child = spawn(input.node, args, { cwd: input.temporary, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        const timer = setTimeout(() => {
            trace({ phase: 'timeout', id, command: label, elapsed_ms: performance.now() - started, transaction: transaction(), stdout: stdout.slice(-4000), stderr: stderr.slice(-4000) });
            child.kill('SIGKILL');
            reject(new Error('Installed version operation timed out: ' + label));
        }, VERSION_OPERATION_MS);
        child.stdout.on('data', b => stdout += b);
        child.stderr.on('data', b => stderr += b);
        child.stdin.end(inputData);
        child.once('error', error => { clearTimeout(timer); trace({ phase: 'error', id, command: label, error: error.message }); reject(error); });
        child.once('exit', (code, signal) => {
            clearTimeout(timer);
            const elapsed_ms = performance.now() - started;
            timings.push({ command: label, elapsed_ms });
            trace({ phase: 'exit', id, command: label, code, signal, elapsed_ms, ...(code !== 0 ? { transaction: transaction(), stdout: stdout.slice(-4000), stderr: stderr.slice(-4000) } : {}) });
            try {
                if (success)
                    assert.equal(code, 0, stderr + stdout);
                resolve({ code, stdout, stderr });
            }
            catch (error) {
                reject(error);
            }
        });
    });
    const command = (launch: string, action: string, version: string, extra: string[] = []) => [launch, action, '--version', version, '--prefix', relative(input.temporary, prefix), '--config-dir', relative(input.temporary, configDir), '--yes', ...extra];
    const version = async () => { const result = await invoke([entry, '--version']); return result.stdout.trim(); };
    const state = () => JSON.parse(fs.readFileSync(join(configDir, 'statusline_runtime/installation.json'), 'utf8'));
    const historyRoot = join(configDir, 'statusline_runtime/package-management/installations');
    const historyRecord = () => JSON.parse(fs.readFileSync(join(historyRoot, fs.readdirSync(historyRoot)[0]!), 'utf8'));
    let schemaMigration: Record<string, unknown> | null = null;
    try {
        await invoke([input.npm, 'install', '--global', '--prefix', prefix, '--offline', '--ignore-scripts', '--bin-links=true', input.legacy]);
        await invoke([entry, 'install', '--config-dir', configDir, input.host ? '--native-editor' : '--no-native-editor', '--no-experimental-slash-tui', input.host && Number(input.host.version.split('.')[2]) >= 289 ? '--native-timing' : '--no-native-timing', '--no-live-metrics']);
        await invoke([entry, 'config', '--config-dir', configDir, 'set', 'colors', 'on']);
        await invoke([entry, 'config', '--config-dir', configDir, 'profile', 'save', 'Before upgrade', '--bind', input.temporary]);
        const display = fs.readFileSync(join(configDir, 'claude-statusline.json')), profiles = fs.readFileSync(join(configDir, 'claude-statusline-profiles.json'));
        const settingsPath = join(configDir, 'settings.json'), settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        settings.env = { KEEP: 'unchanged' };
        fs.writeFileSync(settingsPath, JSON.stringify(settings), { mode: 0o600 });
        badIntegrity = true;
        const corrupt = await invoke(command(input.entry, 'update', targetVersion), false);
        assert.equal(corrupt.code, 2);
        assert.match(corrupt.stderr, /integrity/);
        assert.equal(await version(), 'claude-statusline ' + historicalVersion);
        badIntegrity = false;
        const incompatible = await invoke(command(input.entry, 'update', incompatibleVersion), false);
        assert.equal(incompatible.code, 2);
        assert.equal(await version(), 'claude-statusline ' + historicalVersion);
        const checked = await invoke([input.entry, 'update', '--check', '--json', '--prefix', prefix, '--config-dir', configDir]);
        assert.equal(JSON.parse(checked.stdout).target, targetVersion);
        await invoke(command(input.entry, 'update', targetVersion));
        assert.equal(await version(), 'claude-statusline ' + targetVersion);
        assert.equal(state().backend_version, targetVersion);
        assert.equal(state().launch.args[0], entry);
        const upgraded = JSON.parse(fs.readFileSync(join(configDir, 'claude-statusline.json'), 'utf8'));
        const previous = JSON.parse(display.toString('utf8'));
        const schema = manifest.statuslineCompatibility.read.display[1];
        assert.deepEqual(upgraded, { ...previous, schema_version: schema });
        assert.deepEqual(fs.readFileSync(join(configDir, 'claude-statusline-profiles.json')), profiles);
        if (schema > previous.schema_version) {
            const upgrade = historyRecord();
            const rejected = await invoke(command(entry, 'rollback', historicalVersion), false);
            assert.equal(rejected.code, 2);
            assert.match(rejected.stdout + rejected.stderr, /schema|configuration|Configuration/u);
            assert.equal(await version(), 'claude-statusline ' + targetVersion);
            await invoke([entry, 'recover', '--restore-config', upgrade.transaction, '--prefix', prefix, '--config-dir', configDir, '--yes']);
            assert.deepEqual(fs.readFileSync(join(configDir, 'claude-statusline.json')), display);
            assert.deepEqual(fs.readFileSync(join(configDir, 'claude-statusline-profiles.json')), profiles);
            schemaMigration = { from: previous.schema_version, to: schema, old_version_refused: true, backup_restored: true };
        }
        // This invocation starts in the directory that npm replaces. It must
        // leave that package before loading Koffi or Windows cannot replace it.
        await invoke(command(entry, 'rollback', historicalVersion));
        assert.equal(await version(), 'claude-statusline ' + historicalVersion);
        assert.equal(state().backend_version, historicalVersion);
        assert.deepEqual(fs.readFileSync(join(configDir, 'claude-statusline-profiles.json')), profiles);
        const history = historyRecord();
        const recoveryRoot = join(configDir, 'statusline_runtime/package-management/transactions', history.transaction, 'recovery-runner'), recoveryEntry = join(recoveryRoot, 'bin/claude-statusline.js');
        assert(fs.existsSync(recoveryEntry));
        const serviceURL = pathToFileURL(join(recoveryRoot, 'node_modules/@fbincon/statusline-cli/dist/src/management/service.js')).href;
        const crash = `import {manage} from ${JSON.stringify(serviceURL)};await manage(${JSON.stringify(command(recoveryEntry, 'update', targetVersion).slice(1))},{origin:${JSON.stringify(recoveryRoot)},stdout:s=>process.stdout.write(s),stderr:s=>process.stderr.write(s),checkpoint:stage=>{if(stage==='package_verified')process.kill(process.pid,'SIGKILL');}});`;
        const stopped = await invoke(['--input-type=module', '-e', crash], false);
        assert.notEqual(stopped.code, 0);
        assert.equal(transaction()?.stage, 'package_verified', stopped.stderr + stopped.stdout);
        assert.equal(await version(), 'claude-statusline ' + targetVersion);
        const markerPath = join(prefix, '.claude-statusline-operation.json'), marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        const stamp = fs.statSync(entry).mtimeMs;
        await invoke(command(entry, 'recover', targetVersion, ['--package']));
        assert(!fs.existsSync(markerPath));
        assert.equal(fs.statSync(entry).mtimeMs, stamp);
        assert.equal(state().backend_version, targetVersion);
        if (input.host)
            await invoke([entry, 'install', '--config-dir', configDir, '--no-native-editor', '--no-native-timing']);
        await invoke([entry, 'config', '--config-dir', configDir, 'set', 'colors', 'off']);
        await invoke([entry, 'recover', '--restore-config', marker.id, '--prefix', prefix, '--config-dir', configDir, '--yes']);
        assert.deepEqual(fs.readFileSync(join(configDir, 'claude-statusline.json')), display);
        assert.deepEqual(fs.readFileSync(join(configDir, 'claude-statusline-profiles.json')), profiles);
        assert.equal(JSON.parse(fs.readFileSync(join(configDir, 'claude-statusline-native.json'), 'utf8')).native_editor, false);
        assert.equal(JSON.parse(fs.readFileSync(settingsPath, 'utf8')).env.KEEP, 'unchanged');
        const render = await invoke([entry, 'render'], true, JSON.stringify({ model: { display_name: 'After version recovery' } }));
        assert(render.stdout.includes('After version recovery'));
        return { cases: 7, historical_version: historicalVersion, historical_sha256: historicalSha256, target_version: targetVersion, schema_migration: schemaMigration, roundtrip: true, independent_runner: true, crash_recovery: true, configuration_restore: true, real_npm: true, registry: 'controlled-loopback', host: input.host?.version ?? 'version-only-2.1.258', host_mode: input.host ? 'official' : 'version-only', model_calls: 0, operation_timings: timings };
    }
    finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
}
