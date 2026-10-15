import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { reserve, settle } from '../budget.js';
import { isolatedHostEnvironment } from '../mod-types.js';
function fixture(t: {
    after: (f: () => void) => void;
}) { const directory = fs.mkdtempSync(join(tmpdir(), 'budget-test-')), path = join(directory, 'budget.json'); fs.writeFileSync(path, JSON.stringify({ authorized_total_usd: 10, attempts: [] })); t.after(() => fs.rmSync(directory, { recursive: true, force: true })); return path; }
test('tests.integration.test_live_budget.LiveBudgetTests.test_unknown_costs_and_concurrent_reservations_retain_shared_cap', t => {
    const path = fixture(t), a = reserve(path, 'a', 6), b = reserve(path, 'b', 4);
    assert.throws(() => reserve(path, 'retry', .01));
    assert.equal(settle(path, a, null), 10);
    assert.equal(settle(path, b, 0), 6);
    assert.throws(() => reserve(path, 'retry', 4));
    assert.equal(settle(path, a, 0), 6);
});
test('tests.integration.test_live_budget.LiveBudgetTests.test_zero_and_known_costs_release_only_unused_reservations', t => {
    const path = fixture(t), a = reserve(path, 'a', 2);
    assert.equal(settle(path, a, .125), .125);
    const b = reserve(path, 'b', 1);
    assert.equal(settle(path, b, NaN), 1.125);
    for (const value of [true, -1, Infinity, 11])
        assert.throws(() => reserve(path, 'invalid', value as number));
});
test('Mod type preparation cannot inherit model credentials or an active user configuration', () => {
    const env = isolatedHostEnvironment({ PATH: '/tools', ANTHROPIC_API_KEY: 'private', AWS_SECRET_ACCESS_KEY: 'private', CLAUDE_CONFIG_DIR: '/user', CLAUDECODE: 'active', GOOGLE_API_KEY: 'private' }, '/isolated');
    assert.equal(env.PATH, '/tools');
    assert.equal(env.CLAUDE_CONFIG_DIR, '/isolated');
    assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
    assert.equal(env.GOOGLE_API_KEY, undefined);
    assert.equal(env.CLAUDECODE, undefined);
    assert.equal(env.ANTHROPIC_BASE_URL, 'http://127.0.0.1:9');
    assert.notEqual(env.ANTHROPIC_API_KEY, 'private');
});
