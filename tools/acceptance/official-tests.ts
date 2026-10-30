/** Run every official Mod test file exactly once in a bounded, unchanged-source copy. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { LaunchSpec } from '@fbincon/statusline-core/integration/binding';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { sha256 } from '../build/files.js';
import { retainLog, sanitizeLog } from './diagnostics.js';

export const OFFICIAL_TEST_TIMEOUT_MS = 180_000;
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
    batches: OfficialTestBatch[];
    totals: OfficialTestSummary;
}
export interface OfficialTestPhase {
    argv: string[]; elapsed_ms: number; timeout_ms: number;
    status: number | null; signal: string | null; error: string | null; log: string;
}
interface CommandResult {
    status: number | null; signal?: string | null; error?: Error;
    stdout?: string | null; stderr?: string | null;
}
interface CommandOptions { cwd: string; env: NodeJS.ProcessEnv; timeout: number; encoding: 'utf8'; maxBuffer: number }
export interface OfficialTestOptions {
    source: string; temporary: string; logs: string; host: LaunchSpec;
    cwd: string; env: NodeJS.ProcessEnv;
    onCommand?: (phase: OfficialTestPhase) => void;
}
type Execute = (executable: string, args: string[], options: CommandOptions) => CommandResult;
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
export function verifyOfficialTestBatches(receipt: OfficialTestReceipt, expectedSource: Readonly<Hashes>): void {
    assert.equal(receipt.schema_version, 1); assert.equal(receipt.kind, 'official-mod-test-batches'); assert.equal(receipt.status, 'pass');
    assert.equal(receipt.timeout_ms, OFFICIAL_TEST_TIMEOUT_MS);
    checkHashes(receipt.source_files); checkHashes(receipt.host_files); checkHashes(expectedSource);
    assert(Object.keys(receipt.host_files).every(path => path.startsWith(HOST_TYPES)), 'Unexpected host declaration path');
    assert(Object.keys(receipt.source_files).every(path => !path.startsWith(HOST_TYPES)), 'Host declarations cannot stand in for source');
    assert.deepEqual(ordered(Object.entries(receipt.source_files)), ordered(Object.entries(expectedSource)), 'Official source files changed');
    assert.equal(receipt.source_sha256, digest(receipt.source_files)); assert.equal(receipt.host_sha256, digest(receipt.host_files));
    const expectedTests = Object.keys(ordered(Object.entries(expectedSource))).filter(path => TEST_FILE.test(path));
    assert(expectedTests.length, 'No expected official tests'); assert.deepEqual(receipt.test_files, expectedTests);
    assert(Array.isArray(receipt.batches)); assert.equal(receipt.batches.length, expectedTests.length, 'Official batches omitted or duplicated');
    const totals: OfficialTestSummary = { files: 0, tests: 0, pass: 0, fail: 0, skip: 0 }, logs = new Set<string>();
    for (const [index, batch] of receipt.batches.entries()) {
        const path = expectedTests[index]!;
        assert.equal(batch.index, index); assert.deepEqual(batch.test_files, [path], 'Official batch inventory differs');
        assert.deepEqual(batch.test_hashes, { [path]: expectedSource[path] });
        assert.equal(batch.copied_source_sha256, digest(selectedSource(receipt.source_files, [path])));
        assert.equal(batch.host_sha256, receipt.host_sha256); assert.equal(batch.timeout_ms, OFFICIAL_TEST_TIMEOUT_MS);
        assert(Number.isFinite(batch.elapsed_ms) && batch.elapsed_ms >= 0 && batch.elapsed_ms <= batch.timeout_ms, 'Invalid official execution duration');
        assert.equal(batch.files, 1); assert(Number.isSafeInteger(batch.tests) && batch.tests > 0);
        assert.equal(batch.pass, batch.tests); assert.equal(batch.fail, 0); assert.equal(batch.skip, 0);
        assert(/^[a-z0-9.-]+\.log$/u.test(batch.log) && !logs.has(batch.log), 'Invalid or repeated official result log');
        logs.add(batch.log); assert(HASH.test(batch.log_sha256), 'Missing official result log digest');
        for (const key of ['files', 'tests', 'pass', 'fail', 'skip'] as const) totals[key] += batch[key];
    }
    assert.deepEqual(receipt.totals, totals, 'Official summary totals differ');
}

export function runOfficialTestBatches(options: OfficialTestOptions, execute: Execute = (file, args, opts) => spawnSync(file, args, opts)): OfficialTestReceipt {
    const source = resolve(options.source), temporary = resolve(options.temporary);
    assert(!fs.existsSync(temporary), 'Official test copies require a new directory');
    const separation = relative(source, temporary);
    assert(isAbsolute(separation) || separation === '..' || separation.startsWith('..' + sep), 'Official copies must be outside the source');
    const logSeparation = relative(temporary, resolve(options.logs));
    assert(isAbsolute(logSeparation) || logSeparation === '..' || logSeparation.startsWith('..' + sep), 'Official logs must survive workspace cleanup');
    const inventory = officialTestInventory(source), batches: OfficialTestBatch[] = [];
    const prefix = basename(source).toLowerCase(); assert(/^[a-z0-9-]+$/u.test(prefix), 'Invalid official Mod name');
    fs.mkdirSync(temporary, { recursive: false, mode: 0o700 });
    try {
        for (const [index, file] of inventory.test_files.entries()) {
            const logName = prefix + '-batch-' + String(index + 1).padStart(4, '0') + '.log';
            assert(!fs.existsSync(join(options.logs, logName)), 'Use a new official log directory');
            const directory = join(temporary, 'batch-' + String(index + 1).padStart(4, '0'));
            fs.cpSync(source, directory, { recursive: true, filter: path => basename(path) !== 'node_modules' });
            try {
                assert.deepEqual(officialTestInventory(directory), inventory, 'Official source copy differs');
                for (const other of inventory.test_files) if (other !== file) {
                    const path = join(directory, other); removeTree(path); assert(!fs.existsSync(path), 'Unselected official test was not removed');
                }
                const copied = officialTestInventory(directory);
                assert.deepEqual(copied.source_files, selectedSource(inventory.source_files, [file]));
                assert.deepEqual(copied.host_files, inventory.host_files); assert.deepEqual(copied.test_files, [file]);
                const args = [...options.host.args, 'plugin', 'test', directory], started = performance.now();
                let result: CommandResult;
                try { result = execute(options.host.executable, args, { cwd: options.cwd, env: options.env, encoding: 'utf8', timeout: OFFICIAL_TEST_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }); }
                catch (error) { result = { status: null, error: error instanceof Error ? error : new Error(String(error)) }; }
                const elapsed_ms = performance.now() - started, output = (result.stdout ?? '') + (result.stderr ?? '');
                const log = retainLog(options.logs, logName, output + (result.error ? '\n' + String(result.error) : ''));
                options.onCommand?.({ argv: args.map(arg => sanitizeLog(arg)), elapsed_ms, timeout_ms: OFFICIAL_TEST_TIMEOUT_MS, status: result.status, signal: result.signal ?? null, error: result.error?.name ?? null, log });
                assert(result.status === 0 && !result.error && !result.signal, 'Official test batch failed: ' + file + '; see ' + log);
                const summary = parseOfficialTestSummary(output, [file]);
                assert.deepEqual(officialTestInventory(directory), copied, 'Official tests changed their source copy');
                batches.push({ index, test_files: [file], test_hashes: { [file]: inventory.source_files[file]! }, copied_source_sha256: copied.source_sha256,
                    host_sha256: copied.host_sha256, ...summary, timeout_ms: OFFICIAL_TEST_TIMEOUT_MS, elapsed_ms, log, log_sha256: sha256(fs.readFileSync(join(options.logs, log))) });
            } finally { removeTree(directory); assert(!fs.existsSync(directory), 'Official batch copy was not removed'); }
        }
        assert.deepEqual(officialTestInventory(source), inventory, 'Official source changed during acceptance');
        const totals = batches.reduce<OfficialTestSummary>((sum, batch) => ({ files: sum.files + batch.files, tests: sum.tests + batch.tests, pass: sum.pass + batch.pass, fail: sum.fail + batch.fail, skip: sum.skip + batch.skip }), { files: 0, tests: 0, pass: 0, fail: 0, skip: 0 });
        const receipt: OfficialTestReceipt = { schema_version: 1, kind: 'official-mod-test-batches', status: 'pass', ...inventory, timeout_ms: OFFICIAL_TEST_TIMEOUT_MS, batches, totals };
        verifyOfficialTestBatches(receipt, inventory.source_files);
        return receipt;
    } finally { removeTree(temporary); assert(!fs.existsSync(temporary), 'Official test workspace was not removed'); }
}
