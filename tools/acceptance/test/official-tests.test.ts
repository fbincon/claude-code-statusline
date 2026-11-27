import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { processAlive, processToken } from '@fbincon/statusline-platform/processes';
import { readTar, sha256 } from '../../build/files.js';
import { repoRoot } from '../../migration/ts-03/common.js';
import { officialModTestJobs, officialTestInventory, parseOfficialTestSummary, runOfficialTestBatches,
    verifyOfficialTestBatches, OFFICIAL_TEST_TIMEOUT_MS, type OfficialTestOptions, type OfficialTestReceipt } from '../official-tests.js';
import { runOfficialTestCommand } from '../official-tests/command.js';

const summary = (path: string, count = 2) => path + ':\n' + Array.from({ length: count }, (_, index) => '(pass) case ' + index + ' [1ms]\n').join('') + `\n ${count} pass\n 0 fail\nRan ${count} tests across 1 file. [0.1s]\n`;

test('official Mod source inventories match Git archive bytes in an autocrlf checkout', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'official-git-bytes-')), repository = join(root, 'repository'), checkout = join(root, 'checkout'), hooks = join(root, 'empty-hooks');
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    for (const path of [repository, checkout, hooks]) fs.mkdirSync(path);
    const git = (...args: string[]) => execFileSync('git', ['-C', repository, '-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false',
        '-c', 'core.hooksPath=' + hooks, '-c', 'commit.gpgsign=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    git('init', '--quiet');
    fs.copyFileSync(join(repoRoot, '.gitattributes'), join(repository, '.gitattributes'));
    const names = ['statusline-native', 'statusline-runtime'];
    const original: Record<string, Record<string, string>> = {};
    for (const name of names) {
        const source = join(repoRoot, 'mods', name);
        original[name] = officialTestInventory(source).source_files;
        for (const path of Object.keys(original[name]!)) {
            const target = join(repository, 'mods', name, path); fs.mkdirSync(join(target, '..'), { recursive: true });
            fs.copyFileSync(join(source, path), target);
        }
    }
    fs.writeFileSync(join(repository, 'autocrlf-control.txt'), 'conversion is active\n');
    const binary = Buffer.from([0, 255, 13, 10, 0, 10]);
    fs.writeFileSync(join(repository, 'control.bin'), binary);
    git('add', '--all'); git('commit', '--quiet', '-m', 'Record exact Mod test inputs');
    const archive = join(root, 'source.tar'); git('archive', '--format=tar', '--output=' + archive, 'HEAD');
    git('-c', 'core.autocrlf=true', 'checkout-index', '--all', '--prefix=' + checkout.replaceAll('\\', '/') + '/');
    const entries = readTar(archive, '');
    // Demonstrate that this is a real CRLF-producing checkout, not a normalized receipt.
    assert.equal(fs.readFileSync(join(checkout, 'autocrlf-control.txt'), 'utf8'), 'conversion is active\r\n');
    assert.deepEqual(fs.readFileSync(join(checkout, 'control.bin')), binary);
    for (const name of names) {
        const prefix = 'mods/' + name + '/';
        const expected = Object.fromEntries([...entries].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), sha256(bytes)]));
        assert.deepEqual(expected, original[name], name + ' archive omitted or changed an input');
        assert.deepEqual(officialTestInventory(join(checkout, 'mods', name)).source_files, expected, name + ' checkout bytes differ from its archive');
        assert(!fs.readFileSync(join(checkout, 'mods', name, 'hooks/hooks.json')).includes(Buffer.from('\r\n')));
    }
});

function fixture(t: test.TestContext) {
    const root = fs.mkdtempSync(join(tmpdir(), 'official-batch-test-')), source = join(root, 'statusline-native'), logs = join(root, 'logs'), temporary = join(root, 'copies');
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    const put = (path: string, content: string) => { const target = join(source, path); fs.mkdirSync(join(target, '..'), { recursive: true }); fs.writeFileSync(target, content); };
    put('.claude-plugin/plugin.json', '{"name":"statusline-native"}');
    put('.claude-plugin/types/host-version.ts', 'export const HOST_VERSION = "2.1.310";');
    put('hooks/hooks.json', '{"modules":["./register.ts"]}'); put('hooks/register.ts', 'export {};');
    put('lib/source.ts', 'export const value = 7;'); put('tests/helper.ts', 'export const fixture = true;');
    put('node_modules/development/ignored.test.ts', 'not Mod source');
    for (const file of ['tests/a.test.ts', 'tests/nested/b.test.ts']) put(file, "test('kept', () => {});");
    const options: OfficialTestOptions = { source, temporary, logs, host: { executable: 'test-host', args: ['literal argument'] }, env: {}, cwd: root };
    return { root, source, temporary, logs, options, put };
}

