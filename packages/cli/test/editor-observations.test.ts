import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { delimiter, dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { constants, copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PROTOCOL_VERSION, type PackageExecution } from '@fbincon/statusline-core/contracts/ui';
import { BackendError } from '@fbincon/statusline-core/editor/backend';
import { PACKAGE_NAME, VERSION } from '@fbincon/statusline-core/release';
import { mirrorState, newRecord } from '@fbincon/statusline-core/runtime/tasks/model';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { detectClaudeVersion } from '@fbincon/statusline-platform/commands';
import { privateDirectory } from '@fbincon/statusline-platform/files';
import { processAlive, processToken } from '@fbincon/statusline-platform/processes';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { EditorObservations } from '../src/integration/editor-observations.js';
import { inspectPackage } from '../src/management/inspection.js';
import { reviewFolder, writeReviewRecord } from '../src/management/review-jobs.js';
import { MANAGEMENT_ROOT } from '../src/management/store.js';
import { detailService } from '../src/tasks/service.js';
import { setup, pythonJson } from './runtime-support.js';

const launch = { executable: process.execPath, args: [fileURLToPath(new URL('../src/entry.js', import.meta.url))] };
const signal = new AbortController().signal;

test('task observation preserves the injected runtime, localized errors and reports larger than 1 MiB', async t => {
    const f = setup(t), turn = newRecord('p', f.context.sample());
    const reader = new EditorObservations({ configDir: f.root, launch, hostVersion: () => null }, f.context);
    t.after(() => reader.close());
    turn.agent_ids = Array.from({ length: 256 }, (_, index) => String(index) + '观'.repeat(850));
    const folder = join(f.context.runtimeRoot, 'turns'), path = join(folder, sha256('s') + '.json');
    mkdirSync(folder, { recursive: true });
    const bytes = pythonJson(mirrorState('s', { schema: 4, session_id: 's', current_prompt_id: 'p',
        turns: [turn], updated_wall_ns: turn.updated_wall_ns as bigint }));
    writeFileSync(path, bytes);
    f.clock(3_000_000_000n);
    const payload = { session_id: 's' };
    const expected = detailService(payload, f.context);
    assert.ok(Buffer.byteLength(JSON.stringify(expected)) > 1024 * 1024);
    const result = await reader.read('task_details', payload, signal);
    assert.deepEqual(result, expected);
    assert.equal(result.elapsed_seconds, 2);
    f.clock(5_000_000_000n);
    assert.equal((await reader.read('task_details', payload, signal)).elapsed_seconds, 4);
    assert.equal(readFileSync(path, 'utf8'), bytes);
    await assert.rejects(reader.read('task_details', { session_id: '' }, signal),
        (error: unknown) => error instanceof BackendError && error.code === 'invalid_request' && error.localization?.key === 'task.error.input');
});

test('private observer rejects writes even over its IPC channel and exits on parent disconnect', { timeout: 15_000 }, async t => {
    const f = setup(t);
    const child = spawn(process.execPath, [fileURLToPath(new URL('../src/integration/observation-worker.js', import.meta.url))],
        { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true });
    const exited = once(child, 'exit');
    t.after(async () => { if (child.exitCode === null) child.kill(); await exited; });
    const reply = once(child, 'message');
    child.send({ operation: 'set_ui_language', configDir: f.root, launch, payload: { ui_language: 'zh-CN' } });
    assert.equal((await reply)[0].error.code, 'unsupported_operation');
    assert.equal(existsSync(join(f.root, 'statusline-ui.json')), false);
    child.disconnect();
    assert.equal((await exited)[0], 0);
});

test('execution observation uses only the acquired control, original arguments and job identity', async t => {
    const f = setup(t), reader = new EditorObservations({ configDir: f.root, launch, hostVersion: () => null });
    t.after(() => reader.close());
    const id = 'execution-1ece9046-169a-431f-93d9-b8440bd17f05';
    const runner = join(f.root, MANAGEMENT_ROOT, 'executions', id, 'runner');
    const entry = join(runner, 'bin', 'claude-statusline.js'), trace = join(f.root, 'requests');
    mkdirSync(dirname(entry), { recursive: true });
    const control = { executable: process.execPath, args: [entry], config_dir: f.root };
    const execution: PackageExecution = { version: 1, id, transaction_id: null,
        action: 'update', prefix: f.root, state: 'running', stage: 'queued', started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        finished_at: null, error: null, running: null, results: { package: false, integration: false, configuration: null }, control };
    const snapshot = join(f.root, 'fixture-execution.json'), marker = join(f.root, 'unsafe-marker');
    writeFileSync(snapshot, JSON.stringify(execution));
    writeFileSync(entry, [
        "const { writeFileSync, readFileSync } = require('node:fs');",
        'const request = JSON.parse(readFileSync(0, "utf8"));',
        'writeFileSync(' + JSON.stringify(trace) + ', JSON.stringify({request, node:process.execPath, args:process.argv.slice(2)}));',
        'const result = JSON.parse(readFileSync(' + JSON.stringify(snapshot) + ', "utf8"));',
        'console.log(JSON.stringify({ protocol_version: ' + PROTOCOL_VERSION + ', result }));',
    ].join('\n'));
    writeFileSync(join(runner, 'package.json'), JSON.stringify({ name: PACKAGE_NAME, version: VERSION, bin: { 'claude-statusline': 'bin/claude-statusline.js' } }));
    const files: Record<string, string> = { 'bin/claude-statusline.js': sha256(readFileSync(entry)) };
    for (const file of ['node_modules/@fbincon/statusline-cli/dist/src/entry.js', 'node_modules/@fbincon/statusline-core/dist/src/release.js']) {
        mkdirSync(dirname(join(runner, file)), { recursive: true });
        writeFileSync(join(runner, file), '// test');
        files[file] = sha256('// test');
    }
    writeFileSync(join(runner, 'candidate.json'), JSON.stringify({ name: PACKAGE_NAME, version: VERSION, application_version: VERSION, files }));
    const payload = { id: execution.id };
    await assert.rejects(reader.read('package_execute_status', payload, signal, control), { code: 'identity' });
    const redirected = { ...control, args: [join(f.root, 'other.js')] };
    reader.remember('package_execute_start', { ...execution, control: redirected });
    await assert.rejects(reader.read('package_execute_status', payload, signal, redirected), { code: 'identity' });
    reader.remember('package_execute_start', execution);
    await assert.rejects(reader.read('package_execute_status', { id: 'other' }, signal, control), { code: 'identity' });
    await assert.rejects(reader.read('package_execute_status', payload, signal, { ...control, args: ['other'] }), { code: 'identity' });
    await assert.rejects(reader.read('sources_read', {}, signal, control), { code: 'unsupported_operation' });
    assert.equal(existsSync(trace), false);
    const state = await reader.read('package_execute_status', payload, signal, control);
    assert.deepEqual(state, execution);
    assert.deepEqual(JSON.parse(readFileSync(trace, 'utf8')), {
        request: { protocol_version: PROTOCOL_VERSION, operation: 'package_execute_status', payload },
        node: process.execPath,
        args: ['ui', '--config-dir', f.root],
    });
    const copy = join(f.root, 'previous-node' + (process.platform === 'win32' ? '.exe' : ''));
    copyFileSync(process.execPath, copy, constants.COPYFILE_FICLONE);
    const unknown = join(f.root, 'unverified-node');
    writeFileSync(unknown, '#!/usr/bin/env node\nrequire("node:fs").writeFileSync(' + JSON.stringify(marker) + ', "executed");', { mode: 0o700 });
    for (const executable of [copy, unknown]) {
        const previous = { ...control, executable };
        const stored = { ...execution, control: previous };
        writeFileSync(snapshot, JSON.stringify(stored));
        reader.remember('package_execute_start', stored);
        assert.deepEqual(await reader.read('package_execute_status', payload, signal, previous), stored);
        assert.deepEqual(await reader.control(previous, 'package_execute_detach', { ...payload, owner: 'test' }), stored);
        assert.equal(JSON.parse(readFileSync(trace, 'utf8')).node, process.execPath);
        assert.equal(existsSync(marker), false);
    }
    writeFileSync(entry, 'throw new Error("mismatched retained bytes")');
    reader.remember('package_execute_start', execution);
    await assert.rejects(reader.read('package_execute_status', payload, signal, control), { code: 'identity' });
});

test('profiles need no host process and closing a completed-review observation reaps its version probe', { timeout: 30_000 }, async t => {
    const f = setup(t);
    const bin = join(f.root, 'bin'), marker = join(f.root, 'probe-pid');
    const closingMarker = join(f.root, 'closing'), survived = join(f.root, 'probe-still-running');
    mkdirSync(bin);
    const windows = process.platform === 'win32';
    // Match the supported npm layout for Windows shims, and an ordinary executable on POSIX.
    const packageRoot = join(bin, 'node_modules', '@anthropic-ai', 'claude-code');
    const cli = windows ? join(packageRoot, 'cli.cjs') : join(bin, 'claude');
    if (windows) {
        mkdirSync(packageRoot, { recursive: true });
        writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ bin: { claude: 'cli.cjs' } }));
        writeFileSync(join(bin, 'claude.cmd'), '@echo off\r\n');
    }
    writeFileSync(cli, [
        '#!/usr/bin/env node',
        'const fs = require("node:fs");',
        'const marker = ' + JSON.stringify(marker) + ';',
        'fs.writeFileSync(marker + ".tmp", String(process.pid));',
        'fs.renameSync(marker + ".tmp", marker);',
        'const check = setInterval(() => {',
        '  if (!fs.existsSync(' + JSON.stringify(closingMarker) + ')) return;',
        '  clearInterval(check);',
        '  setTimeout(() => fs.writeFileSync(' + JSON.stringify(survived) + ', "still running"), 1000);',
        '}, 20);',
        'setTimeout(() => clearInterval(check), 20000);',
    ].join('\n'), { mode: 0o755 });
    const oldPath = process.env.PATH;
    process.env.PATH = [bin, dirname(process.execPath), oldPath].join(delimiter);
    t.after(() => { if (oldPath === undefined) delete process.env.PATH; else process.env.PATH = oldPath; });

    const id = 'review-' + randomUUID(), owner = 'viewer-observation-test', folder = reviewFolder(id);
    const context = { configDir: f.root, origin: launch.args[0]!, hostVersion: () => [2, 1, 330] };
    const revision = inspectPackage(context, f.root).revision;
    privateDirectory(folder);
    t.after(() => removeTree(folder));
    writeReviewRecord({ configDir: f.root, origin: context.origin, pid: null, token: null, job: {
        version: 1, id, owner, state: 'complete', started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
        request: { action: 'check', prefix: f.root, expected_revision: revision, target: null, channel: 'latest', backup_id: null, expected_integrity: null },
        review: null, error: null,
    } });
    const configuration = { configDir: f.root, launch, hostVersion: detectClaudeVersion };
    const reader = new EditorObservations(configuration);
    t.after(() => reader.close());
    assert.deepEqual((await reader.read('profiles_read', {}, signal)).profiles, []);
    assert.equal(existsSync(marker), false);
    const read = reader.read('package_review_status', { id, owner }, signal);
    const cancelled = assert.rejects(read, { name: 'AbortError' });
    const deadline = Date.now() + 9000;
    while (!existsSync(marker) && Date.now() < deadline) await delay(10);
    const pid = Number(readFileSync(marker, 'utf8')), token = processToken(pid);
    assert.ok(token);
    writeFileSync(closingMarker, 'close');
    // A Windows Job terminates its members asynchronously when the supervisor
    // closes. Confirm the original process exits before the normal 5-second
    // probe timeout, even if close() itself accidentally waits for that timeout.
    const exitDeadline = performance.now() + 2500;
    const closing = reader.close();
    let alive = processAlive(pid, token);
    while (alive !== false && performance.now() < exitDeadline) {
        await delay(20);
        alive = processAlive(pid, token);
    }
    await Promise.all([closing, cancelled]);
    assert.equal(alive, false, 'the cancelled host probe must exit within 2.5 seconds');
    assert.equal(existsSync(survived), false, 'the host probe kept running after cancellation');
    writeFileSync(cli, '#!/usr/bin/env node\nconsole.log("2.1.330");');
    const next = new EditorObservations(configuration);
    t.after(() => next.close());
    assert.equal((await next.read('package_review_status', { id, owner }, signal)).state, 'complete');
});
