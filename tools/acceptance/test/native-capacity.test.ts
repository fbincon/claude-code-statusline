import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { sha256 } from '../../build/files.js';
import { repoRoot } from '../../migration/ts-03/common.js';
import { nativeCapacity, nativeCapacitySourceInventory, NATIVE_CAPACITY_TEST_FILES, NATIVE_CAPACITY_TIMEOUT_MS, NATIVE_CAPACITY_TOTAL_CASES } from '../native-capacity.js';
import { officialTestInventory, verifyOfficialTestBatches } from '../official-tests.js';

function fixture(t: test.TestContext) {
    const root = fs.mkdtempSync(join(tmpdir(), 'capacity-batches-')), destination = join(root, 'capacity source 中文'), logs = join(root, 'retained-logs');
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    return { root, destination, logs };
}

test('capacity source transformation binds exact hooks, entrypoint ranges and retained supporting files', () => {
    const hash = sha256('original source\r\n'), original = {
        '.claude-plugin/types/host-version.ts': hash, 'lib/types/declaration.ts': hash, 'node_modules/module/index.ts': hash,
        'hooks/hooks.json': hash, 'lib/production.ts': hash, 'tests/ordinary.test.ts': hash, 'tests/nested/ui.test.tsx': hash,
        'tests/helper.ts': hash, 'tests/capacity-register.ts': hash,
    }, unchanged = structuredClone(original), transformed = nativeCapacitySourceInventory(original);
    assert.deepEqual(original, unchanged);
    assert.deepEqual(Object.keys(transformed), [
        'hooks/hooks.json', 'lib/production.ts', 'tests/capacity-0.test.ts', 'tests/capacity-100.test.ts',
        'tests/capacity-150.test.ts', 'tests/capacity-200.test.ts', 'tests/capacity-250.test.ts', 'tests/capacity-300.test.ts',
        'tests/capacity-50.test.ts', 'tests/capacity-register.ts', 'tests/helper.ts',
    ]);
    assert.equal(transformed['lib/production.ts'], hash); assert.equal(transformed['tests/helper.ts'], hash);
    assert.equal(transformed['hooks/hooks.json'], sha256('{"modules":["../tests/capacity-register.ts"]}\n'));
    assert.equal(transformed['tests/capacity-0.test.ts'], sha256("import {registerCapacityCases} from './integration/capacity-cases.ts';\nregisterCapacityCases(0,50);\n"));
    assert.equal(transformed['tests/capacity-300.test.ts'], sha256("import {registerCapacityCases} from './integration/capacity-cases.ts';\nregisterCapacityCases(300,313);\n"));
    assert.equal(NATIVE_CAPACITY_TEST_FILES, 7); assert.equal(NATIVE_CAPACITY_TOTAL_CASES, 313);
});