test('official batches preserve source and supporting files while executing a complete disjoint inventory', async t => {
    const f = fixture(t), inventory = officialTestInventory(f.source), seen: string[] = [];
    const receipt = await runOfficialTestBatches(f.options, (executable, args, options) => {
        assert.equal(executable, 'test-host'); assert.deepEqual(args.slice(0, 3), ['literal argument', 'plugin', 'test']);
        assert.equal(options.timeout, OFFICIAL_TEST_TIMEOUT_MS);
        const copy = args.at(-1)!, actual = officialTestInventory(copy), file = actual.test_files[0]!;
        assert.equal(actual.test_files.length, 1); seen.push(file);
        assert.equal(fs.readFileSync(join(copy, 'lib/source.ts'), 'utf8'), 'export const value = 7;');
        assert.deepEqual(actual.host_files, inventory.host_files);
        assert.equal(fs.readFileSync(join(copy, 'hooks/hooks.json'), 'utf8'), fs.readFileSync(join(f.source, 'hooks/hooks.json'), 'utf8'));
        assert.equal(fs.readFileSync(join(copy, 'tests/helper.ts'), 'utf8'), 'export const fixture = true;');
        assert(!fs.existsSync(join(copy, 'node_modules')), 'Development dependencies must not enter the sandbox copy');
        return { status: 0, stderr: summary(file) };
    });
    assert.deepEqual(seen, inventory.test_files); assert.deepEqual(officialTestInventory(f.source), inventory);
    assert(!fs.existsSync(f.temporary)); assert.deepEqual(receipt.totals, { files: 2, tests: 4, pass: 4, fail: 0, skip: 0 });
    assert.equal(receipt.batches.length, 2);
    for (const batch of receipt.batches) assert.match(fs.readFileSync(join(f.logs, batch.log), 'utf8'), /0 fail/u);
    verifyOfficialTestBatches(receipt, inventory.source_files);
    await assert.rejects(runOfficialTestBatches(f.options, () => { throw new Error('Unexpected rerun'); }), /EEXIST/u);
    for (const batch of receipt.batches) assert.equal(sha256(fs.readFileSync(join(f.logs, batch.log))), batch.log_sha256);
    const historical = structuredClone(receipt);
    delete historical.concurrency;
    delete historical.elapsed_ms;
    verifyOfficialTestBatches(historical, inventory.source_files);
    const tamper: ((value: OfficialTestReceipt) => void)[] = [
        value => { value.batches.pop(); },
        value => { value.batches.push(value.batches[0]!); },
        value => { value.batches[1]!.test_files = value.batches[0]!.test_files; },
        value => { value.source_files['lib/source.ts'] = 'a'.repeat(64); },
        value => { delete value.source_files['tests/a.test.ts']; },
        value => { value.batches[0]!.test_hashes['tests/a.test.ts'] = 'a'.repeat(64); },
        value => { value.batches[0]!.copied_source_sha256 = 'a'.repeat(64); },
        value => { value.batches[0]!.timeout_ms++; },
        value => { value.batches[0]!.skip = 1; },
        value => { value.totals.tests++; },
        value => { value.batches[1]!.log = value.batches[0]!.log; },
    ];
    for (const mutate of tamper) { const changed = structuredClone(receipt); mutate(changed); assert.throws(() => verifyOfficialTestBatches(changed, inventory.source_files)); }
    f.put('tests/nested/b.test.ts', 'changed source');
    assert.throws(() => verifyOfficialTestBatches(receipt, officialTestInventory(f.source).source_files), /source files changed/u);
});

