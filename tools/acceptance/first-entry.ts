import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { runSourceProcess as runFixtureProcess } from '@fbincon/statusline-platform/source-process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { PACKAGE_NAME } from '@fbincon/statusline-core/release';
import { library } from '@fbincon/statusline-platform/native';
import { copyPackage } from '@fbincon/statusline-platform/package-copy';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { startWindows } from '@fbincon/statusline-platform/terminal/launchers';
import { npmEntry } from '../build/files.js';
import { openPty } from '../migration/ts-04/test/pty.js';
import { POWERSHELL_BOOTSTRAP, powershellEnvironment, powershellIsolation } from '../migration/ts-04/shell.js';
import { prepareWindowsPowerShell } from './windows-shell.js';
import { retainLog } from './diagnostics.js';
import type { installCandidate } from './install.js';
type Input = Pick<ReturnType<typeof installCandidate>, 'temporary' | 'node' | 'root' | 'env'> & {
    artifact: string;
    npm: string;
};
type Packument = { name: string; version: string };
async function withRegistry<T>(manifest: Packument, artifact: string, action: (registry: string) => Promise<T>): Promise<T> {
    const bytes = fs.readFileSync(artifact), integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
    let registry = '';
    const server = createServer((request, response) => {
        const path = decodeURIComponent(request.url ?? '').replace(/\/$/u, '');
        if (path === '/package.tgz') {
            response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': bytes.length });
            response.end(bytes);
        } else if (path === '/' + manifest.name) {
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify({ name: manifest.name, 'dist-tags': { latest: manifest.version }, versions: {
                [manifest.version]: { ...manifest, dist: { tarball: registry + 'package.tgz', integrity } },
            } }));
        } else {
            response.statusCode = 404;
            response.end('{}');
        }
    });
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    registry = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/';
    try { return await action(registry); }
    finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
}
export async function installedFirstEntry(installed: ReturnType<typeof installCandidate>): Promise<number> {
    const input: Input = { temporary: installed.temporary, node: installed.node, root: installed.root, env: installed.env, artifact: installed.packed.tarball, npm: npmEntry() };
    const program = `import {firstEntryChild} from ${JSON.stringify(import.meta.url)};console.log(JSON.stringify(await firstEntryChild(JSON.parse(process.argv[1]))));`;
    let stderr = '';
    const result = await runFixtureProcess({ executable: installed.node, args: ['--input-type=module', '-e', program, JSON.stringify(input)],
        cwd: installed.directory, input: '', environment: process.env, timeoutMs: 180_000, captureStderr: value => { stderr = value; } });
    const trace = join(installed.temporary, 'first-entry-trace.jsonl');
    assert.equal(result.reason, 'completed', stderr + result.stdout + (fs.existsSync(trace) ? fs.readFileSync(trace,'utf8') : ''));
    assert.equal(result.code, 0);
    const receipt = JSON.parse(result.stdout);
    removeTree(receipt.cacheRoot);
    assert(!fs.existsSync(receipt.cacheRoot), 'The simulated npx cache must actually be absent before restarting');
    const restarted = spawnSync(installed.node, [receipt.entry, '--version'], { cwd: installed.directory, env: installed.env, encoding: 'utf8', timeout: 10000 });
    assert.equal(restarted.status, 0, restarted.stderr);
    assert.equal(restarted.stdout.trim(), 'claude-statusline ' + receipt.version);
    const rendered=spawnSync(installed.node,[receipt.entry,'render'],{cwd:installed.directory,env:{...installed.env,CLAUDE_CONFIG_DIR:receipt.configDir},input:JSON.stringify({model:{display_name:'After cache removal'}}),encoding:'utf8',timeout:10000});
    assert.equal(rendered.status,0,rendered.stderr);assert(rendered.stdout.includes('After cache removal'));
    return 4;
}
export async function firstEntryChild(input: Input): Promise<{
    cacheRoot: string;
    entry: string;
    version: string;
    configDir: string;
}> {
    const trace=(stage:string,detail:unknown=null)=>fs.appendFileSync(join(input.temporary,'first-entry-trace.jsonl'),JSON.stringify({stage,detail,node:process.version,native:Object.keys(createRequire(import.meta.url).cache).filter(path=>path.endsWith('.node'))})+'\n',{mode:0o600});
    const cacheRoot = join(input.temporary, 'first-entry-cache'), origin = join(cacheRoot, '_npx', 'fixture', 'node_modules/@fbincon/claude-code-statusline');
    trace('copy-start');
    copyPackage(input.root, origin);
    trace('copy-complete');
    const modules = join(origin, 'node_modules/@fbincon');
    const load = (name: string, path: string) => import(pathToFileURL(join(modules, 'statusline-' + name, 'dist/src', path + '.js')).href);
    const [{ firstEntry }, { Npm }, { VERSION }, { runSourceProcess }] = await Promise.all([load('cli', 'management/first-entry'), load('platform', 'npm'), load('core', 'release'), load('platform','source-process')]);
    trace('imports-complete');
    const manifest = JSON.parse(fs.readFileSync(join(origin, 'package.json'), 'utf8'));
    return withRegistry(manifest, input.artifact, async registry => {
        const configDir = join(input.temporary, 'first-entry-config'), prefix = join(input.temporary, 'global prefix 中文'), empty = join(input.temporary, 'empty-npmrc'), globalConfig=join(input.temporary,'empty-global-npmrc');
        fs.writeFileSync(empty, '');
        fs.writeFileSync(globalConfig,'');
        const env = { ...input.env, npm_execpath: input.npm, npm_config_registry: registry, npm_config_userconfig: empty, npm_config_globalconfig: globalConfig, npm_config_cache: cacheRoot };
        const failures:unknown[]=[];
        const runner=async (request:any)=>{
            trace('npm-start',request.args.slice(1));
            let stderr='';
            const result=await runSourceProcess({...request,captureStderr:(value:string)=>{stderr=value;}});
            trace('npm-complete',{args:request.args.slice(1),reason:result.reason,code:result.code});
            if(result.reason!=='completed'){
                const readOnly=['root','prefix','config','--version'].includes(request.args[1]);
                const direct=readOnly?spawnSync(request.executable,request.args,{cwd:request.cwd,env:request.environment,encoding:'utf8',timeout:15000,windowsHide:true}):null;
                // Only this synthetic, empty-npmrc fixture is inspected. Product
                // failures never expose user npm stderr or authentication data.
                failures.push({args:request.args.slice(1),result,stderr:stderr.slice(-4000),direct:direct?{status:direct.status,error:direct.error?.message,stdout:direct.stdout,stderr:direct.stderr}:null});
            }
            return result;
        };
        const npm = new Npm(env, runner, input.npm), args = ['--prefix', prefix];
        let review = '', handoff = 0, entry = '';
        const options = { configDir, language: 'en', tty: true, origin, npm, stdout: (s: string) => review += s, stderr: (s: string) => review += s, confirm: async () => true,
            handoff: async (identity: any) => {
                trace('handoff-start');
                handoff++;
                entry = identity.entry;
                assert(!entry.includes('_npx'));
                const result = spawnSync(input.node, [entry, 'install', '--config-dir', configDir, '--no-native-editor', '--no-experimental-slash-tui', '--no-native-timing', '--no-live-metrics'], { env, encoding: 'utf8', timeout: 30000 });
                assert.equal(result.status, 0, result.stdout + result.stderr);
                const binding = JSON.parse(fs.readFileSync(join(configDir, 'statusline_runtime/installation.json'), 'utf8'));
                assert.equal(binding.launch.args[0], entry);
                const rendered = spawnSync(input.node, [entry, 'render'], { env: { ...env, CLAUDE_CONFIG_DIR: configDir }, input: JSON.stringify({ model: { display_name: 'Durable entry' } }), encoding: 'utf8', timeout: 10000 });
                assert.equal(rendered.status, 0);
                assert(rendered.stdout.includes('Durable entry'));
                trace('handoff-complete');
                return 0;
            } };
        trace('refuse-start');
        const refused=await firstEntry(args, { ...options, confirm: async () => false });
        trace('refuse-complete',refused);
        assert.equal(refused, 0, review+JSON.stringify(failures));
        assert(!fs.existsSync(prefix));
        assert(!fs.existsSync(configDir));
        trace('install-start');
        assert.equal(await firstEntry(args, options), 0, review);
        trace('install-complete');
        assert.equal(handoff, 1);
        const settings = fs.readFileSync(join(configDir, 'settings.json'));
        trace('reuse-start');
        assert.equal(await firstEntry(args, options), 0, review);
        trace('reuse-complete');
        assert.equal(handoff, 2);
        assert.deepEqual(fs.readFileSync(join(configDir, 'settings.json')), settings);
        return { cacheRoot, entry, version: VERSION, configDir };
    });
}

