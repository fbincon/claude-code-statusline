/** Deterministic Actions observation. Read only; never reruns, cancels or merges. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
export const CI_REPOSITORY = 'fbincon/claude-code-statusline';
export async function githubRead(path: string): Promise<any> {
    assert(path.startsWith(`repos/${CI_REPOSITORY}/`), 'Unexpected repository API path');
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!token) return JSON.parse(execFileSync('gh', ['api', '--hostname', 'github.com', path], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }));
    const response = await fetch('https://api.github.com/' + path, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'statusline-ci-evidence' }, signal: AbortSignal.timeout(30000) });
    assert(response.ok, `GitHub read failed: HTTP ${response.status}`);
    return response.json();
}
export function summarizeJobs(jobs: any[]) {
    const seconds = (end: string, start: string) => Math.max(0, (Date.parse(end) - Date.parse(start)) / 1000);
    return jobs.map(job => ({ id: job.id, name: job.name, attempt: job.run_attempt, status: job.status, conclusion: job.conclusion,
        queue_seconds: job.started_at && job.created_at ? seconds(job.started_at, job.created_at) : null,
        execution_seconds: job.completed_at && job.started_at ? seconds(job.completed_at, job.started_at) : null,
        steps: (job.steps ?? []).map((step: any) => ({ name: step.name, conclusion: step.conclusion,
            execution_seconds: step.completed_at && step.started_at ? seconds(step.completed_at, step.started_at) : null })) }));
}
export async function collectRun(runId: number, head: string) {
    const prefix = `repos/${CI_REPOSITORY}/actions/runs/${runId}`, run = await githubRead(prefix);
    assert.equal(run.head_sha, head, 'CI run belongs to another head');
    assert.equal(run.repository?.full_name, CI_REPOSITORY, 'CI run belongs to another repository');
    assert.equal(run.path, '.github/workflows/ci.yml', 'Unexpected CI workflow');
    const jobs: any[] = [];
    for (let page = 1; page <= 20; page++) {
        const result = await githubRead(`${prefix}/jobs?filter=all&per_page=100&page=${page}`);
        jobs.push(...result.jobs);
        if (jobs.length >= result.total_count) return { schema_version: 1, run_id: runId, head, event: run.event, attempt: run.run_attempt, status: run.status, conclusion: run.conclusion, created_at: run.created_at, updated_at: run.updated_at, jobs: summarizeJobs(jobs) };
    }
    throw new Error('Job pagination limit exceeded');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { run: { type: 'string' }, head: { type: 'string' }, report: { type: 'string' }, watch: { type: 'boolean' }, 'timeout-minutes': { type: 'string', default: '120' } } });
    assert(/^\d+$/u.test(values.run ?? '') && /^[a-f0-9]{40}$/u.test(values.head ?? ''), 'Require --run ID --head FULL_SHA');
    const minutes = Number(values['timeout-minutes']); assert(Number.isFinite(minutes) && minutes > 0 && minutes <= 360);
    const deadline = Date.now() + minutes * 60000; let previous = '', polls = 0, failures = 0;
    while (true) {
        try {
            // Poll only the run until completion; download all job details once.
            const run = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${values.run}`);
            assert.equal(run.head_sha, values.head, 'CI run belongs to another head');
            assert.equal(run.repository?.full_name, CI_REPOSITORY);
            assert.equal(run.path, '.github/workflows/ci.yml');
            failures = 0;
            const state = JSON.stringify({ run: run.id, head: run.head_sha, attempt: run.run_attempt, status: run.status, conclusion: run.conclusion });
            if (state !== previous) { console.log(state); previous = state; }
            if (run.status === 'completed' || !values.watch) {
                const report = await collectRun(Number(values.run), values.head!);
                if (values.report) { const path = resolve(values.report); fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, JSON.stringify(report, null, 2) + '\n'); }
                console.log(JSON.stringify({ jobs: report.jobs.length, failed: report.jobs.filter(job => job.conclusion === 'failure').map(job => ({ name: job.name, attempt: job.attempt })) }));
                process.exitCode = run.status !== 'completed' ? 2 : run.conclusion === 'success' ? 0 : 1; break;
            }
        } catch (error) {
            // An identity/assertion failure is never transient.
            if (error instanceof assert.AssertionError || ++failures >= 3) throw error;
            console.error('CI observation temporarily unavailable; retrying (' + failures + '/3)');
        }
        if (Date.now() >= deadline) { console.error('Observation deadline reached; CI was not cancelled.'); process.exitCode = 2; break; }
        await new Promise(resolve => setTimeout(resolve, Math.min(60000, 15000 * 2 ** Math.min(polls++, 2))));
    }
}