test('official summaries require real pass lines, exact executed files and zero skips or failures', () => {
    const valid = summary('tests/a.test.ts');
    assert.deepEqual(parseOfficialTestSummary(valid, ['tests/a.test.ts']), { tests: 2, files: 1, pass: 2, fail: 0, skip: 0 });
    const invalid = [
        '', valid.replace(' 0 fail', ' 1 fail'), valid + '\n 1 skip\n', valid.replace('(pass)', '(skip)'),
        valid.replace('2 pass', '3 pass'), valid.replace('across 1 file', 'across 2 files'),
        valid.replace('tests/a.test.ts:', 'tests/b.test.ts:'), valid + '\ntests/b.test.ts:\n', valid + valid,
        valid.replace('Ran 2 tests across 1 file. [0.1s]', ''), valid + '\n 1 error\n',
    ];
    for (const output of invalid) assert.throws(() => parseOfficialTestSummary(output, ['tests/a.test.ts']));
});

test('capacity batches require their explicit original budget and keep distinct logs for literal source paths', async t => {
    const f = fixture(t), source = join(f.root, 'capacity source 中文');
    fs.renameSync(f.source, source);
    const inventory = officialTestInventory(source), phases: number[] = [];
    const receipt = await runOfficialTestBatches({ ...f.options, source, timeoutMs: 300_000, logPrefix: 'native-capacity',
        onCommand: phase => phases.push(phase.timeout_ms) }, (_executable, args, options) => {
        assert.equal(options.timeout, 300_000);
        return { status: 0, stdout: summary(officialTestInventory(args.at(-1)!).test_files[0]!) };
    });
    assert.deepEqual(phases, [300_000, 300_000]);
    assert.equal(receipt.timeout_ms, 300_000);
    assert(receipt.batches.every(batch => batch.timeout_ms === 300_000 && batch.log.startsWith('native-capacity-batch-')));
    verifyOfficialTestBatches(receipt, inventory.source_files, 300_000);
    assert.throws(() => verifyOfficialTestBatches(receipt, inventory.source_files), /300000.*180000|180000.*300000/su);
    const changed = structuredClone(receipt); changed.batches[0]!.timeout_ms = 180_000;
    assert.throws(() => verifyOfficialTestBatches(changed, inventory.source_files, 300_000));
    assert.throws(() => verifyOfficialTestBatches(receipt, inventory.source_files, 300_001 as 300_000), /Unsupported/u);
    await assert.rejects(runOfficialTestBatches({ ...f.options, source, timeoutMs: 300_001 as 300_000 }), /Unsupported/u);
    await assert.rejects(runOfficialTestBatches({ ...f.options, source, logPrefix: '../outside' }), /log prefix/u);
    assert(!fs.existsSync(f.temporary));
});

test('official command failures and timeouts retain logs after removing their disposable copies', async t => {
    for (const timeout of [false, true]) {
        const f = fixture(t);
        await assert.rejects(runOfficialTestBatches(f.options, () => ({ status: timeout ? null : 1,
            stdout: 'partial diagnostic\n', stderr: 'host failure\n', ...(timeout ? { error: new Error('ETIMEDOUT') } : {}) })), /batch failed/u);
        assert(!fs.existsSync(f.temporary));
        const log = fs.readFileSync(join(f.logs, 'statusline-native-batch-0001.log'), 'utf8');
        assert.match(log, /partial diagnostic/u); assert.match(log, /host failure/u);
        if (timeout) assert.match(log, /ETIMEDOUT/u);
        assert.equal(officialTestInventory(f.source).test_files.length, 2);
    }
});

test('official copy mutation and successful commands without a complete summary block acceptance', async t => {
    for (const change of [false, true]) {
        const f = fixture(t);
        await assert.rejects(runOfficialTestBatches(f.options, (_executable, args) => {
            const directory = args.at(-1)!, file = officialTestInventory(directory).test_files[0]!;
            if (change) fs.writeFileSync(join(directory, 'lib/source.ts'), 'altered support');
            return { status: 0, stdout: change ? summary(file) : 'test child exited without results' };
        }), change ? /source copy/u : /summary/u);
        assert(!fs.existsSync(f.temporary)); assert(fs.existsSync(join(f.logs, 'statusline-native-batch-0001.log')));
        assert.equal(fs.readFileSync(join(f.source, 'lib/source.ts'), 'utf8'), 'export const value = 7;');
    }
    const f = fixture(t), noise = 'x'.repeat(600_000) + '\n';
    await assert.rejects(runOfficialTestBatches(f.options, (_executable, args) => {
        const file = officialTestInventory(args.at(-1)!).test_files[0]!;
        return { status: 0, stdout: noise + summary(file) + noise };
    }), /summary/u);
    assert.match(fs.readFileSync(join(f.logs, 'statusline-native-batch-0001.log'), 'utf8'), /output truncated/u);
});

