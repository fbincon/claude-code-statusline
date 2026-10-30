/** Offline installed editor recordings. Actual keyframes, never fabricated UI. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { openPty } from '../migration/ts-04/test/pty.js';
import { Capture } from '../migration/ts-04/capture.js';
import { renderCapture } from './render-capture.js';
import { sha256 } from '../build/files.js';
import { verifyDelivery } from '../build/verify.js';
import { SHOWCASE_BASELINE, assertBaseline, snapshotDirectory, requireUnchanged } from './showcase.js';
import { requireCompact } from './showcase-driver.js';
import { installCandidate } from './install.js';
import { verifyPaidEvents } from './showcase-paid.js';
import { repoRoot } from '../migration/ts-03/common.js';

const read = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const write = (path: string, data: unknown) => fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export function noNetwork(): string[] {
    assert.equal(process.platform, 'linux', 'This explicit recording is Linux-only');
    const args = ['--user', '--map-user=' + process.getuid!(), '--map-group=' + process.getgid!(), '--net', '--'];
    const probe = spawnSync('/usr/bin/unshare', [...args, process.execPath, '-e',
        'const s=require("node:net").connect({host:"1.1.1.1",port:443});s.on("connect",()=>process.exit(2));s.on("error",e=>process.exit(e.code==="ENETUNREACH"?0:1));setTimeout(()=>process.exit(3),3000).unref()'], { timeout: 5000 });
    assert.equal(probe.status, 0, 'Network isolation must be demonstrated before opening the host');
    return args;
}
export function encodeKeyframes(directory: string, frames: readonly string[], target: string): void {
    assert(frames.length >= 2, 'An animation needs at least two observed keyframes');
    assert(frames.every(file => /^frame-\d+\.png$/u.test(file)), 'Only generated local frame names are accepted');
    const list = frames.map(file => 'file ' + file + '\nduration 1.4').join('\n') + '\nfile ' + frames.at(-1) + '\n';
    fs.writeFileSync(join(directory, 'animation.txt'), list);
    const args = ['-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'animation.txt', '-filter_complex',
        '[0:v]split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', '-y', target];
    execFileSync('ffmpeg', args, { cwd: directory, timeout: 120000 });
    execFileSync('ffmpeg', ['-v', 'error', '-i', target, '-f', 'null', '-'], { timeout: 60000 });
}
export function assertPublicFrame(text: string): void {
    assert(!/\/home\/|\/tmp\/|ANTHROPIC|api[ _-]?key|sk-ant-/iu.test(text), 'Private content in selected frame');
}
export function requireActualTask(value: any, session: string, ids: string[]): void {
    assert.equal(value?.session_id, session, 'Task viewer changed the recorded session');
    assert.equal(value.status, 'completed', 'The actual task must have completed');
    assert(typeof value.elapsed_seconds === 'number' && value.elapsed_seconds > 0, 'Observed duration is required');
    assert(Array.isArray(value.agents) && value.agents.length === 2 && value.agents.every((agent: any) => agent.status === 'completed'), 'Both observed agents must be completed');
    assert.equal(new Set(ids).size, 2); assert.deepEqual(value.agents.map((agent: any) => agent.id).sort(), [...ids].sort(), 'Task agents differ from the actual stream');
    assert(value.evidence?.some((row: any) => row.source === 'task_store' && row.status === 'observed'), 'Task store is unavailable');
}
export async function stopRecordedGroup(pid: number | undefined, close: () => Promise<void>): Promise<void> {
    const gone = () => { if (!pid) return true; try { process.kill(-pid, 0); return false; }
        catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH'; } };
    const signal = (kind: NodeJS.Signals) => { try { if (pid) process.kill(-pid, kind); } catch { /* Must still confirm exit. */ } };
    signal('SIGTERM');
    try { await close(); }
    finally {
        const start = performance.now();
        while (!gone() && performance.now() - start < 5000) {
            if (performance.now() - start >= 250) signal('SIGKILL');
            await delay(25);
        }
        assert(gone(), 'Recording executor liveness is unknown; retain the owned fixture');
    }
}

