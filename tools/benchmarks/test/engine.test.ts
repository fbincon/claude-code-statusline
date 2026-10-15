import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { measure, runPairs, reviewRegression, verifySource } from '../engine.js';
import { createProfile } from '../../migration/ts-03/performance/fixtures.js';
test('tests.integration.test_benchmark_render.BenchmarkTests.test_setup_and_cleanup_are_outside_the_timed_region', () => { const events: string[] = []; const result = measure(() => { events.push('action'); }, 5, () => { events.push('prepare'); }, () => { events.push('cleanup'); }, () => { events.push('clock'); return events.length; }); assert.deepEqual(events, Array(5).fill(['prepare', 'clock', 'action', 'clock', 'cleanup']).flat()); assert.deepEqual(result.raw_ms, [2, 2, 2, 2, 2]); assert.equal(result.p95_ms, 2); });
test('tests.integration.test_benchmark_render.BenchmarkTests.test_comparison_runs_one_case_from_each_source_before_advancing', async () => { for (const order of [['baseline', 'candidate'], ['candidate', 'baseline']]) {
    const audit: string[] = [];
    await runPairs(['0', '1', '2'], order, async (side, name) => { audit.push(side + name); return true; });
    assert.deepEqual(audit, ['0', '1', '2'].flatMap(name => order.map(side => side + name)));
} });
test('tests.integration.test_benchmark_render.BenchmarkTests.test_comparison_flags_consistent_changes_beyond_baseline_round_noise', () => { assert.equal(reviewRegression([10, 12, 11], [15, 16, 17]), true); assert.equal(reviewRegression([10, 12, 11], [15, 16, 9]), false); });
test('tests.integration.test_benchmark_render.BenchmarkTests.test_fixture_contains_nested_agents_and_a_real_committed_repository', t => { const root = fs.mkdtempSync(join(tmpdir(), 'benchmark-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); createProfile(root, [3, 2, 4]); assert.equal(fs.readFileSync(join(root, 'history.jsonl'), 'utf8').trim().split('\n').length, 3); assert.ok(fs.existsSync(join(root, 'history/subagents/nested/agent-1.jsonl'))); assert.ok(fs.existsSync(join(root, 'project/.git/HEAD'))); });
test('tests.integration.test_benchmark_render.BenchmarkTests.test_immutable_source_verification_rejects_modified_runtime', t => { const root = fs.mkdtempSync(join(tmpdir(), 'immutable-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); fs.writeFileSync(join(root, 'runtime.js'), 'value=1'); const hashes = { 'runtime.js': createHash('sha256').update('value=1').digest('hex') }; assert.equal(verifySource(root, hashes).length, 64); fs.writeFileSync(join(root, 'runtime.js'), 'value=2'); assert.throws(() => verifySource(root, hashes), /does not match/u); });
