/** Run every official Mod test file exactly once in a bounded, unchanged-source copy. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { LaunchSpec } from '@fbincon/statusline-core/integration/binding';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { sha256 } from '../build/files.js';
import { retainLog, sanitizeLog } from './diagnostics.js';
import { runOfficialTestCommand } from './official-tests/command.js';

export const OFFICIAL_TEST_TIMEOUT_MS = 180_000;
export const MAX_OFFICIAL_MOD_TEST_JOBS = 8;
export type OfficialTestTimeoutMs = 180_000 | 300_000;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/u;
const HOST_TYPES = '.claude-plugin/types/';
const HASH = /^[a-f0-9]{64}$/u;
type Hashes = Record<string, string>;
export interface OfficialTestInventory {
    source_files: Hashes;
    host_files: Hashes;
    source_sha256: string;
    host_sha256: string;
    test_files: string[];
}
export interface OfficialTestSummary { tests: number; files: number; pass: number; fail: number; skip: number }
export interface OfficialTestBatch extends OfficialTestSummary {
    index: number;
    test_files: string[];
    test_hashes: Hashes;
    copied_source_sha256: string;
    host_sha256: string;
    timeout_ms: number;
    elapsed_ms: number;
    log: string;
    log_sha256: string;
}
export interface OfficialTestReceipt extends OfficialTestInventory {
    schema_version: 1;
    kind: 'official-mod-test-batches';
    status: 'pass';
    timeout_ms: number;
    /** Absent in receipts issued by the original synchronous executor. */
    concurrency?: { limit: number; peak: number };
    elapsed_ms?: number;
    batches: OfficialTestBatch[];
    totals: OfficialTestSummary;
}
export interface OfficialTestPhase {
    argv: string[]; elapsed_ms: number; timeout_ms: number;
    status: number | null; signal: string | null; error: string | null; log: string;
}
export interface OfficialCommandResult {
    status: number | null; signal?: string | null; error?: Error;
    stdout?: string | null; stderr?: string | null;
}
export interface OfficialCommandOptions { cwd: string; env: NodeJS.ProcessEnv; timeout: number; encoding: 'utf8'; maxBuffer: number; signal?: AbortSignal }
export interface OfficialTestOptions {
    source: string; temporary: string; logs: string; host: LaunchSpec;
    cwd: string; env: NodeJS.ProcessEnv;
    /** Capacity preserves its existing 300s command budget; ordinary Mod tests use 180s. */
    timeoutMs?: OfficialTestTimeoutMs;
    logPrefix?: string;
    onCommand?: (phase: OfficialTestPhase) => void;
    beforeCommand?: (timeoutMs: number) => void;
    signal?: AbortSignal;
}
export type OfficialTestExecute = (executable: string, args: string[], options: OfficialCommandOptions) => OfficialCommandResult | Promise<OfficialCommandResult>;