export async function collectJourneys(options: { fixture: string; output: string; fonts: string[]; examples: string; claude: string }) {
    const recorded = read(options.fixture), output = resolve(options.output);
    assert(!fs.existsSync(output), 'Use a new output directory');
    const artifact = verifyDelivery(recorded.artifact, recorded.product_commit);
    assertBaseline({ version: artifact.source.application_version, commit: artifact.source.commit, tarball_sha256: artifact.sha256 });
    const installed = installCandidate(recorded.artifact, recorded.product_commit);
    const fixture = { ...recorded, temporary: installed.temporary, root: installed.root, modules: installed.modules, entry: installed.entry,
        node: installed.node, project: join(installed.temporary, 'showcase-project'), config: installed.env.CLAUDE_CONFIG_DIR };
    const config = fixture.config, modules = fixture.modules;
    let cleanupSafe = true;
    try {
    fs.mkdirSync(config, { mode: 0o700 }); fs.mkdirSync(fixture.project);
    const observedInputs = snapshotDirectory(join(recorded.config, 'statusline_runtime'));
    fs.cpSync(join(recorded.config, 'statusline_runtime'), join(config, 'statusline_runtime'), { recursive: true });
    requireUnchanged(observedInputs, snapshotDirectory(join(config, 'statusline_runtime')), 'Recorded observations copied for offline viewing');
    assert.deepEqual(read(join(fixture.root, 'candidate.json')), artifact.source);
    for (const [name, hash] of Object.entries(artifact.source.files)) {
        const path = join(fixture.root, name);
        if (!fs.existsSync(path) && name.startsWith('node_modules/@koromix/koffi-') && !name.startsWith('node_modules/@koromix/koffi-linux-x64/')) continue;
        assert.equal(sha256(fs.readFileSync(path)), hash, 'Installed product differs: ' + name);
    }
    const isolation = noNetwork(), load = (workspace: string, file: string) => import(pathToFileURL(join(modules, 'statusline-' + workspace, 'dist/src', file + '.js')).href);
    const { t } = await load('core', 'i18n/messages');
    const version = execFileSync(options.claude, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim();
    assert(version.startsWith('2.1.314 '), 'Capture the named host version');
    fs.mkdirSync(output, { recursive: true, mode: 0o700 });
    write(join(output, 'fixture.json'), fixture);
    const project = fixture.project, env: NodeJS.ProcessEnv = { ...process.env, HOME: join(fixture.temporary, 'home'), USERPROFILE: join(fixture.temporary, 'home'),
        CLAUDE_CONFIG_DIR: config, CLAUDE_STATUSLINE_RUNTIME_DIR: join(config, 'statusline_runtime'), TERM: 'xterm-256color', COLORTERM: 'truecolor',
        ANTHROPIC_API_KEY: 'showcase-synthetic-offline', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', ANTHROPIC_AUTH_TOKEN: '',
        DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_NO_FLICKER: '1' };
    delete env.CLAUDECODE;
    const run = (args: string[], input = '') => {
        const r = spawnSync(fixture.node, [fixture.entry, ...args], { cwd: project, env, input, encoding: 'utf8', timeout: 90000 });
        fs.appendFileSync(join(output, 'commands.jsonl'), JSON.stringify({ args, status: r.status, stdout: r.stdout, stderr: r.stderr }) + '\n', { mode: 0o600 });
        assert.equal(r.status, 0, 'Installed command failed: ' + args.slice(0, 3).join(' ')); return r.stdout;
    };
    const ui = (operation: string, payload: unknown = {}) => JSON.parse(run(['ui'], JSON.stringify({ protocol_version: 31, operation, payload }))).result;
    const request = join(output, 'host-request.json');
    write(request, { host: { executable: options.claude, args: [] }, version: [2, 1, 314], launch: { executable: fixture.node, args: [fixture.entry] } });
    const preparation = spawnSync('/usr/bin/unshare', [...isolation, process.execPath, join(repoRoot, 'dist/typescript/tools/migration/ts-04/test/installed-driver.js'),
        modules, 'prepare-host', config, join(output, 'host-prepared.json'), request], { cwd: project, env, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
    fs.writeFileSync(join(output, 'host-prepared.log'), preparation.stdout + preparation.stderr, { mode: 0o600 });
    assert.equal(preparation.status, 0, 'Offline official-host preparation failed');
    write(join(config, '.claude.json'), { hasCompletedOnboarding: true, theme: 'dark', projects: { [project]: { hasTrustDialogAccepted: true } } });
    const receipt: any = { product: SHOWCASE_BASELINE, host: version, status: 'in_progress', platform: process.platform, architecture: process.arch,
        kind: 'actual installed editor PTY keyframes; fixed sample previews; not OS screenshots or human acceptance',
        model_calls: 0, native_network: 'verified network namespace without outbound routes', terminal: 'xterm-256color',
        fonts: Object.fromEntries(options.fonts.map(path => [basename(path), sha256(fs.readFileSync(path))])),
        recorded_observations_sha256: sha256(JSON.stringify(observedInputs)), copied_observations_unchanged: true, captures: [], journeys: [] };
    const persist = () => write(join(output, 'receipt.json'), receipt);
    const displayPath = join(config, 'claude-statusline.json');
    const paid = read(join(resolve(options.fixture, '..'), 'receipt.json'));
    const taskSession = paid.records.find((row: any) => row.kind === 'parallel' && row.status === 'pass')?.session_id;
    assert(taskSession, 'Actual two-agent task evidence is required for the task recording');
    const timedStream = join(resolve(options.fixture, '..'), 'parallel/timed-stream.json'), events = read(timedStream);
    const taskVerification = verifyPaidEvents('parallel', events);
    const actualTask = JSON.parse(run(['task', 'show', '--session-id', taskSession, '--json']));
    requireActualTask(actualTask, taskSession, events.filter((row: any) => row.message.type === 'system' && row.message.subtype === 'task_started').map((row: any) => row.message.task_id));
    write(join(output, 'actual-task.json'), actualTask);
    receipt.actual_task = { ...taskVerification, report_sha256: sha256(fs.readFileSync(join(output, 'actual-task.json'))),
        original_paid_receipt_sha256: sha256(fs.readFileSync(join(resolve(options.fixture, '..'), 'receipt.json'))),
        timed_stream_sha256: sha256(fs.readFileSync(timedStream)), viewer_limitations: actualTask.limitations };
    const sourceFile = join(project, 'queue-source.json');
    write(join(project, 'queue.json'), { value: 7, status: 'ok' });
    write(sourceFile, { name: 'Local queue / 本地队列', kind: 'json', settings: { path: join(project, 'queue.json'), pointer: '/value' } });
    const registered = JSON.parse(run(['source', 'list', '--json']));
    if (JSON.stringify(registered).includes('"showcase-queue"')) run(['source', 'remove', 'showcase-queue', '--json']);
    run(['source', 'add', 'showcase-queue', '--file', sourceFile]);
    const sourceRevision = JSON.parse(run(['source', 'review', 'showcase-queue', '--json'])).review_revision;
    run(['source', 'enable', 'showcase-queue', '--review', sourceRevision]);
    run(['source', 'diagnose', 'showcase-queue', '--json']);
    for (const language of ['en', 'zh-CN']) {
        const publicDirectory = join(output, language); fs.mkdirSync(publicDirectory);
        run(['config', 'profile', 'import', join(options.examples, 'daily.json'), '--overwrite']);
        run(['config', 'profile', 'activate', 'Showcase daily']);
        run(['config', 'set', 'statusline-language', language]); run(['config', 'language', 'set', language]);
        requireCompact(read(displayPath));
        const style = read(join(options.examples, 'daily.json')); style.display.instances[0].options.foreground = '#f5b86a';
        delete style.display.instances[0].options.foreground_gradient; write(join(project, 'style-source.json'), style);
        for (const editor of ['external', 'native', 'browse'] as const) {
            const directory = join(output, language + '-' + editor); fs.mkdirSync(directory);
            const external = editor !== 'native', columns = external ? 120 : 200, rows = external ? 32 : 50;
            const before = fs.readFileSync(displayPath), settings = read(join(config, 'settings.json'));
            const hostLog = join(directory, 'host.log'), frames: string[] = [], frameRecords: any[] = [];
            const overrides = { apiKeyHelper: '', env: { ANTHROPIC_API_KEY: 'showcase-synthetic-offline', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', ANTHROPIC_AUTH_TOKEN: '' },
                enabledPlugins: Object.fromEntries(Object.keys(settings.enabledPlugins ?? {}).map(id => [id, id === 'statusline-native@claude-statusline-local'])) };
            const p = openPty(config, columns, rows, env, language, external
                ? { executable: fixture.node, args: [fixture.entry, '--language', language, 'configure'], cwd: project }
                : { executable: '/usr/bin/unshare', args: [...isolation, options.claude, '--permission-mode', 'manual', '--debug-file', hostLog, '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--settings', JSON.stringify(overrides)], cwd: project });
            const screen = new Capture(columns, rows); let offset = 0, apiAccepted = false, page = 'main', frameSequence = 0; const start = performance.now();
            const title = t(external ? 'ui.drawing.configure_status_line' : 'native.ui.client.draw.configure_status_line', language);
            const text = () => {
                const all = p.captured(), chunk = all.subarray(offset); offset = all.length; screen.feed(chunk);
                if (chunk.includes(Buffer.from('\x1b[6n'))) p.send('\x1b[1;1R');
                const value = screen.buffer.map(row => row.map(cell => cell.data).join('')).join('\n');
                if (!external && !apiAccepted && value.includes('Do you want to use this API key?') && value.includes('synthetic-offline')) { p.send('\x1b[A\r'); apiAccepted = true; }
                if (!external && fs.existsSync(hostLog)) assert(!/\[API REQUEST\]|props serializes to more than|too many nodes|returned a tree that does not validate/u.test(fs.readFileSync(hostLog, 'utf8')), 'Unexpected host request or rejected UI');
                return value;
            };
            const until = async (condition: (value: string) => boolean, label: string) => {
                const end = Date.now() + 30000;
                while (Date.now() < end && p.child.exitCode === null) { if (condition(text())) return; await delay(50); }
                throw new Error('Recording expectation failed: ' + label);
            };
            const key = async (keys: string) => { p.send(keys); await delay(300); text(); };
            const capture = (label: string, publicName?: string, crop?: number[]) => {
                text(); const data = { columns, rows, cells: screen.buffer, terminal_foreground: '#dedee7', terminal_background: '#17191e' };
                const bounds = crop ?? (external ? [0, 0, columns, rows] : [128, 4, 72, 40]);
                const visible = screen.buffer.slice(bounds[1], bounds[1]! + bounds[3]!).map(row => row.slice(bounds[0], bounds[0]! + bounds[2]!).map(c => c.data).join('')).join('\n');
                assertPublicFrame(visible);
                const file = 'frame-' + String(frameSequence++).padStart(3, '0') + '.png', cells = JSON.stringify(data, null, 2) + '\n', image = renderCapture(data, bounds, options.fonts);
                fs.writeFileSync(join(directory, file), image.png); write(join(directory, file + '.cells.json'), data);
                frames.push(file); frameRecords.push({ file, label, elapsed_ms: performance.now() - start, ansi_bytes: offset, bounds, cells_sha256: sha256(cells), png_sha256: sha256(image.png), width: image.width, height: image.height });
                if (publicName) { fs.writeFileSync(join(publicDirectory, publicName), image.png); receipt.captures.push({ file: language + '/' + publicName, editor, language, kind: receipt.kind, input_kind: 'isolated-live-source-and-installation',
                    width: image.width, height: image.height, png_sha256: sha256(image.png), source_sha256: sha256(cells), bounds }); }
            };
            const selectPage = async (target: string) => { if (page === target) return; const pages = ['main', 'subagents', 'settings', 'layout'];
                if (external) for (let n = 0, count = (pages.indexOf(target) - pages.indexOf(page) + 4) % 4; n < count; n++) await key('\t');
                else await key(String(pages.indexOf(target) + 1)); page = target; };
            const select = async (label: string) => { await key('\x1b[H'); for (let i = 0; i < 100; i++) {
                if (text().split('\n').some(line => line.includes('›') && line.includes(label))) return; await key('\x1b[B'); }
                throw new Error('Setting unavailable: ' + label); };
            let status = 'fail', failure: string | null = null, restored = false, reopenedFrame: any = null;
            try {
                if (!external) {
                    await until(value => value.includes('❯') && fs.existsSync(hostLog) && fs.readFileSync(hostLog, 'utf8').includes('/statusline-configure-native listed'), 'Native registered');
                    await key('/statusline-configure-native\r');
                }
                await until(value => value.includes(title) && value.includes('[x]'), 'editor visible');
                if (!external) {
                    let clicked = false; for (let y = 0; y < rows && !clicked; y++) {
                        const x = screen.buffer[y]!.findIndex((cell, i, row) => cell.data === '[' && row[i + 1]?.data === 'x' && row[i + 2]?.data === ']');
                        if (x >= 0) { await key(`\x1b[<0;${x + 2};${y + 1}M\x1b[<0;${x + 2};${y + 1}m`); clicked = true; }
                    } assert(clicked);
                }
                capture('opened');
                if (editor === 'browse') {
                    reopenedFrame = structuredClone(frameRecords[0]);
                    assert(read(displayPath).instances.length > read(join(options.examples, 'daily.json')).display.instances.length, 'Saved duplicate was not reopened');
                    await key('\x19'); await until(value => value.includes('Local queue'), 'registered source list'); capture('sources', 'sources.png'); await key('\x07');
                    await selectPage('settings'); await select(t('settings.package-management', language)); await key('\r');
                    await until(value => value.includes(t('package.ui.title', language)), 'read-only local version page');
                    capture('versions-actions-private-paths-excluded', 'versions.png', [0, 12, 120, 11]); await key('q');
                    await select(t('settings.task-details', language)); await key('\r'); await key(taskSession); await key('\r');
                    await until(value => value.includes(taskSession), 'actual task identity');
                    // Do not include earlier source/version frames in this task-only animation.
                    frames.length = 0; frameRecords.length = 0;
                    capture('actual-task-summary'); await key('e'); capture('actual-task-evidence'); await key('r'); await delay(600); capture('actual-task-refreshed');
                    await key('e'); capture('actual-task-summary-again'); await key('q');
                    assert.deepEqual(fs.readFileSync(displayPath), before, 'Read-only source/version/task pages changed the display');
                    await key('\x1b'); await p.exited(); assert.equal(p.child.exitCode, 0);
                } else if (external) {
                    await key('\x04'); await until(value => value.includes(title + ' *'), 'duplicate draft'); capture('draft-copy');
                    await key('\x1a'); await until(value => !value.includes(title + ' *'), 'undo'); capture('undo');
                    await key('\x12'); await until(value => value.includes(title + ' *'), 'redo'); capture('redo');
                    await key('\x16'); capture('warning-sample'); await key('\x17'); capture('narrow-preview');
                    await key('\x13'); await p.exited(); assert.equal(p.child.exitCode, 0);
                    assert.notDeepEqual(fs.readFileSync(displayPath), before, 'Explicit Save did not publish the draft');
                    requireCompact(read(displayPath));
                } else {
                    await key('\x05'); await select(t('reuse.style', language)); await key('\r'); await key('\x1b[B\x1b[B\r');
                    await key('\x15'); await key('style-source.json'); await key('\r');
                    await until(value => value.includes(style.display.instances[0].id) && value.includes(t('reuse.scope', language)), 'profile component selection');
                    await key('\x1b[B\r'); await key('\x1b[F\r'); await until(value => value.includes(t('reuse.draft_only', language)), 'style candidate'); capture('style-review');
                    await key('a'); await until(value => value.includes(t('reuse.accepted', language)), 'style accepted'); capture('style-accepted'); await key('q'); await key('\x07');
                    await key('\x14'); await until(value => value.includes(t('history.title', language)), 'history page'); capture('history'); await key('u'); capture('history-undo'); await key('r'); capture('history-redo'); await key('q');
                    await key('q'); await until(value => !value.includes(title), 'cancel Native draft');
                    assert.deepEqual(fs.readFileSync(displayPath), before, 'Cancelled Native draft wrote display configuration');
                    await key('\x03'); await key('\x03'); await p.exited(); assert([0, 130].includes(p.child.exitCode!));
                }
                assert.deepEqual(p.attributes(), p.before, 'Terminal attributes not restored'); restored = true; status = 'pass';
            } catch (error) { failure = String(error); }
            finally {
                try {
                    fs.writeFileSync(join(directory, 'terminal.ansi'), p.captured(), { mode: 0o600 });
                    write(join(directory, 'frames.json'), frameRecords);
                    write(join(directory, 'last-screen.json'), { columns, rows, cells: screen.buffer });
                } finally {
                    try { await stopRecordedGroup(p.child.pid, () => p.close()); }
                    catch (error) { cleanupSafe = false; throw error; }
                }
                receipt.journeys.push({ language, editor, status, error: failure, terminal_restored: restored, frames: frameRecords, columns, rows }); persist();
            }
            assert.equal(status, 'pass', 'Private recording failed: ' + failure);
            const movie = editor === 'browse' ? 'tasks.gif' : external ? 'configure.gif' : 'reuse.gif', path = join(publicDirectory, movie);
            encodeKeyframes(directory, frames, path);
            receipt.captures.push({ file: language + '/' + movie, language, editor, kind: receipt.kind, input_kind: editor === 'browse' ? 'actual-recorded-task-stores-in-offline-viewer' : 'fixed-preview-in-actual-editor',
                sha256: sha256(fs.readFileSync(path)), source_sha256: sha256(fs.readFileSync(join(directory, 'terminal.ansi'))), frames: frameRecords.length,
                timing: 'observed keyframes edited to 1.4 second holds; not a real-time screen recording' }); persist();
            if (reopenedFrame) {
                const previous = receipt.journeys.find((row: any) => row.language === language && row.editor === 'external');
                const previousDirectory = join(output, language + '-external'), name = 'frame-' + String(previous.frames.length).padStart(3, '0') + '.png';
                fs.copyFileSync(join(directory, reopenedFrame.file), join(previousDirectory, name));
                fs.copyFileSync(join(directory, reopenedFrame.file + '.cells.json'), join(previousDirectory, name + '.cells.json'));
                previous.frames.push({ ...reopenedFrame, file: name, label: 'saved-draft-reopened', source_recording: language + '-browse' });
                const configured = join(publicDirectory, 'configure.gif'); encodeKeyframes(previousDirectory, previous.frames.map((row: any) => row.file), configured);
                const media = receipt.captures.find((row: any) => row.file === language + '/configure.gif');
                media.sha256 = sha256(fs.readFileSync(configured)); media.frames = previous.frames.length;
                media.reopened_source_sha256 = sha256(fs.readFileSync(join(directory, 'terminal.ansi'))); persist();
            }
        }
    }
    installed.cleanup(); assert(!fs.existsSync(installed.temporary), 'Recording fixture was not removed');
    receipt.status = 'pass'; receipt.isolated_installation_removed = true;
    receipt.collector = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
        working_tree_changes: Boolean(execFileSync('git', ['status', '--porcelain=v1', '--', 'tools/acceptance/showcase-journeys.ts'], { cwd: repoRoot, encoding: 'utf8' }).trim()),
        source_sha256: sha256(fs.readFileSync(join(repoRoot, 'tools/acceptance/showcase-journeys.ts'))), compiled_sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))) };
    persist(); return receipt;
    } finally {
        if (cleanupSafe) { if (fs.existsSync(installed.temporary)) installed.cleanup(); assert(!fs.existsSync(installed.temporary), 'Recording fixture was not removed'); }
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { fixture: { type: 'string' }, output: { type: 'string' }, examples: { type: 'string' }, claude: { type: 'string' }, font: { type: 'string', multiple: true } } });
    assert(values.fixture && values.output && values.examples && values.claude && values.font?.length, 'Require --fixture PRIVATE_JSON --output NEW_DIRECTORY --examples DIRECTORY --claude HOST --font FILE');
    await collectJourneys({ fixture: resolve(values.fixture), output: resolve(values.output), examples: resolve(values.examples), claude: resolve(values.claude), fonts: values.font.map(path => resolve(path)) });
    console.log('Offline showcase journeys passed');
}
