/** The process enforcing deadlines never runs the synchronous installed assertions. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import type { Writable } from 'node:stream';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { processToken } from '@fbincon/statusline-platform/processes';
import { stopNestedOwners, requireStopped, type Owner } from './fixture-processes.js';
import { runSourceProcess } from '@fbincon/statusline-platform/source-process';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { WORKER_OVERHEAD, supervisionBudget, type AcceptancePhase } from './budgets.js';

type Event = { name: string; event: 'start' | 'end' | 'fail' };
const eventPath = 'TS05_PHASE_EVENTS';
export function phaseEvent(name: string, event: Event['event']): void {
    const path = process.env[eventPath];
    if (path) fs.appendFileSync(path, JSON.stringify({ name, event }) + '\n');
}
export function phaseSync<T>(name: string, action: () => T): T {
    phaseEvent(name, 'start');
    try { const value = action(); phaseEvent(name, 'end'); return value; }
    catch (error) { phaseEvent(name, 'fail'); throw error; }
}
export async function phaseAsync<T>(name: string, action: () => Promise<T> | T): Promise<T> {
    phaseEvent(name, 'start');
    try { const value = await action(); phaseEvent(name, 'end'); return value; }
    catch (error) { phaseEvent(name, 'fail'); throw error; }
}
export class PhaseWatchdog {
    private index = 0;
    private active = false;
    private failed = '';
    private expiry: number;
    constructor(readonly phases: readonly AcceptancePhase[], private readonly now = () => performance.now(), private readonly overhead = WORKER_OVERHEAD) {
        assert(phases.length && phases.every(p => p.name && Number.isSafeInteger(p.budgetMs) && p.budgetMs > 0));
        this.expiry = this.now() + this.overhead.start;
    }
    get current(): string { return this.phases[this.index]?.name ?? 'worker-exit'; }
    check(): void {
        if (this.now() > this.expiry) throw new Error('Installed acceptance deadline exceeded: ' + this.current);
    }
    observe(value: Event): void {
        this.check();
        const last = this.phases.at(-1)!;
        if (this.failed && !this.active && value.event === 'start' && value.name === last.name && last.name.includes('cleanup'))
            this.index = this.phases.length - 1; // A failed before-hook can go directly to teardown.
        const phase = this.phases[this.index];
        assert(phase && value.name === phase.name, 'Unexpected installed phase: ' + value.name + ' (expected ' + this.current + ')');
        if (value.event === 'start') {
            assert(!this.active, 'Repeated phase start: ' + phase.name);
            this.active = true; this.expiry = this.now() + phase.budgetMs + this.overhead.handoff;
            return;
        }
        assert(this.active && ['end', 'fail'].includes(value.event), 'Unexpected installed phase event: ' + value.event);
        if (value.event === 'fail') this.failed ||= phase.name;
        this.active = false; this.index++;
        this.expiry = this.now() + (this.index === this.phases.length ? this.overhead.exit : this.overhead.handoff);
    }
    finish(): void {
        this.check(); assert(!this.active && this.index === this.phases.length, 'Incomplete installed phases at ' + this.current);
        assert(!this.failed, 'Installed assertion or fixture failed: ' + this.failed);
    }
}
function logTail(path: string, stream: Writable): () => boolean {
    fs.writeFileSync(path, '', { mode: 0o600, flag: 'wx' });
    let offset = 0;
    const buffer = Buffer.alloc(64 * 1024);
    return () => {
        const fd = fs.openSync(path, 'r');
        try {
            const size = fs.fstatSync(fd).size;
            while (offset < size && !stream.writableNeedDrain) {
                const length = fs.readSync(fd, buffer, 0, Math.min(buffer.length, size - offset), offset);
                if (!length) break;
                stream.write(Buffer.from(buffer.subarray(0, length))); offset += length;
            }
            return offset === size && !stream.writableNeedDrain;
        } finally { fs.closeSync(fd); }
    };
}
/** Event files are private to this invocation. Keep completed/failed diagnostics outside the fixture cleanup. */
export async function superviseInstalled(args: string[], phases: AcceptancePhase[], env: NodeJS.ProcessEnv, report: string, options: { signal?: AbortSignal; executable?: string; cwd?: string; overhead?: typeof WORKER_OVERHEAD; maxBudgetMs?: number; fixture?: string; output?: { stdout: Writable; stderr: Writable } } = {}): Promise<void> {
    const serialBudget = supervisionBudget(phases, options.overhead);
    const budgetMs = Math.min(serialBudget, options.maxBudgetMs ?? serialBudget);
    assert(Number.isSafeInteger(budgetMs) && budgetMs > 0, 'Invalid supervision budget');
    fs.mkdirSync(dirname(report), { recursive: true });
    const temporary = fs.mkdtempSync(join(tmpdir(), 'statusline-phase-')), path = join(temporary, 'events.jsonl');
    fs.writeFileSync(path, '', { flag: 'wx', mode: 0o600 });
    const out = logTail(join(temporary, 'stdout'), options.output?.stdout ?? process.stdout), err = logTail(join(temporary, 'stderr'), options.output?.stderr ?? process.stderr);
    const watchdog = new PhaseWatchdog(phases, undefined, options.overhead), controller = new AbortController(), started = performance.now();
    const records: (Event & { elapsed_ms: number })[] = [];
    let consumed = 0, failure: unknown, stderr = '', status = 'fail', owner: Owner | null = null;
    let owners: ReturnType<typeof stopNestedOwners> = [], cleanupError: unknown, fixtureRemoved: boolean | null = null;
    const stop = () => {
        if (controller.signal.aborted) return;
        try { owners = stopNestedOwners(owner); } catch (error) { cleanupError = error; }
        controller.abort();
    };
    const drain = () => {
        const { size } = fs.statSync(path);
        assert(size >= consumed && size <= 256 * 1024, 'Invalid installed phase trace');
        const fd = fs.openSync(path, 'r');
        try {
            const bytes = Buffer.alloc(size - consumed);
            const count = bytes.length ? fs.readSync(fd, bytes, 0, bytes.length, consumed) : 0;
            const end = bytes.subarray(0, count).lastIndexOf(10);
            if (end >= 0) {
                const lines = bytes.subarray(0, end).toString('utf8').split('\n');
                for (const line of lines) {
                    const value = JSON.parse(line) as Event;
                    const row = { ...value, elapsed_ms: Math.round(performance.now() - started) };
                    records.push(row); console.log(JSON.stringify({ installed_phase: row }));
                    watchdog.observe(value);
                }
                consumed += end + 1;
            }
        } finally { fs.closeSync(fd); }
        watchdog.check();
    };
    const tick = () => {
        if (failure) return;
        try { out(); err(); drain(); } catch (error) { failure = error; stop(); }
    };
    const cancel = () => { failure ??= new Error('Installed acceptance cancelled at ' + watchdog.current); stop(); };
    process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const timer = setInterval(tick, 100);
    try {
        const supervisor = fileURLToPath(new URL('./supervised-node.js', import.meta.url));
        const result = await runSourceProcess({ executable: options.executable ?? process.execPath, args: [supervisor, temporary, ...args], cwd: options.cwd ?? process.cwd(), input: '',
            environment: { ...env, [eventPath]: path }, timeoutMs: budgetMs, signal: controller.signal,
            onProcess: pid => {
                owner = null;
                if (pid && process.platform !== 'win32') {
                    const token = processToken(pid); assert(token, 'Missing acceptance root birth identity'); owner = { pid, token };
                }
            }, captureStderr: value => { stderr = value; } });
        try { await requireStopped(owners); } catch (error) { cleanupError ??= error; }
        clearInterval(timer);
        if (stderr) process.stderr.write(stderr); if (result.stdout) process.stdout.write(result.stdout);
        if (!failure) {
            try {
                drain(); watchdog.finish();
                assert.equal(result.reason, 'completed', 'Installed worker failed at ' + watchdog.current + ': ' + result.reason);
                assert.equal(result.code, 0); assert.equal(consumed, fs.statSync(path).size, 'Incomplete phase event');
            } catch (error) { failure = error; }
        }
        const drainDeadline = performance.now() + WORKER_OVERHEAD.exit;
        while (!out() || !err()) {
            if (performance.now() > drainDeadline) throw new Error('Installed acceptance output drain timed out');
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        if (failure) throw failure;
        if (cleanupError) throw cleanupError;
        status = 'pass';
    } catch (error) { failure ??= error; throw error; }
    finally {
        clearInterval(timer); process.off('SIGINT', cancel); process.off('SIGTERM', cancel); options.signal?.removeEventListener('abort', cancel);
        try {
            if (options.fixture) {
                if (!cleanupError && fs.existsSync(options.fixture)) removeTree(options.fixture);
                fixtureRemoved = !fs.existsSync(options.fixture);
                assert(fixtureRemoved, 'Installed fixture retained after uncertain process cleanup: ' + options.fixture);
            }
            removeTree(temporary); assert(!fs.existsSync(temporary), 'Installed supervisor cleanup failed');
        } catch (error) { status = 'fail'; cleanupError ??= error; failure ??= error; throw failure; }
        finally {
            fs.writeFileSync(report + '.phases.json', JSON.stringify({ status, budget_ms: budgetMs,
                elapsed_ms: Math.round(performance.now() - started), phase: watchdog.current, error: failure instanceof Error ? failure.message : null,
                promotable: false, cleanup_error: cleanupError instanceof Error ? cleanupError.message : null, fixture_removed: fixtureRemoved, phases, events: records }, null, 2) + '\n');
        }
    }
}