/** A local operator can tune one machine's active file count without changing coverage. */
export function officialModTestJobs(env: NodeJS.ProcessEnv): number {
    const requested = env.STATUSLINE_MOD_TEST_JOBS;
    if (requested === undefined) return 4;
    const jobs = Number(requested);
    assert(Number.isSafeInteger(jobs) && String(jobs) === requested && jobs >= 1 && jobs <= MAX_OFFICIAL_MOD_TEST_JOBS,
        'STATUSLINE_MOD_TEST_JOBS must be an integer from 1 to ' + MAX_OFFICIAL_MOD_TEST_JOBS);
    return jobs;
}
const ordered = (entries: Iterable<readonly [string, string]>): Hashes => Object.fromEntries([...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
const digest = (files: Hashes) => sha256(JSON.stringify(ordered(Object.entries(files))));

/** Host-emitted declarations are retained but kept separate from archived source inputs. */
export function officialTestInventory(directory: string): OfficialTestInventory {
    assert(fs.lstatSync(directory).isDirectory(), 'Official Mod source must be a directory');
    const source: [string, string][] = [], host: [string, string][] = [];
    function visit(prefix: string): void {
        for (const name of fs.readdirSync(join(directory, prefix)).sort()) {
            // Locally installed compiler dependencies are neither Mod source nor
            // host sandbox imports; source archives omit them as well.
            if (name === 'node_modules') continue;
            const relative = prefix ? prefix + '/' + name : name, path = join(directory, relative), stat = fs.lstatSync(path);
            assert(!stat.isSymbolicLink(), 'Linked official Mod input: ' + relative);
            if (stat.isDirectory()) visit(relative);
            else {
                assert(stat.isFile(), 'Non-regular official Mod input: ' + relative);
                (relative.startsWith(HOST_TYPES) ? host : source).push([relative, sha256(fs.readFileSync(path))]);
            }
        }
    }
    visit('');
    const source_files = ordered(source), host_files = ordered(host);
    const test_files = Object.keys(source_files).filter(path => TEST_FILE.test(path));
    assert(test_files.length, 'No official test files');
    return { source_files, host_files, source_sha256: digest(source_files), host_sha256: digest(host_files), test_files };
}

/** Unknown, incomplete, skipped or contradictory official summaries never pass. */
export function parseOfficialTestSummary(output: string, selected: readonly string[]): OfficialTestSummary {
    const text = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/gu, '').replaceAll('\\', '/');
    const count = (name: string, optional = false): number => {
        const matches = [...text.matchAll(new RegExp('^\\s*(\\d+) ' + name + '\\s*$', 'gmu'))];
        if (optional && !matches.length) return 0;
        assert.equal(matches.length, 1, 'Missing or duplicate official ' + name + ' summary');
        return Number(matches[0]![1]);
    };
    const pass = count('pass'), fail = count('fail'), skip = count('skip', true);
    const summaries = [...text.matchAll(/^Ran (\d+) tests? across (\d+) files?\.\s*\[[^\]\r\n]+\]\s*$/gmu)];
    assert.equal(summaries.length, 1, 'Missing or duplicate official execution summary');
    const tests = Number(summaries[0]![1]), files = Number(summaries[0]![2]);
    const executed = [...text.matchAll(/^([^\r\n]+\.test\.[cm]?[jt]sx?):\s*$/gmu)].map(match => match[1]!.replace(/^\.\//u, ''));
    assert.deepEqual(executed.sort(), [...selected].sort(), 'Official executed-file inventory differs');
    assert.equal(files, selected.length, 'Official file count differs');
    assert(pass > 0 && Number.isSafeInteger(pass), 'Official batch must execute tests');
    assert.equal(tests, pass, 'Official tests were not all successful');
    assert.equal(fail, 0, 'Official tests failed'); assert.equal(skip, 0, 'Official tests skipped');
    assert(!/^\s*\((?:fail|skip|todo)\)/mu.test(text) && !/^\s*[1-9]\d* (?:error|todo)s?\b/mu.test(text), 'Official result contains unsuccessful tests');
    assert.equal([...text.matchAll(/^\(pass\) /gmu)].length, pass, 'Official pass lines differ from summary');
    return { tests, files, pass, fail, skip };
}

function selectedSource(source: Hashes, selected: readonly string[]): Hashes {
    return ordered(Object.entries(source).filter(([path]) => !TEST_FILE.test(path) || selected.includes(path)));
}
function checkHashes(value: Hashes): void {
    assert(value && typeof value === 'object' && !Array.isArray(value), 'Invalid official source inventory');
    for (const [path, hash] of Object.entries(value)) {
        assert(path && !path.startsWith('/') && !path.includes('\\') && path.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe official input path');
        assert(typeof hash === 'string' && HASH.test(hash), 'Invalid official input digest');
    }
}

/** Bind receipt coverage to an independently supplied immutable source inventory. */
export function verifyOfficialTestBatches(receipt: OfficialTestReceipt, expectedSource: Readonly<Hashes>, timeoutMs: OfficialTestTimeoutMs = OFFICIAL_TEST_TIMEOUT_MS): void {
    assert(timeoutMs === 180_000 || timeoutMs === 300_000, 'Unsupported official test command budget');
    assert.equal(receipt.schema_version, 1); assert.equal(receipt.kind, 'official-mod-test-batches'); assert.equal(receipt.status, 'pass');
    assert.equal(receipt.timeout_ms, timeoutMs);
    checkHashes(receipt.source_files); checkHashes(receipt.host_files); checkHashes(expectedSource);
    assert(Object.keys(receipt.host_files).every(path => path.startsWith(HOST_TYPES)), 'Unexpected host declaration path');
    assert(Object.keys(receipt.source_files).every(path => !path.startsWith(HOST_TYPES)), 'Host declarations cannot stand in for source');
    assert.deepEqual(ordered(Object.entries(receipt.source_files)), ordered(Object.entries(expectedSource)), 'Official source files changed');
    assert.equal(receipt.source_sha256, digest(receipt.source_files)); assert.equal(receipt.host_sha256, digest(receipt.host_files));
    const expectedTests = Object.keys(ordered(Object.entries(expectedSource))).filter(path => TEST_FILE.test(path));
    assert(expectedTests.length, 'No expected official tests'); assert.deepEqual(receipt.test_files, expectedTests);
    if (receipt.concurrency !== undefined) {
        const { limit, peak } = receipt.concurrency;
        assert(Number.isInteger(limit) && limit >= 1 && limit <= MAX_OFFICIAL_MOD_TEST_JOBS && Number.isInteger(peak) && peak >= 1 &&
            peak <= Math.min(limit, expectedTests.length), 'Invalid official test concurrency');
    }
    if (receipt.elapsed_ms !== undefined) assert(Number.isFinite(receipt.elapsed_ms) && receipt.elapsed_ms >= 0, 'Invalid official family duration');
    assert(Array.isArray(receipt.batches)); assert.equal(receipt.batches.length, expectedTests.length, 'Official batches omitted or duplicated');
    const totals: OfficialTestSummary = { files: 0, tests: 0, pass: 0, fail: 0, skip: 0 }, logs = new Set<string>();
    for (const [index, batch] of receipt.batches.entries()) {
        const path = expectedTests[index]!;
        assert.equal(batch.index, index); assert.deepEqual(batch.test_files, [path], 'Official batch inventory differs');
        assert.deepEqual(batch.test_hashes, { [path]: expectedSource[path] });
        assert.equal(batch.copied_source_sha256, digest(selectedSource(receipt.source_files, [path])));
        assert.equal(batch.host_sha256, receipt.host_sha256); assert.equal(batch.timeout_ms, timeoutMs);
        assert(Number.isFinite(batch.elapsed_ms) && batch.elapsed_ms >= 0 && batch.elapsed_ms <= batch.timeout_ms, 'Invalid official execution duration');
        if (receipt.elapsed_ms !== undefined) assert(batch.elapsed_ms <= receipt.elapsed_ms, 'Official batch exceeds family duration');
        assert.equal(batch.files, 1); assert(Number.isSafeInteger(batch.tests) && batch.tests > 0);
        assert.equal(batch.pass, batch.tests); assert.equal(batch.fail, 0); assert.equal(batch.skip, 0);
        assert(/^[a-z0-9.-]+\.log$/u.test(batch.log) && !logs.has(batch.log), 'Invalid or repeated official result log');
        logs.add(batch.log); assert(HASH.test(batch.log_sha256), 'Missing official result log digest');
        for (const key of ['files', 'tests', 'pass', 'fail', 'skip'] as const) totals[key] += batch[key];
    }
    assert.deepEqual(receipt.totals, totals, 'Official summary totals differ');
}

function createTestWorkspace(options: OfficialTestOptions) {
    const source = resolve(options.source), temporary = resolve(options.temporary);
    const timeoutMs = options.timeoutMs ?? OFFICIAL_TEST_TIMEOUT_MS;
    assert(timeoutMs === 180_000 || timeoutMs === 300_000, 'Unsupported official test command budget');
    assert(!fs.existsSync(temporary), 'Official test copies require a new directory');
    const separation = relative(source, temporary);
    assert(isAbsolute(separation) || separation === '..' || separation.startsWith('..' + sep), 'Official copies must be outside the source');
    const logSeparation = relative(temporary, resolve(options.logs));
    assert(isAbsolute(logSeparation) || logSeparation === '..' || logSeparation.startsWith('..' + sep), 'Official logs must survive workspace cleanup');
    const inventory = officialTestInventory(source);
    const prefix = options.logPrefix ?? basename(source).toLowerCase(); assert(/^[a-z0-9-]+$/u.test(prefix), 'Invalid official log prefix');
    fs.mkdirSync(temporary, { mode: 0o700 });
    return { source, temporary, inventory, prefix, timeoutMs, options };
}
type TestWorkspace = ReturnType<typeof createTestWorkspace>;

function prepareFile(workspace: TestWorkspace, index: number) {
    const { source, temporary, inventory, prefix, options, timeoutMs } = workspace;
    const file = inventory.test_files[index]!, id = 'batch-' + String(index + 1).padStart(4, '0');
    const logName = prefix + '-' + id + '.log';
    fs.mkdirSync(options.logs, { recursive: true, mode: 0o700 });
    // Claim before starting the host so another invocation cannot overwrite its evidence.
    fs.closeSync(fs.openSync(join(options.logs, logName), 'wx', 0o600));
    const directory = join(temporary, id);
    fs.cpSync(source, directory, { recursive: true, filter: path => basename(path) !== 'node_modules' });
    assert.deepEqual(officialTestInventory(directory), inventory, 'Official source copy differs');
    for (const other of inventory.test_files) if (other !== file) {
        const path = join(directory, other); removeTree(path); assert(!fs.existsSync(path), 'Unselected official test was not removed');
    }
    const copied = officialTestInventory(directory);
    assert.deepEqual(copied.source_files, selectedSource(inventory.source_files, [file]));
    assert.deepEqual(copied.host_files, inventory.host_files); assert.deepEqual(copied.test_files, [file]);
    const args = [...options.host.args, 'plugin', 'test', directory];
    const command: OfficialCommandOptions = { cwd: options.cwd, env: options.env, timeout: timeoutMs, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 };
    return { index, file, logName, directory, copied, args, command };
}
type PreparedFile = ReturnType<typeof prepareFile>;

function commandError(error: unknown): OfficialCommandResult {
    return { status: null, error: error instanceof Error ? error : new Error(String(error)) };
}
function completeFile(workspace: TestWorkspace, batch: PreparedFile, result: OfficialCommandResult, elapsed_ms: number): OfficialTestBatch {
    const { options, timeoutMs, inventory } = workspace, { index, file, logName, directory, args, copied } = batch;
    const output = (result.stdout ?? '') + (result.stderr ?? '');
    const log = retainLog(options.logs, logName, output + (result.error ? '\n' + String(result.error) : ''));
    options.onCommand?.({ argv: args.map(arg => sanitizeLog(arg)), elapsed_ms, timeout_ms: timeoutMs,
        status: result.status, signal: result.signal ?? null, error: result.error?.name ?? null, log });
    assert(result.status === 0 && !result.error && !result.signal && elapsed_ms <= timeoutMs, 'Official test batch failed: ' + file + '; see ' + log);
    const summary = parseOfficialTestSummary(output, [file]);
    const retained = fs.readFileSync(join(options.logs, log));
    assert.deepEqual(parseOfficialTestSummary(retained.toString('utf8'), [file]), summary, 'Retained official log differs from command output');
    assert.deepEqual(officialTestInventory(directory), copied, 'Official tests changed their source copy');
    return { index, test_files: [file], test_hashes: { [file]: inventory.source_files[file]! }, copied_source_sha256: copied.source_sha256,
        host_sha256: copied.host_sha256, ...summary, timeout_ms: timeoutMs, elapsed_ms, log, log_sha256: sha256(retained) };
}
function finalized(workspace: TestWorkspace, batches: OfficialTestBatch[], concurrency: NonNullable<OfficialTestReceipt['concurrency']>): OfficialTestReceipt {
    const { source, inventory, timeoutMs } = workspace;
    assert.deepEqual(officialTestInventory(source), inventory, 'Official source changed during acceptance');
    const totals = batches.reduce<OfficialTestSummary>((sum, batch) => ({ files: sum.files + batch.files, tests: sum.tests + batch.tests,
        pass: sum.pass + batch.pass, fail: sum.fail + batch.fail, skip: sum.skip + batch.skip }), { files: 0, tests: 0, pass: 0, fail: 0, skip: 0 });
    const receipt: OfficialTestReceipt = { schema_version: 1, kind: 'official-mod-test-batches', status: 'pass', ...inventory,
        timeout_ms: timeoutMs, concurrency, batches, totals };
    verifyOfficialTestBatches(receipt, inventory.source_files, timeoutMs);
    return receipt;
}
function removeCopy(directory: string): void {
    removeTree(directory); assert(!fs.existsSync(directory), 'Official test copy was not removed');
}

/** Each host process sees one file and private writable settings. Admitted files finish before cleanup. */
export async function runOfficialTestBatches(options: OfficialTestOptions,
    execute: OfficialTestExecute = runOfficialTestCommand): Promise<OfficialTestReceipt> {
    const started = performance.now();
    const limit = officialModTestJobs(options.env), workspace = createTestWorkspace(options);
    const batches: OfficialTestBatch[] = [], controller = new AbortController();
    let next = 0, active = 0, peak = 0, failure: unknown;
    const cancel = () => { failure ??= new Error('Official Mod test execution cancelled'); controller.abort(); };
    process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    async function runFile(index: number): Promise<void> {
        try {
            const batch = prepareFile(workspace, index), config = batch.directory + '-config';
            fs.mkdirSync(config, { mode: 0o700 });
            try {
                const command = { ...batch.command, env: { ...options.env, CLAUDE_CONFIG_DIR: config }, signal: controller.signal };
                const started = performance.now();
                let result: OfficialCommandResult;
                try {
                    options.beforeCommand?.(command.timeout);
                    active++; peak = Math.max(peak, active);
                    try {
                        const running = execute(options.host.executable, batch.args, command);
                        result = 'then' in running ? await running : running;
                    } finally { active--; }
                } catch (error) { result = commandError(error); }
                batches[index] = completeFile(workspace, batch, result, performance.now() - started);
            } finally { removeCopy(batch.directory); removeCopy(config); }
        } catch (error) {
            // Close admission in the continuation that observed the failure, before another lane resumes.
            failure ??= error instanceof Error ? error : new Error(String(error));
        }
    }
    async function worker(): Promise<void> {
        while (!failure && next < workspace.inventory.test_files.length) await runFile(next++);
    }
    let receipt: OfficialTestReceipt;
    try {
        await Promise.all(Array.from({ length: Math.min(limit, workspace.inventory.test_files.length) }, worker));
        if (failure) throw failure;
        receipt = finalized(workspace, batches, { limit, peak });
    } finally {
        process.off('SIGINT', cancel); process.off('SIGTERM', cancel); options.signal?.removeEventListener('abort', cancel);
        removeCopy(workspace.temporary);
    }
    receipt.elapsed_ms = performance.now() - started;
    return receipt;
}