test('parallel official batches honor local limits, isolate config and publish in immutable order', async t => {
    assert.equal(officialModTestJobs({}), 4);
    for (const value of ['0', '9', '-1', '4.0', '2x', '', ' 4', '1\n']) {
        assert.throws(() => officialModTestJobs({ STATUSLINE_MOD_TEST_JOBS: value }), /1 to 8/u);
    }
    for (const limit of [1, 4, 6, 8]) {
        const f = fixture(t), requested = limit === 4 ? {} : { STATUSLINE_MOD_TEST_JOBS: String(limit) };
        for (const name of ['bb', 'c', 'd', 'e', 'f']) f.put('tests/' + name + '.test.ts', '// Same source inventory');
        const files = officialTestInventory(f.source).test_files, configs = new Set<string>();
        const entered: string[] = [], finished: string[] = [];
        const pending = new Map<string, () => void>();
        const result = runOfficialTestBatches({ ...f.options, env: requested }, async (_executable, args, command) => {
            const copy = args.at(-1)!, file = officialTestInventory(copy).test_files[0]!, config = command.env.CLAUDE_CONFIG_DIR!;
            assert(!config.startsWith(copy + '/')); assert(!configs.has(config));
            configs.add(config);
            assert.deepEqual(fs.readdirSync(config), []);
            fs.writeFileSync(join(config, 'settings.json'), file);
            assert.equal(command.timeout, OFFICIAL_TEST_TIMEOUT_MS); entered.push(file);
            await new Promise<void>(resolve => pending.set(file, resolve));
            assert.equal(fs.readFileSync(join(config, 'settings.json'), 'utf8'), file);
            finished.push(file);
            return { status: 0, stdout: summary(file) };
        });
        assert.deepEqual(entered, files.slice(0, limit));
        while (pending.size) {
            const [file, release] = [...pending.entries()].at(-1)!;
            pending.delete(file); release();
            await new Promise<void>(resolve => setImmediate(resolve));
            assert(pending.size <= limit);
        }
        const receipt = await result;
        assert.deepEqual(receipt.concurrency, { limit, peak: Math.min(limit, files.length) });
        assert(Number.isFinite(receipt.elapsed_ms)); assert(receipt.batches.every(batch => batch.elapsed_ms <= receipt.elapsed_ms!));
        assert.deepEqual(entered, files); assert.deepEqual(receipt.batches.flatMap(batch => batch.test_files), files);
        if (limit > 1) assert.notDeepEqual(finished, files, 'Out-of-order completion must not reorder evidence');
        assert.equal(configs.size, files.length); assert(!fs.existsSync(f.temporary));
        for (const batch of receipt.batches) assert.equal(sha256(fs.readFileSync(join(f.logs, batch.log))), batch.log_sha256);
        verifyOfficialTestBatches(receipt, officialTestInventory(f.source).source_files);
        const altered = structuredClone(receipt);
        altered.concurrency!.peak = limit + 1;
        assert.throws(() => verifyOfficialTestBatches(altered, receipt.source_files), /concurrency/u);
        for (const duration of [-1, Infinity, 0]) {
            assert.throws(() => verifyOfficialTestBatches({ ...receipt, elapsed_ms: duration }, receipt.source_files), /duration/u);
        }
    }
});

test('a synchronous first-file failure closes admission before the remaining official workers start', async t => {
    const f = fixture(t);
    f.put('tests/b.test.ts', '// Queued'); f.put('tests/c.test.ts', '// Queued');
    const started: string[] = [];
    await assert.rejects(runOfficialTestBatches({ ...f.options, env: { STATUSLINE_MOD_TEST_JOBS: '4' } }, (_executable, args) => {
        started.push(officialTestInventory(args.at(-1)!).test_files[0]!);
        return { status: 1, stderr: 'synchronous first-file failure' };
    }), /batch failed: tests\/a\.test\.ts/u);
    assert.deepEqual(started, ['tests/a.test.ts']);
    assert.deepEqual(fs.readdirSync(f.logs), ['statusline-native-batch-0001.log']);
    assert(!fs.existsSync(f.temporary));
});

