import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { createServer } from 'node:http';
import { delimiter, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { defaultDisplay } from '@fbincon/statusline-core/config/display';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { globalPackageRoot, productIdentity } from '@fbincon/statusline-platform/npm';
import { npmEntry, readTar, sha256 } from '../../build/files.js';
import { officialEnvironment, type installCandidate } from '../install.js';
import { verifyHistorical } from '../historical-inputs.js';

const published = {
    '3.16.3': '7b5d8c122b074937ded4d574cfbf0fcac5b76df6d420622cc4ef69f3283c733c',
    '3.16.4': '4081e2bb077fa0d51b668f7d60fa6fd4881395ba3e24567d5ab7dbda4cceefcd',
};
const names = ['statusline-native', 'statusline-runtime'] as const;
const ids = ['statusline-native@claude-statusline-local', 'statusline-runtime@claude-statusline-runtime-local'];
const runProcess = promisify(execFile);

/** Replay #292 on real Claude binaries and three immutable npm archives. */
export async function pluginRecovery(installed: ReturnType<typeof installCandidate>, fixtures: string, currentHost: string, baselineHost: string) {
    const npm = npmEntry(), root = installed.temporary, prefix = join(root, 'managed 中文 &'), config = join(root, 'Claude config 中文 &');
    const identity = productIdentity(installed.root);
    assert(identity && identity.version !== '3.16.4', 'Use a new application version for the recovery and upgrade candidate');
    const archive = (version: string) => resolve(fixtures, 'fbincon-claude-code-statusline-' + version + '.tgz');
    const inputs = Object.entries(published).map(([version, digest]) => {
        const path = archive(version);
        verifyHistorical(fs.readFileSync(path), digest);
        return path;
    });
    const packages = [...inputs, installed.packed.tarball].map(path => ({
        bytes: fs.readFileSync(path), manifest: JSON.parse(readTar(path).get('package.json')!.toString('utf8')),
    }));
    const packageName = packages[0]!.manifest.name;
    let registry = '';
    const server = createServer((request, response) => {
        const pathname = decodeURIComponent(request.url ?? '').replace(/\/$/u, '');
        if (pathname === '/' + packageName) {
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify({ name: packageName, 'dist-tags': { latest: identity.version },
                versions: Object.fromEntries(packages.map(({ bytes, manifest }) => [manifest.version, {
                    ...manifest, dist: { tarball: registry + manifest.version + '.tgz', integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') },
                }])) }));
            return;
        }
        const found = packages.find(({ manifest }) => pathname === '/' + manifest.version + '.tgz');
        response.statusCode = found ? 200 : 404;
        response.end(found?.bytes);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const address = server.address();
        assert(address && typeof address === 'object');
        registry = 'http://127.0.0.1:' + address.port + '/';

        const userconfig = join(root, 'user.npmrc'), globalconfig = join(root, 'global.npmrc');
        fs.writeFileSync(userconfig, '');
        fs.writeFileSync(globalconfig, '');
        const environment: NodeJS.ProcessEnv = { ...officialEnvironment(installed), npm_execpath: npm, npm_config_registry: registry,
            npm_config_userconfig: userconfig, npm_config_globalconfig: globalconfig, npm_config_ignore_scripts: 'true' };
        const hostEnv = async (executable: string, version: string): Promise<NodeJS.ProcessEnv> => {
            const host = claudeLaunch(executable), directory = join(root, 'host-' + version);
            fs.mkdirSync(directory);
            const bin = join(directory, process.platform === 'win32' ? 'claude.exe' : 'claude');
            assert.deepEqual(host.args, [], 'Replay requires the actual native binary');
            if (process.platform === 'win32') {
                try { fs.linkSync(host.executable, bin); }
                catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
                    fs.copyFileSync(host.executable, bin);
                }
            } else fs.symlinkSync(host.executable, bin);
            const env = { ...environment, PATH: directory + delimiter + environment.PATH, CLAUDE_CONFIG_DIR: config };
            const result = await runProcess(host.executable, ['--version'], { env, cwd: root, timeout: 10000 });
            assert.equal(result.stdout.match(/\d+\.\d+\.\d+/u)?.[0], version);
            return env;
        };
        const oldEnv = await hostEnv(baselineHost, '2.1.322'), env = await hostEnv(currentHost, '2.1.330');
        const steps: { step: string; status: number }[] = [];
        const call = async (step: string, executable: string, args: string[], env: NodeJS.ProcessEnv, expected = 0, input?: string) => {
            let result: { status: number | string; stdout: string; stderr: string };
            const child = runProcess(executable, args, { env, cwd: root, timeout: 240000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
            child.child.stdin?.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') throw error; });
            child.child.stdin?.end(input);
            try { result = { status: 0, ...await child }; }
            catch (error) {
                const failure = error as { code?: number | string; stdout?: string; stderr?: string };
                result = { status: failure.code ?? 'failed', stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
            }
            assert.equal(result.status, expected, step + '\n' + result.stdout.slice(-3000) + '\n' + result.stderr.slice(-3000));
            steps.push({ step, status: expected });
            return result;
        };
        const read = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
        const write = (path: string, value: unknown) => fs.writeFileSync(path, JSON.stringify(value) + '\n', { mode: 0o600 });
        const exe = claudeLaunch(currentHost).executable;
        const packageRoot = globalPackageRoot(prefix);
        const entryPath = () => {
            const found = productIdentity(packageRoot, prefix);
            assert(found, 'Managed package identity is missing');
            return found.entry;
        };
        const manage = (step: string, entry: string, args: string[], status = 0) =>
            call(step, installed.node, [entry, '--language', 'en', ...args, '--prefix', prefix, '--config-dir', config], env, status);
        const command = (step: string, args: string[], cmdEnv = env) =>
            call(step, installed.node, [entryPath(), '--language', 'en', args[0]!, '--config-dir', config, ...args.slice(1)], cmdEnv);
        const list = async (cmdEnv: NodeJS.ProcessEnv) => {
            const host = cmdEnv === oldEnv ? claudeLaunch(baselineHost).executable : exe;
            const { stdout } = await call('plugin inventory', host, ['plugin', 'list', '--json'], cmdEnv);
            const rows = JSON.parse(stdout) as { id: string; version: string; enabled: boolean; installPath: string }[];
            return ids.map(id => { const row = rows.find(item => item.id === id); assert(row, 'Missing ' + id); return row; });
        };
        const bindings = async (version: string, cmdEnv: NodeJS.ProcessEnv) => {
            const host = cmdEnv === oldEnv ? claudeLaunch(baselineHost).executable : exe;
            for (const [index, row] of (await list(cmdEnv)).entries()) {
                assert.equal(row.version, version);
                assert.equal(row.enabled, true);
                assert.equal(read(join(row.installPath, '.claude-plugin', 'plugin.json')).version, version);
                const { stdout } = await call('backend binding ' + row.id, host, ['plugin', 'configure', row.id, '--json'], cmdEnv);
                const { inputs } = JSON.parse(stdout);
                assert.equal(inputs.backendVersion, version);
                assert.equal(inputs.configDir, config);
                assert.deepEqual(JSON.parse(inputs.backendArgs), [entryPath()]);
                if (index === 1) for (const key of ['nativeTiming', 'liveMetrics', 'sourceRefresh']) assert.equal(inputs[key], 'true', key);
            }
        };
        const marker = join(prefix, '.claude-statusline-operation.json');
        const operationPath = () => join(config, 'statusline_runtime', 'package-management', 'transactions', read(marker).id, 'operation.json');
        const settings = join(config, 'settings.json'), display = join(config, 'claude-statusline.json'), ui = join(config, 'statusline-ui.json');
        const sentinel = { STATUSLINE_ACCEPTANCE_KEEP: 'yes' };
        const installArgs = ['install', '--native-timing', '--live-metrics'];

        fs.mkdirSync(config);
        write(settings, { env: sentinel });
        write(display, defaultDisplay());
        write(ui, { schema_version: 1, ui_language: 'de' });
        await call('install published 3.16.3', installed.node, [npm, 'install', '--global', '--prefix', prefix, '--offline', '--ignore-scripts', inputs[0]!], oldEnv);
        assert.equal(productIdentity(packageRoot, prefix)?.version, '3.16.3');

        const source = join(root, 'source.json'), sources = join(config, 'claude-statusline-sources.json');
        write(source, { name: 'Controlled fixture', kind: 'command', scope: { project: root, session: null, agent: null },
            ttl_seconds: 300, settings: { executable: installed.node, args: ['--version'], cwd: root, input: {}, timeout_ms: 5000 } });
        await command('register source', ['source', 'add', 'fixture', '--file', source], oldEnv);
        const review = JSON.parse((await command('review source', ['source', 'review', 'fixture', '--json'], oldEnv)).stdout).review_revision;
        await command('enable reviewed source', ['source', 'enable', 'fixture', '--review', review], oldEnv);
        await command('enable source refresh', ['source', 'auto-on', 'fixture', '--review', review, '--interval', '300'], oldEnv);
        await command('integrate 3.16.3 on Claude 2.1.322', installArgs, oldEnv);
        await bindings('3.16.3', oldEnv);
        const preferencePaths = [display, ui, sources, join(config, 'claude-statusline-runtime.json')];
        const preferences = () => preferencePaths.map(path => ({ sha256: sha256(fs.readFileSync(path)), mode: fs.statSync(path).mode }));
        const before = preferences();

        await manage('reproduce unfinished 3.16.4 update', entryPath(), ['update', '--version', '3.16.4', '--yes'], 2);
        assert.equal(productIdentity(packageRoot, prefix)?.version, '3.16.4');
        const failedOperation = operationPath();
        assert.equal(read(failedOperation).stage, 'uncertain');
        assert.deepEqual(read(failedOperation).results, { package: true, integration: false, error: 'integration_failed' });
        for (const row of await list(env)) assert.equal(row.version, '3.16.3');
        for (const name of names) {
            const folder = join(config, name, 'plugins', name);
            const strict = await call('reproduce strict validation ' + name, exe, ['plugin', 'validate', '--strict', folder], env, 1);
            assert.match(strict.stdout + strict.stderr, /README_MISSING|TS5097|--strict treats warnings as errors/u);
            await call('ordinary runtime validation ' + name, exe, ['plugin', 'validate', folder], env);
        }
        const corrupt = join(root, 'invalid-plugin-fixture');
        fs.cpSync(join(config, names[0], 'plugins', names[0]), corrupt, { recursive: true });
        for (const file of ['.claude-plugin/plugin.json', 'hooks/hooks.json']) {
            const path = join(corrupt, file), original = fs.readFileSync(path);
            fs.writeFileSync(path, '{');
            await call('reject invalid ' + file, exe, ['plugin', 'validate', corrupt], env, 1);
            fs.writeFileSync(path, original);
        }

        await manage('unfinished update check', entryPath(), ['update', '--check'], 2);
        const recover = [join(dirname(npm), 'npx-cli.js'), '--yes', '--package', packageName + '@' + identity.version, '--',
            'claude-statusline', '--language', 'en', 'recover', '--package', '--version', '3.16.4', '--prefix', prefix, '--config-dir', config];
        const prior = fs.readFileSync(failedOperation);
        const npxEnv = process.platform === 'win32' ? env : { ...env, npm_config_script_shell: '/bin/sh' };
        await call('preview the retained transaction using npx', installed.node, [...recover, '--dry-run'], npxEnv);
        assert.deepEqual(fs.readFileSync(failedOperation), prior);
        await call('resume the original transaction using npx', installed.node, [...recover, '--yes'], npxEnv);
        assert(!fs.existsSync(marker));
        assert.equal(read(failedOperation).stage, 'complete');
        assert.deepEqual(read(failedOperation).results, { package: true, integration: true });
        await bindings('3.16.4', env);
        await command('recovered doctor', ['doctor']);
        await manage('recovered update check', entryPath(), ['update', '--check']);
        assert.deepEqual(preferences(), before);
        assert.deepEqual(read(settings).env, sentinel);

        await manage('upgrade the recovered installation', entryPath(), ['update', '--version', identity.version, '--yes']);
        assert.equal(productIdentity(packageRoot, prefix)?.version, identity.version);
        assert(!fs.existsSync(marker));
        await bindings(identity.version, env);
        await command('upgraded doctor', ['doctor']);
        await manage('upgraded update check', entryPath(), ['update', '--check']);
        assert.deepEqual(preferences(), before);
        assert.deepEqual(read(settings).env, sentinel);

        const clean = join(root, 'fresh-configuration');
        fs.mkdirSync(clean);
        const freshEnv = { ...env, CLAUDE_CONFIG_DIR: clean };
        await call('fresh install', installed.node, [installed.entry, ...installArgs, '--config-dir', clean], freshEnv);
        await call('fresh doctor', installed.node, [installed.entry, 'doctor', '--config-dir', clean], freshEnv);
        for (const row of await list(freshEnv)) {
            assert.equal(row.version, identity.version);
            assert.equal(row.enabled, true);
        }
        const { stdout } = await call('fresh render', installed.node, [installed.entry, 'render'], freshEnv, 0,
            '{"session_id":"fixture","model":{"display_name":"Fixture model"}}');
        assert.match(stdout, /Fixture model/u);
        return { status: 'pass', model_calls: 0, platform: process.platform, arch: process.arch, node: process.version,
            host: '2.1.330', baseline_host: '2.1.322', source_commit: installed.packed.source.commit,
            tarball_sha256: installed.packed.sha256, historical_sha256: published, steps };
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
}
