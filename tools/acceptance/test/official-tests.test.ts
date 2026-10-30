import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { readTar, sha256 } from '../../build/files.js';
import { repoRoot } from '../../migration/ts-03/common.js';
import { officialTestInventory, parseOfficialTestSummary, runOfficialTestBatches, verifyOfficialTestBatches, OFFICIAL_TEST_TIMEOUT_MS, type OfficialTestOptions, type OfficialTestReceipt } from '../official-tests.js';

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

test('official batches preserve source and supporting files while executing a complete disjoint inventory', t => {
    const f = fixture(t), inventory = officialTestInventory(f.source), seen: string[] = [];
    const receipt = runOfficialTestBatches(f.options, (executable, args, options) => {
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

test('capacity batches require their explicit original budget and keep distinct logs for literal source paths', t => {
    const f = fixture(t), source = join(f.root, 'capacity source 中文');
    fs.renameSync(f.source, source);
    const inventory = officialTestInventory(source), phases: number[] = [];
    const receipt = runOfficialTestBatches({ ...f.options, source, timeoutMs: 300_000, logPrefix: 'native-capacity',
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
    assert.throws(() => runOfficialTestBatches({ ...f.options, source, timeoutMs: 300_001 as 300_000 }), /Unsupported/u);
    assert.throws(() => runOfficialTestBatches({ ...f.options, source, logPrefix: '../outside' }), /log prefix/u);
    assert(!fs.existsSync(f.temporary));
});

test('official command failures and timeouts retain logs after removing their disposable copies', t => {
    for (const timeout of [false, true]) {
        const f = fixture(t);
        assert.throws(() => runOfficialTestBatches(f.options, () => ({ status: timeout ? null : 1,
            stdout: 'partial diagnostic\n', stderr: 'host failure\n', ...(timeout ? { error: new Error('ETIMEDOUT') } : {}) })), /batch failed/u);
        assert(!fs.existsSync(f.temporary));
        const log = fs.readFileSync(join(f.logs, 'statusline-native-batch-0001.log'), 'utf8');
        assert.match(log, /partial diagnostic/u); assert.match(log, /host failure/u);
        if (timeout) assert.match(log, /ETIMEDOUT/u);
        assert.equal(officialTestInventory(f.source).test_files.length, 2);
    }
});

test('official copy mutation and successful commands without a complete summary block acceptance', t => {
    for (const change of [false, true]) {
        const f = fixture(t);
        assert.throws(() => runOfficialTestBatches(f.options, (_executable, args) => {
            const directory = args.at(-1)!, file = officialTestInventory(directory).test_files[0]!;
            if (change) fs.writeFileSync(join(directory, 'lib/source.ts'), 'altered support');
            return { status: 0, stdout: change ? summary(file) : 'test child exited without results' };
        }), change ? /source copy/u : /summary/u);
        assert(!fs.existsSync(f.temporary)); assert(fs.existsSync(join(f.logs, 'statusline-native-batch-0001.log')));
        assert.equal(fs.readFileSync(join(f.source, 'lib/source.ts'), 'utf8'), 'export const value = 7;');
    }
});