test('a failed official lane stops new files and retains every admitted log before cleanup', async t => {
    const f = fixture(t);
    f.put('tests/b.test.ts', '// Fails');
    f.put('tests/c.test.ts', '// Must remain queued');
    let release!: () => void, markFailure!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const failed = new Promise<void>(resolve => { markFailure = resolve; });
    const started: string[] = [];
    const result = runOfficialTestBatches({ ...f.options, env: { STATUSLINE_MOD_TEST_JOBS: '2' },
        onCommand(phase) { if (phase.status !== 0) markFailure(); } }, async (_executable, args) => {
        const file = officialTestInventory(args.at(-1)!).test_files[0]!;
        started.push(file);
        if (file === 'tests/b.test.ts') return { status: 1, stderr: 'deliberate second-file failure' };
        await held;
        return { status: 0, stdout: summary(file) };
    });
    await failed;
    assert.deepEqual(started, ['tests/a.test.ts', 'tests/b.test.ts']);
    assert(fs.existsSync(join(f.temporary, 'batch-0001')));
    release(); await assert.rejects(result, /batch failed: tests\/b\.test\.ts/u);
    assert.deepEqual(started, ['tests/a.test.ts', 'tests/b.test.ts']);
    assert.deepEqual(fs.readdirSync(f.logs).sort(), ['statusline-native-batch-0001.log', 'statusline-native-batch-0002.log']);
    assert.match(fs.readFileSync(join(f.logs, 'statusline-native-batch-0002.log'), 'utf8'), /deliberate/u);
    assert(!fs.existsSync(f.temporary));
});

test('official file supervisors preserve literal argv, bound both output streams and terminate the owned tree', async t => {
    const f = fixture(t), options = { cwd: f.root, env: process.env, timeout: 12_000, encoding: 'utf8' as const, maxBuffer: 8 * 1024 * 1024 };
    const literal = '空 白 & (literal) $x';
    const success = await runOfficialTestCommand(process.execPath, ['-e',
        'process.stdout.write(process.argv[1]);process.stderr.write("x".repeat(1_200_000));', literal], options);
    assert.equal(success.status, 0); assert.equal(success.stdout, literal); assert.equal(success.stderr?.length, 1_200_000);
    const limited = await runOfficialTestCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(300));'], { ...options, maxBuffer: 128 });
    assert.match(String(limited.error), /output exceeded/u); assert.equal(limited.stdout?.length, 128);
    const timedOut = await runOfficialTestCommand(process.execPath, ['-e', 'setInterval(()=>{}, 5000);'], { ...options, timeout: 250 });
    assert.match(String(timedOut.error), /timeout/u);

    const signal = new AbortController(), pidFile = join(f.root, 'grandchild.pid');
    const child = 'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(()=>{}, 5000);';
    const host = 'process.stdout.write("started");require("node:child_process").spawn(process.execPath,["-e",process.argv[1],process.argv[2]],{stdio:"ignore"});setInterval(()=>{},5000);';
    const running = runOfficialTestCommand(process.execPath, ['-e', host, child, pidFile], { ...options, signal: signal.signal });
    try {
        const deadline = performance.now() + 10_000;
        while (!fs.existsSync(pidFile) && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
        assert(fs.existsSync(pidFile), 'Fake official host must start its descendant');
        const pid = Number(fs.readFileSync(pidFile, 'utf8')), token = processToken(pid);
        assert(token); assert.equal(processAlive(pid, token), true);
        signal.abort();
        const aborted = await running;
        assert.match(String(aborted.error), /cancelled/u); assert.equal(aborted.stdout, 'started');
        const stopped = performance.now() + 5000;
        while (processAlive(pid, token) !== false && performance.now() < stopped) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(processAlive(pid, token), false, 'The host test process tree must exit before another group can execute');
    } finally { signal.abort(); await running; }
});