test('capacity executes all unchanged generated files serially with exact source receipts and retained logs', t => {
    const f = fixture(t), source = join(repoRoot, 'mods/statusline-native'), original = officialTestInventory(source).source_files;
    const expected = nativeCapacitySourceInventory(original), seen: number[] = [], deadlines: number[] = [];
    let validations = 0;
    const result = nativeCapacity({ executable: 'fixture-host', args: ['literal host argument'] }, f.destination, f.logs, (_executable, args, options) => {
        deadlines.push(options.timeout); assert.equal(options.timeout, 300_000);
        assert.equal(args[0], 'literal host argument');
        assert.equal(options.env.CLAUDE_CONFIG_DIR, f.destination + '-config');
        if (args[2] === 'validate') {
            validations++; assert.deepEqual(officialTestInventory(args.at(-1)!).source_files, expected);
            return { status: 0, stdout: 'Validation passed\n' };
        }
        assert.equal(args[2], 'test');
        const copy = args.at(-1)!, inventory = officialTestInventory(copy);
        assert.equal(inventory.test_files.length, 1);
        assert(!fs.existsSync(join(copy, 'config')), 'Host configuration must stay outside source inputs');
        const file = inventory.test_files[0]!, text = fs.readFileSync(join(copy, file), 'utf8');
        const range = text.match(/^import \{registerCapacityCases\} from '\.\/integration\/capacity-cases\.ts';\nregisterCapacityCases\((\d+),(\d+)\);\n$/u);
        assert(range, 'Only the unchanged generated capacity entrypoint may run');
        const start = Number(range[1]), end = Number(range[2]);
        for (let index = start; index < end; index++) seen.push(index);
        const count = end - start;
        return { status: 0, stdout: file + ':\n' + Array.from({ length: count }, (_, index) => '(pass) capacity ' + (start + index) + ' [1ms]\n').join('') + `\n ${count} pass\n 0 fail\nRan ${count} tests across 1 file. [0.1s]\n` };
    });
    assert.equal(validations, 1); assert.equal(deadlines.length, 8);
    assert.deepEqual(seen.sort((a, b) => a - b), Array.from({ length: 313 }, (_, index) => index));
    assert.deepEqual(result.execution.totals, { files: 7, tests: 313, pass: 313, fail: 0, skip: 0 });
    verifyOfficialTestBatches(result.execution, expected, NATIVE_CAPACITY_TIMEOUT_MS);
    assert.deepEqual(officialTestInventory(source).source_files, original);
    assert.deepEqual(officialTestInventory(f.destination).source_files, expected);
    assert(!fs.existsSync(f.destination + '-batches'));
    assert.equal(result.validation.log, 'native-capacity-validate.log');
    for (const batch of result.execution.batches) {
        assert(batch.log.startsWith('native-capacity-batch-'));
        assert.equal(sha256(fs.readFileSync(join(f.logs, batch.log))), batch.log_sha256);
    }
    const omitted = { ...expected }; delete omitted['tests/capacity-300.test.ts'];
    assert.throws(() => verifyOfficialTestBatches(result.execution, omitted, NATIVE_CAPACITY_TIMEOUT_MS));
});

test('capacity validation and batch failures preserve diagnostics without relaxing command budgets', t => {
    for (const validate of [true, false]) {
        const f = fixture(t);
        assert.throws(() => nativeCapacity({ executable: 'fixture-host', args: [] }, f.destination, f.logs, (_executable, args, options) => {
            assert.equal(options.timeout, NATIVE_CAPACITY_TIMEOUT_MS);
            if (!validate && args[1] === 'validate') return { status: 0, stdout: 'Validation passed\n' };
            return { status: null, stderr: 'retained partial capacity diagnostic\n', error: new Error('ETIMEDOUT') };
        }), validate ? /capacity validation failed/u : /batch failed/u);
        const log = fs.readFileSync(join(f.logs, validate ? 'native-capacity-validate.log' : 'native-capacity-batch-0001.log'), 'utf8');
        assert.match(log, /retained partial capacity diagnostic/u); assert.match(log, /ETIMEDOUT/u);
        assert(!fs.existsSync(f.destination + '-batches'));
    }
});

test('capacity refuses reused destinations and validation logs before copying source or invoking a host', t => {
    for (const destinationExists of [true, false]) {
        const f = fixture(t), directory = destinationExists ? f.destination : f.logs;
        fs.mkdirSync(directory);
        const preserved = join(directory, destinationExists ? 'owned-marker.txt' : 'native-capacity-validate.log');
        fs.writeFileSync(preserved, 'preserve earlier evidence\n');
        let invoked = false;
        assert.throws(() => nativeCapacity({ executable: 'fixture-host', args: [] }, f.destination, f.logs, () => {
            invoked = true; throw new Error('A reused location must fail before invoking the host');
        }), destinationExists ? /fresh destination/u : /new native capacity log directory/u);
        assert.equal(invoked, false);
        assert.equal(fs.readFileSync(preserved, 'utf8'), 'preserve earlier evidence\n');
        if (!destinationExists) assert(!fs.existsSync(f.destination));
    }
});
