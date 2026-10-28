import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname, delimiter, relative, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import type { Writable } from 'node:stream';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { npmEntry, readTar } from '../build/files.js';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
import { compareVersions } from '@fbincon/statusline-core/management/compatibility';
import { HISTORICAL_RELEASES, type HistoricalRelease } from './historical-releases.js';
import { prepareHistorical } from './historical-inputs.js';
import type { installCandidate } from './install.js';
import { officialEnvironment } from './install.js';
import { VERSION_OPERATION_MS, VERSION_SEQUENCE_MS, OFFICIAL_VERSION_SEQUENCE_MS } from './budgets.js';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { runSourceProcess } from '@fbincon/statusline-platform/source-process';
export interface VersionHost {
    executable: string;
    args: readonly string[];
    version: string;
}
/** Early stdin closure is judged by the command's exit/output assertions. */
export function writeVersionInput(stream: Writable, input: string, failed: (error: Error) => void): void {
    stream.on('error', error => {
        const code = (error as NodeJS.ErrnoException).code;
        // Windows named pipes can report EOF for the same closed-reader case.
        if (code !== 'EPIPE' && !(process.platform === 'win32' && code === 'EOF')) failed(error);
    });
    stream.end(input);
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
    const target = JSON.parse(fs.readFileSync(join(installed.root, 'package.json'), 'utf8')).version;
    const controller = new AbortController(), stop = () => controller.abort();
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
    try {
        const versions: HistoricalRelease[] = compareVersions(target, '3.8.0') > 0 ? ['3.7.0', '3.8.0'] : ['3.7.0'];
        let primaryFailure: { error: unknown } | undefined;
        const results = await Promise.allSettled(versions.map(version => historicalSequence(installed, version, controller.signal, host,
            version === '3.7.0' || !tracePath ? tracePath : tracePath + '.3.8.0.jsonl').catch(error => { primaryFailure ??= { error }; controller.abort(); throw error; })));
        if (primaryFailure) throw primaryFailure.error;
        const failed = results.find(result => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
        const values = results.map(result => (result as PromiseFulfilledResult<Record<string, unknown>>).value);
        const first = values[0]!; if (values[1]) first.previous_release = values[1]; return first;
    } finally { process.off('SIGTERM', stop); process.off('SIGINT', stop); }
}
async function historicalSequence(installed: ReturnType<typeof installCandidate>, historicalVersion: HistoricalRelease, signal: AbortSignal, host?: VersionHost, tracePath?: string): Promise<Record<string, unknown>> {
    // Keep the established Unicode/shell-character fixture depth: Node 22.0.0 on
    // Windows can lose package type resolution when recovery manifests grow deeper.
    const temporary = fs.realpathSync.native(fs.mkdtempSync(join(dirname(installed.temporary), 'ts05 version 中文 $` & ')));
    try {
        return await historicalSequenceIn(installed, historicalVersion, temporary, signal, host, tracePath);
    } finally {
        removeTree(temporary);
    }
}
async function historicalSequenceIn(installed: ReturnType<typeof installCandidate>, historicalVersion: HistoricalRelease, temporary: string, signal: AbortSignal, host?: VersionHost, tracePath?: string): Promise<Record<string, unknown>> {
    const legacy = join(temporary, 'historical-' + historicalVersion + '.tgz');
    await prepareHistorical(historicalVersion, legacy);
    const historicalSha256 = HISTORICAL_RELEASES[historicalVersion];
    assert.equal(createHash('sha256').update(fs.readFileSync(legacy)).digest('hex'), historicalSha256);
    const trace = tracePath ?? (process.env.TS04_INSTALLED_REPORT ? process.env.TS04_INSTALLED_REPORT + '.version-management.' + historicalVersion + '.jsonl' : join(temporary, 'version-management-trace.jsonl'));
    fs.mkdirSync(dirname(trace), { recursive: true });
    fs.writeFileSync(trace, '', { mode: 0o600 });
    const isolated = { ...installed, temporary, env: { ...installed.env, HOME: join(temporary, 'home'), USERPROFILE: join(temporary, 'home'), CLAUDE_CONFIG_DIR: join(temporary, 'host-config'), npm_config_cache: join(temporary, 'bootstrap-cache') } };
    fs.mkdirSync(isolated.env.HOME, { recursive: true, mode: 0o700 });
    const input: Input = { temporary, node: installed.node, root: installed.root, entry: installed.entry, env: host ? officialEnvironment(isolated) as typeof installed.env : isolated.env, artifact: installed.packed.tarball, npm: npmEntry(), legacy, legacyManifest: JSON.parse(readTar(legacy).get('package.json')!.toString('utf8')), historicalVersion, historicalSha256, trace, host };
    const program = `import {versionManagementChild} from ${JSON.stringify(import.meta.url)};console.log(JSON.stringify(await versionManagementChild(JSON.parse(process.argv[1]))));`;
    let stderr = '';
    const result = await runSourceProcess({ executable: installed.node, args: ['--input-type=module', '-e', program, JSON.stringify(input)], cwd: installed.directory, input: '',
        environment: process.env, timeoutMs: host ? OFFICIAL_VERSION_SEQUENCE_MS : VERSION_SEQUENCE_MS, signal, captureStderr: value => { stderr = value; } });
    const diagnostics = stderr + result.stdout + '\n' + fs.readFileSync(trace, 'utf8').slice(-16000);
    assert.equal(result.reason, 'completed', diagnostics);
    assert.equal(result.code, 0, diagnostics);
    return JSON.parse(result.stdout);
}
export async function versionManagementChild(input: Input): Promise<Record<string, unknown>> {
    const { historicalVersion, historicalSha256 } = input;
    const manifest = JSON.parse(fs.readFileSync(join(input.root, 'package.json'), 'utf8')), targetVersion = manifest.version;
    const incompatibleVersion = (Number(targetVersion.split('.')[0]) + 1) + '.0.0';
    const targetBytes = fs.readFileSync(input.artifact), legacyBytes = fs.readFileSync(input.legacy);
    const sri = (bytes: Buffer) => 'sha512-' + createHash('sha512').update(bytes).digest('base64');
    let registry = '', badIntegrity = false;
    let registryRequests=0;
    const server = createServer((request, response) => {
        registryRequests++;
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
    if (process.env.TS06_PROFILE_MANAGEMENT === '1') Object.assign(env, {
        NODE_OPTIONS: '--import=' + new URL('./trace-process.js', import.meta.url).href,
        STATUSLINE_ACCEPTANCE_TIMINGS: input.trace + '.phases.jsonl',
    });
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
        const operation=args[1]==='ui'&&inputData?JSON.parse(inputData).operation:null;
        const id = ++sequence, started = performance.now(), label = operation?'ui '+operation:args[0] === '--input-type=module' ? 'crash-after-package-verification' : basename(args[0]!) + ' ' + args.slice(1, 3).join(' ');
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
        const failed = (error: Error) => { clearTimeout(timer); trace({ phase: 'error', id, command: label, error: error.message }); child.kill('SIGKILL'); reject(error); };
        child.once('error', failed);
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
        writeVersionInput(child.stdin, inputData, failed);
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
        const reviewTimingStart=timings.length;
        const ui=async(operation:string,payload:unknown)=>JSON.parse((await invoke([entry,'ui','--config-dir',configDir],true,JSON.stringify({protocol_version:PROTOCOL_VERSION,operation,payload}))).stdout).result;
        const names=['settings.json','claude-statusline.json','claude-statusline-profiles.json','claude-statusline-sources.json','claude-statusline-runtime.json','claude-statusline-native.json','claude-statusline-features.json','statusline-ui.json','statusline_runtime/installation.json'];
        const configuration=()=>Object.fromEntries(names.map(name=>[name,fs.existsSync(join(configDir,name))?fs.readFileSync(join(configDir,name)).toString('base64'):null]));
        const savedConfiguration=configuration(),savedPackage=fs.readFileSync(join(root,'candidate.json')),entryStamp=fs.statSync(entry).mtimeMs;
        const requestsBefore=registryRequests;
        const local=await ui('package_status',{prefix,offset:0});
        assert.equal(local.current,targetVersion);assert.equal(registryRequests,requestsBefore);
        const owner='viewer-acceptance-'+Date.now();
        const request={action:'check',prefix,expected_revision:local.revision,target:targetVersion,channel:null,backup_id:null,expected_integrity:null};
        const finished=async(job:any)=>{
            const stop=Date.now()+VERSION_OPERATION_MS;
            while(job.state==='running'&&Date.now()<stop){await new Promise(resolve=>setTimeout(resolve,250));job=await ui('package_review_status',{id:job.id,owner});}
            assert.equal(job.state,'complete',JSON.stringify(job));return job;
        };
        const metadata=await finished(await ui('package_review_start',{owner,request}));assert.equal(metadata.review.artifact_verified,false);
        await ui('package_review_cancel',{id:metadata.id,owner});
        const verified=await finished(await ui('package_review_start',{owner,request:{...request,action:'update',expected_integrity:metadata.review.integrity}}));
        assert.equal(verified.review.artifact_verified,true);await ui('package_review_cancel',{id:verified.id,owner});
        const rollback=await finished(await ui('package_review_start',{owner,request:{...request,action:'rollback',target:historicalVersion}}));
        assert.equal(rollback.review.artifact_verified,true);await ui('package_review_cancel',{id:rollback.id,owner});
        const restoration=await finished(await ui('package_review_start',{owner,request:{...request,action:'restore-config',target:null,backup_id:marker.id}}));
        assert.equal(restoration.review.action,'restore-config');await ui('package_review_cancel',{id:restoration.id,owner});
        const cancelled=await ui('package_review_start',{owner,request});assert.equal((await ui('package_review_cancel',{id:cancelled.id,owner})).state,'cancelled');
        assert.deepEqual(configuration(),savedConfiguration);assert.deepEqual(fs.readFileSync(join(root,'candidate.json')),savedPackage);assert.equal(fs.statSync(entry).mtimeMs,entryStamp);assert(!transaction());
        const editorReview={local_reads_no_network:true,metadata_unverified:true,verified_dry_run:true,rollback_review:true,restore_review:true,cancellation:true,configuration_unchanged:true,package_unchanged:true,operation_timings:timings.splice(reviewTimingStart)};
        return { editor_review:editorReview, cases: 7, historical_version: historicalVersion, historical_sha256: historicalSha256, target_version: targetVersion, schema_migration: schemaMigration, roundtrip: true, independent_runner: true, crash_recovery: true, configuration_restore: true, real_npm: true, registry: 'controlled-loopback', host: input.host?.version ?? 'version-only-2.1.258', host_mode: input.host ? 'official' : 'version-only', model_calls: 0, operation_timings: timings };
    }
    finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
}
