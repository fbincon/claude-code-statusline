import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { processAlive, processToken } from '@fbincon/statusline-platform/processes';
import { acquireHostVersionGate, defaultHostGateDirectory } from '../host-version-gate.js';

const moduleUrl = new URL('../host-version-gate.js', import.meta.url).href;
const fixture = `
import {acquireHostVersionGate, defaultHostGateDirectory} from ${JSON.stringify(moduleUrl)};
import {spawn} from 'node:child_process';
const [role, directory] = process.argv.slice(1);
let release;
process.on('message', async msg => {
  try {
    if (msg === 'take') {
      release = await acquireHostVersionGate(role, {directory, timeoutMs: 60_000});
      process.send({event: 'held', defaultDirectory: defaultHostGateDirectory()});
    }
    if (msg === 'start-child') {
      const child = spawn(process.execPath, ['-e','setInterval(() => {}, 1000)'], {detached:true, stdio:'ignore', windowsHide:true});
      child.unref(); process.send({event:'child', pid: child.pid});
    }
    if (msg === 'release') { release?.(); process.send({event:'released'}); }
  } catch(error) { process.send({event:'error', message:String(error)}); }
});
process.send({event:'ready'});`;

async function worker(role: string, root: string, directory: string) {
    const cwd = join(root, role); fs.mkdirSync(cwd);
    const child = spawn(process.execPath, ['--input-type=module', '-e', fixture, role, directory], { cwd, windowsHide: true,
        env: { ...process.env, HOME: cwd, USERPROFILE: cwd, TMP: cwd, TEMP: cwd, TMPDIR: cwd }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    const messages: { event: string; pid?: number; message?: string; defaultDirectory?: string }[] = [];
    child.on('message', message => messages.push(message as typeof messages[number]));
    async function until(event: string) {
        const end = Date.now() + 65_000;
        while (!messages.some(msg => msg.event === event)) {
            const failure = messages.find(msg => msg.event === 'error');
            assert(!failure, failure?.message); assert(child.exitCode === null && child.signalCode === null, role + ' exited');
            assert(Date.now() < end, 'Timed out waiting for ' + role + ' ' + event); await delay(20);
        }
        return messages.find(msg => msg.event === event)!;
    }
    await until('ready'); return { child, messages, until };
}
async function stop(child: ChildProcess) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
}
function killFixture(pid: number, token: string) {
    if (processAlive(pid, token) === true) process.kill(pid, 'SIGKILL');
}

test('independent checkouts and environments wait for normal release and can cancel their wait', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'host-gate-')), directory = join(root, 'scope'); fs.mkdirSync(directory);
    t.after(() => removeTree(root));
    const first = await worker('2.1.326', root, directory), second = await worker('2.1.332', root, directory);
    t.after(async () => { await Promise.all([stop(first.child), stop(second.child)]); });
    first.child.send('take'); assert.equal((await first.until('held')).defaultDirectory, defaultHostGateDirectory());
    second.child.send('take');
    await assert.rejects(acquireHostVersionGate('blocked', { directory, timeoutMs: 80 }), /Timed out waiting/u);
    const controller = new AbortController();
    const waiting = acquireHostVersionGate('cancelled', { directory, signal: controller.signal });
    controller.abort(); await assert.rejects(waiting, { name: 'AbortError' });
    assert(!second.messages.some(m => m.event === 'held'));
    first.child.send('release'); await first.until('released');
    assert.equal((await second.until('held')).defaultDirectory, defaultHostGateDirectory());
    second.child.send('release'); await second.until('released');
});

test('a killed owner retains its detached child and releases after exit while an unrelated new subtree stays active', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'host-gate-crash-')), directory = join(root, 'scope'); fs.mkdirSync(directory);
    t.after(() => removeTree(root));
    const unrelated = await worker('outside', root, directory), owner = await worker('2.1.288', root, directory);
    const children = new Map<number, string>(), workers = [unrelated, owner];
    t.after(async () => {
        for (const [pid, token] of children) killFixture(pid, token);
        await Promise.all(workers.map(w => stop(w.child)));
    });
    owner.child.send('take'); await owner.until('held');
    async function start(f: typeof owner) {
        f.child.send('start-child'); const pid = (await f.until('child')).pid!, token = processToken(pid);
        assert(token); children.set(pid, token); return { pid, token };
    }
    const left = await start(owner), other = await start(unrelated);
    const first = await worker('queued-1', root, directory), second = await worker('queued-2', root, directory);
    workers.push(first, second); first.child.send('take'); second.child.send('take');
    await stop(owner.child); assert.equal(processAlive(left.pid, left.token), true);
    // The new session has lost its original parent and is outside the caller's own process group.
    await assert.rejects(acquireHostVersionGate('check-orphan', { directory, timeoutMs: 400 }), /possible surviving processes/u);
    assert(![first, second].some(w => w.messages.some(m => m.event === 'held')));
    killFixture(left.pid, left.token);
    const next = await Promise.race([first, second].map(async w => { await w.until('held'); return w; }));
    assert.equal(processAlive(other.pid, other.token), true);
    const later = next === first ? second : first; assert(!later.messages.some(m => m.event === 'held'));
    next.child.send('release'); await next.until('released'); await later.until('held');
    later.child.send('release'); await later.until('released');
});

test('an unrecognized or replaced machine claim is never removed', async t => {
    const directory = fs.mkdtempSync(join(tmpdir(), 'host-gate-foreign-'));
    t.after(() => removeTree(directory));
    const release = await acquireHostVersionGate('test', { directory });
    const record = join(directory, fs.readdirSync(directory).find(name => name.endsWith('.json'))!);
    const foreign = JSON.stringify({ unrelated: true }); fs.writeFileSync(record, foreign);
    assert.throws(release, /Unrecognized official host gate record/u);
    await assert.rejects(acquireHostVersionGate('later', { directory }), /Unrecognized official host gate record/u);
    assert.equal(fs.readFileSync(record, 'utf8'), foreign);
});
