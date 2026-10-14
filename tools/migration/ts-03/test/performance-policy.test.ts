import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../common.js';
import { evaluate, type Batch, type Policy } from '../performance/policy.js';
const policy = JSON.parse(readFileSync(join(repoRoot, 'tools/migration/ts-02/policy.json'), 'utf8')) as Policy;
function sample(p50: number, p95 = p50, peak_rss = 16 * 1048576): Batch { return { samples: [], p50, p95, peak_rss }; }
test('D06 equality at command/in-process floors and RSS limit passes without relaxing ratios', () => {
    for (const [kind, baseline, candidate] of [
        ['command', sample(10, 20), sample(15, 30, 48 * 1048576)],
        ['command', sample(1000, 1000), sample(1100, 1150)],
        ['in_process', sample(0, 0), sample(.1, .2)],
    ] as const)
        assert.ok(evaluate(Array.from({ length: 3 }, () => ({ baseline, candidate })), kind, policy).every(metric => metric.state === 'pass'));
});
test('D06 all-round stable excess fails; mixed/noisy excess stays inconclusive', () => {
    const stable = Array.from({ length: 3 }, () => ({ baseline: sample(100), candidate: sample(150, 150, 49 * 1048576) }));
    assert.ok(evaluate(stable, 'command', policy).every(metric => metric.state === 'fail'));
    const mixed = stable.map((row, i) => i ? { baseline: row.baseline, candidate: row.baseline } : row);
    assert.ok(evaluate(mixed, 'command', policy).every(metric => metric.state === 'inconclusive'));
    const noisy = [100, 10000, 20000].map(value => ({ baseline: sample(value), candidate: sample(value * 1.2) }));
    assert.equal(evaluate(noisy, 'command', policy)[0]!.state, 'inconclusive');
    assert.throws(() => evaluate(stable.slice(0, 2), 'command', policy), /Incomplete/u);
});
