import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeJobs, readJobs, jobProgress } from '../ci-watch.js';
test('CI timings distinguish queue, execution, steps and original attempts', () => {
    const result = summarizeJobs([{ id: 1, name: 'case', run_attempt: 1, status: 'completed', conclusion: 'failure', created_at: '2026-10-26T00:00:00Z', started_at: '2026-10-26T00:03:00Z', completed_at: '2026-10-26T00:05:00Z', steps: [{ name: 'test', conclusion: 'failure', started_at: '2026-10-26T00:03:10Z', completed_at: '2026-10-26T00:04:10Z' }] }, { id: 2, name: 'case', run_attempt: 2, status: 'queued' }]);
    assert.equal(result[0]!.queue_seconds, 180); assert.equal(result[0]!.execution_seconds, 120);
    assert.equal(result[0]!.steps[0]!.execution_seconds, 60); assert.equal(result[1]!.attempt, 2);
    assert.equal(result[1]!.queue_seconds, null); assert.equal(result[1]!.execution_seconds, null);
});
test('current progress reports failures before the entire run completes, without treating skips as tests', () => {
    const failed = { id: 3, name: 'Windows', status: 'completed', conclusion: 'failure', run_attempt: 2, steps: [{ name: 'Source tests', conclusion: 'failure' }] };
    const rows = [failed, { id: 2, status: 'queued' }, { id: 1, status: 'completed', conclusion: 'skipped' }];
    const value = jobProgress(rows);
    assert.deepEqual(value, { total: 3, completed: 2, skipped: 1, failures: [{ id: 3, name: 'Windows', attempt: 2, conclusion: 'failure', steps: ['Source tests'] }] });
    assert.deepEqual(jobProgress([...rows].reverse()), value);
});
test('job observation paginates the requested attempt scope and rejects malformed responses', async () => {
    const paths: string[] = [];
    const rows = await readJobs(123, 'latest', async path => { paths.push(path); return { total_count: 2, jobs: [{ id: paths.length }] }; });
    assert.deepEqual(rows, [{ id: 1 }, { id: 2 }]); assert(paths.every(path => path.includes('filter=latest'))); assert(paths[1]!.endsWith('page=2'));
    await assert.rejects(readJobs(123, 'all', async () => ({ jobs: [], total_count: 'unknown' })));
    let calls = 0; await assert.rejects(readJobs(123, 'all', async () => { calls++; return { jobs: [], total_count: 1 }; }), /pagination/u); assert.equal(calls, 20);
});

test('retained successful jobs cloned into a retry are not counted as fresh execution', () => {
    const original = { id: 1, name: 'candidate', run_attempt: 1, conclusion: 'success', created_at: '2026-10-26T00:00:00Z', started_at: '2026-10-26T00:01:00Z', completed_at: '2026-10-26T00:02:00Z' };
    const rows = summarizeJobs([{ ...original, id: 2, run_attempt: 2, created_at: '2026-10-26T01:00:00Z' }, original]);
    assert.equal(rows[0]!.fresh_execution, true); assert.equal(rows[1]!.fresh_execution, false); assert.equal(rows[1]!.reused_from_job_id, 1);
});