const reviewPrompt = 'Continue with this package operation?';
const setupScreen = 'Environment and configuration checks';

/** Run npm's real temporary installation, then drive the two interactive stages. */
export async function smokeNpxFirstEntry(installed: ReturnType<typeof installCandidate>, logDirectory: string) {
    // Exercise npm's launcher in a normal working directory. The existing
    // installation smoke separately covers metacharacters in product paths.
    const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'statusline-npx 中文 ')));
    try {
        return await npxFirstEntry(installed, directory, logDirectory);
    } catch (error) {
        const directoryLogs = join(directory, 'empty cache', '_logs');
        if (fs.existsSync(directoryLogs)) {
            const latest = fs.readdirSync(directoryLogs).filter(name => name.endsWith('-debug-0.log')).sort().at(-1);
            if (latest) retainLog(logDirectory, 'npx-npm-debug.log', fs.readFileSync(join(directoryLogs, latest), 'utf8'));
        }
        throw error;
    } finally {
        removeTree(directory);
        assert(!fs.existsSync(directory));
    }
}

async function npxFirstEntry(installed: ReturnType<typeof installCandidate>, directory: string, logDirectory: string) {
    const manifest = JSON.parse(fs.readFileSync(join(installed.root, 'package.json'), 'utf8'));
    assert.equal(manifest.name, PACKAGE_NAME);
    const { version, commit, dependency_manifests } = installed.packed.source;
    assert.equal(dependency_manifests, 'sanitized');
    const config = join(directory, 'config'), prefix = join(directory, 'persistent prefix'), cache = join(directory, 'empty cache');
    const user = join(directory, 'user.npmrc'), global = join(directory, 'global.npmrc');
    fs.writeFileSync(user, '');
    fs.writeFileSync(global, '');
    // npm 10 walks the global module root before creating the exec cache.
    const globalModules = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules');
    fs.mkdirSync(globalModules, { recursive: true });
    assert(!fs.existsSync(cache) && fs.readdirSync(globalModules).length === 0);
    const systemPath = process.platform === 'win32' ? [join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')] : ['/usr/bin', '/bin'];
    const env = { ...installed.env, CLAUDE_CONFIG_DIR: config, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8',
        PATH: [dirname(process.execPath), ...systemPath].join(delimiter),
        npm_execpath: npmEntry(), npm_config_cache: cache, npm_config_prefix: prefix, npm_config_userconfig: user,
        npm_config_globalconfig: global, npm_config_ignore_scripts: 'false', npm_config_foreground_scripts: 'true',
        npm_config_progress: 'false' };
    const log = await withRegistry(manifest, installed.packed.tarball, async registry => {
        const childEnv = { ...env, npm_config_registry: registry };
        if (process.platform === 'win32') return windowsNpxFirstEntry(directory, childEnv, logDirectory);
        const pty = openPty(config, 120, 32, childEnv, 'en', { executable: process.execPath,
            args: [join(dirname(env.npm_execpath), 'npx-cli.js'), '--yes', PACKAGE_NAME], cwd: directory });
        try {
            await pty.wait(text => text.includes(reviewPrompt), 60_000);
            assert(pty.captured().toString().includes(PACKAGE_NAME + '@' + version));
            pty.send('yes\r');
            await pty.wait(text => text.includes(setupScreen), 120_000);
            pty.send('\x1b');
            await pty.exited();
            assert.equal(pty.child.exitCode, 0);
            assert.deepEqual(pty.attributes(), pty.before);
        } finally {
            if (pty.child.exitCode === null && pty.child.pid) {
                try { process.kill(-pty.child.pid, 'SIGTERM'); }
                catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
            }
            retainLog(logDirectory, 'npx-first-entry.log', pty.captured().toString());
            await pty.close();
        }
        return 'npx-first-entry.log';
    });
    assert(!fs.existsSync(join(config, 'settings.json')) && !fs.existsSync(join(config, 'claude-statusline.json')));
    const globalPackage = join(globalModules, PACKAGE_NAME);
    assert.deepEqual(fs.readFileSync(join(globalPackage, 'candidate.json')), fs.readFileSync(join(installed.root, 'candidate.json')));
    assert(fs.existsSync(join(cache, '_npx')));
    removeTree(cache);
    assert(!fs.existsSync(cache));
    const render = spawnSync(process.execPath, [join(globalPackage, 'bin/claude-statusline.js'), 'render'], { cwd: directory, env,
        input: '{"model":{"display_name":"After npx cache removal"}}', encoding: 'utf8', timeout: 20_000 });
    assert.equal(render.status, 0, render.stderr);
    assert(render.stdout.includes('After npx cache removal'));
    return { log, commit, version, lifecycle_scripts: true, review: 'pass', setup: 'pass', durable_render: 'pass' };
}

async function windowsNpxFirstEntry(directory: string, env: NodeJS.ProcessEnv, logDirectory: string) {
    const shell = prepareWindowsPowerShell();
    assert.equal(shell.status, 'pass', JSON.stringify(shell));
    assert.match(shell.powershell_version!, /^5\.1\./u);
    const output = join(directory, 'console.txt'), preload = join(directory, 'capture.mjs'), error = join(directory, 'error.txt');
    fs.writeFileSync(output, '');
    // Observe the child writes while retaining real console handles and lazy Node TTY initialization.
    fs.writeFileSync(preload, `import fs from 'node:fs';
for (const name of ['stdout', 'stderr']) {
    const descriptor = Object.getOwnPropertyDescriptor(process, name);
    const streams = new WeakSet();
    Object.defineProperty(process, name, { ...descriptor, get() {
        const stream = descriptor.get.call(process);
        if (!streams.has(stream)) {
            streams.add(stream);
            const write = stream.write.bind(stream);
            stream.write = (chunk, ...args) => {
                fs.appendFileSync(${JSON.stringify(output)}, chunk);
                return write(chunk, ...args);
            };
        }
        return stream;
    } });
}`);
    const program = `import fs from 'node:fs'; import { windowsNpxConsole } from ${JSON.stringify(import.meta.url)};
try { await windowsNpxConsole(...JSON.parse(process.argv[1])); }
catch (error) { fs.writeFileSync(${JSON.stringify(error)}, String(error.stack ?? error)); process.exitCode = 1; }`;
    const terminal = startWindows([process.execPath, '--input-type=module', '-e', program,
        JSON.stringify([directory, output, preload, env])], directory, powershellEnvironment(env));
    try {
        const deadline = performance.now() + 210_000;
        while (terminal.code() === null && performance.now() < deadline) await delay(25);
        assert.equal(terminal.code(), 0, fs.existsSync(error) ? fs.readFileSync(error, 'utf8') : fs.readFileSync(output, 'utf8'));
    } finally {
        terminal.close();
        retainLog(logDirectory, 'npx-first-entry.log', fs.readFileSync(output, 'utf8'));
    }
    return 'npx-first-entry.log';
}

export async function windowsNpxConsole(directory: string, output: string, preload: string, env: NodeJS.ProcessEnv) {
    assert(process.stdin.isTTY && process.stdout.isTTY);
    const k = library('kernel32.dll');
    const getHandle = k.func('void *GetStdHandle(int kind)'), getMode = k.func('bool GetConsoleMode(void *handle, _Out_ uint32_t *mode)');
    const input = getHandle(-10);
    const screen = () => {
        const out = getHandle(-11), info = Buffer.alloc(22);
        if (!k.func('bool GetConsoleScreenBufferInfo(void *handle, _Out_ void *info)')(out, info)) return '';
        const width = info.readUInt16LE(0), row = info.readUInt16LE(6);
        if (!width || width > 512) return '';
        const from = Math.max(0, row - 12), text = Buffer.alloc(width * (1 + row - from) * 2), count = [0];
        const read = k.func('bool ReadConsoleOutputCharacterW(void *handle, _Out_ void *text, uint32_t length, uint32_t coord, _Out_ uint32_t *count)');
        if (!read(out, text, text.length / 2, from * 65536, count)) return '';
        const decoded = text.toString('utf16le', 0, count[0]! * 2);
        return decoded.match(new RegExp(`.{1,${width}}`, 'gu'))?.map(line => line.trimEnd()).join('\n') ?? '';
    };
    const modes = () => [-10, -11].map(kind => {
        const value = [0];
        assert(getMode(getHandle(kind), value));
        return value[0];
    });
    const before = modes();
    const send = (keys: string) => {
        const records = Buffer.alloc(keys.length * 40);
        for (const [index, key] of Array.from(keys).entries()) {
            for (let up = 0; up < 2; up++) {
                const offset = index * 40 + up * 20;
                records.writeUInt16LE(1, offset);
                records.writeInt32LE(up ? 0 : 1, offset + 4);
                records.writeUInt16LE(1, offset + 8);
                records.writeUInt16LE(key.toUpperCase().charCodeAt(0), offset + 10);
                records.writeUInt16LE(key.charCodeAt(0), offset + 14);
            }
        }
        const count = keys.length * 2, written = [0];
        assert(k.func('bool WriteConsoleInputW(void *handle, void *records, uint32_t count, _Out_ uint32_t *written)')(input, records, count, written));
        assert.equal(written[0], count);
    };
    const system = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
    const powershell = join(system, 'WindowsPowerShell/v1.0/powershell.exe');
    // The npm 10 PowerShell wrapper looks for npm inside npm_config_prefix.
    // Keep the disposable global root empty by selecting the runtime's npx CLI explicitly.
    const child = spawn(powershell, ['-NoLogo', '-NoProfile', '-Command',
        POWERSHELL_BOOTSTRAP + powershellIsolation(env) + "& $env:STATUSLINE_NPX_NODE $env:STATUSLINE_NPX_CLI '--yes' '@fbincon/claude-code-statusline'; exit $LASTEXITCODE"],
        { cwd: directory, env: powershellEnvironment({ ...env,
            STATUSLINE_NPX_NODE: process.execPath, STATUSLINE_NPX_CLI: join(dirname(env.npm_execpath!), 'npx-cli.js'),
            NODE_OPTIONS: '--import=' + pathToFileURL(preload).href,
        }), stdio: 'inherit' });
    let failure: Error | undefined;
    child.once('error', error => { failure = error; });
    const wait = async (predicate: (text: string) => boolean, timeout: number) => {
        const deadline = performance.now() + timeout;
        for (;;) {
            if (failure) throw failure;
            const captured = fs.readFileSync(output, 'utf8');
            if (predicate(captured)) return;
            if (child.exitCode !== null || child.signalCode || performance.now() >= deadline)
                throw new Error(`Windows npx console (exit ${child.exitCode}, signal ${child.signalCode})\n` + captured.slice(-3000) + '\n' + screen());
            await delay(25);
        }
    };
    try {
        await wait(text => text.includes(reviewPrompt), 60_000);
        send('yes\r');
        await wait(text => text.includes(setupScreen), 120_000);
        send('\x1b');
        await wait(() => child.exitCode !== null, 10_000);
        assert.equal(child.exitCode, 0);
        assert.deepEqual(modes(), before);
    } finally {
        if (child.pid && child.exitCode === null && !child.signalCode) {
            spawnSync(join(system, 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { timeout: 5000, windowsHide: true });
        }
    }
}
