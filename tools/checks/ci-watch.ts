/** Deterministic Actions observation. Read only; never reruns, cancels or merges. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { isTransient, responseError, retryRead } from './ci-transfer-policy.ts';
export const CI_REPOSITORY = 'fbincon/claude-code-statusline';
const exec = promisify(execFile);
/** Local observation uses the caller's existing gh authentication. Keep diagnostics
 * redacted, including signed redirects, and preserve only known transfer errors. */
export async function ghReadBytes(path: string, maxBuffer: number, signal: AbortSignal): Promise<Buffer> {
    assert(path.startsWith(`repos/${CI_REPOSITORY}/`));
    try {
        const result = await exec('gh',['api','--hostname','github.com',path],{encoding:'buffer',maxBuffer,signal});
        return result.stdout;
    } catch (error) {
        if (signal.aborted) throw signal.reason;
        const diagnostic = String((error as any).stderr ?? '');
        const status = Number(/HTTP (\d{3})/u.exec(diagnostic)?.[1]) || undefined;
        const code = /certificate|\bx509:/iu.test(diagnostic) ? 'CERTIFICATE_VERIFICATION_FAILED' :
            /TLS handshake timeout|i\/o timeout|context deadline exceeded/iu.test(diagnostic) ? 'ETIMEDOUT' :
            /connection reset by peer|ECONNRESET|:\s*(?:unexpected )?EOF\s*$|stream error: stream ID \d+; INTERNAL_ERROR/imu.test(diagnostic) ? 'ECONNRESET' : undefined;
        const reason = status ? 'HTTP ' + status : code ?? 'gh exit ' + String((error as any).code);
        throw Object.assign(new Error('GitHub read failed (' + reason + ')'), { status, code });
    }
}
export async function githubRead(path: string): Promise<any> {
    assert(path.startsWith(`repos/${CI_REPOSITORY}/`), 'Unexpected repository API path');
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    return retryRead(async signal => {
        if (!token) return JSON.parse((await ghReadBytes(path,32 * 1024 * 1024,signal)).toString('utf8'));
        const response = await fetch('https://api.github.com/' + path, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'statusline-ci-evidence' }, redirect:'error', signal });
        if (!response.ok) { await response.body?.cancel(); throw responseError(response); }
        return response.json();
    });
}
export function summarizeJobs(jobs: any[]) {
    const seconds = (end: string, start: string) => Math.max(0, (Date.parse(end) - Date.parse(start)) / 1000);
    const originals = new Map<string, { id: number; attempt: number; conclusion: string | null }>();
    return [...jobs].sort((a, b) => a.run_attempt - b.run_attempt || a.id - b.id).map(job => {
        const key = JSON.stringify([job.name, job.started_at, job.completed_at]);
        const previous = originals.get(key);
        const retained = previous && previous.attempt < job.run_attempt && previous.conclusion === job.conclusion &&
            (previous.id === job.id || Date.parse(job.created_at) > Date.parse(job.completed_at));
        const reused = retained ? previous.id : undefined;
        if (job.completed_at && reused === undefined) originals.set(key,{id:job.id,attempt:job.run_attempt,conclusion:job.conclusion});
        return { id: job.id, name: job.name, attempt: job.run_attempt, status: job.status, conclusion: job.conclusion,
        fresh_execution: reused === undefined, reused_from_job_id: reused ?? null,
        queue_seconds: job.started_at && job.created_at ? seconds(job.started_at, job.created_at) : null,
        execution_seconds: job.completed_at && job.started_at ? seconds(job.completed_at, job.started_at) : null,
        steps: (job.steps ?? []).map((step: any) => ({ name: step.name, conclusion: step.conclusion,
            execution_seconds: step.completed_at && step.started_at ? seconds(step.completed_at, step.started_at) : null })) };
    });
}
export async function readJobs(runId: number, filter: 'all' | 'latest', read = githubRead): Promise<any[]> {
    assert(Number.isSafeInteger(runId) && runId > 0);
    const jobs: any[] = [];
    for (let page = 1; page <= 20; page++) {
        const result = await read(`repos/${CI_REPOSITORY}/actions/runs/${runId}/jobs?filter=${filter}&per_page=100&page=${page}`);
        assert(Array.isArray(result.jobs) && Number.isSafeInteger(result.total_count) && result.total_count >= 0);
        jobs.push(...result.jobs); if (jobs.length >= result.total_count) return jobs;
    }
    throw new Error('Job pagination limit exceeded');
}
export function jobProgress(jobs: any[]) {
    return { total: jobs.length, completed: jobs.filter(job => job.status === 'completed').length,
        skipped: jobs.filter(job => job.conclusion === 'skipped').length,
        failures: jobs.filter(job => ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'].includes(job.conclusion))
            .sort((a, b) => a.id - b.id).map(job => ({ id: job.id, name: job.name, attempt: job.run_attempt, conclusion: job.conclusion,
                steps: (job.steps ?? []).filter((step: any) => step.conclusion === 'failure').map((step: any) => step.name) })) };
}
export function attemptCosts(jobs: ReturnType<typeof summarizeJobs>) {
    const attempts = [...new Set(jobs.map(job => job.attempt))].sort((a,b) => a-b);
    return attempts.map(attempt => {
        const active = jobs.filter(job => job.attempt === attempt && job.conclusion !== 'skipped');
        const fresh = active.filter(job => job.fresh_execution);
        return { attempt, fresh_jobs: fresh.length, retained_jobs: active.length - fresh.length,
            completed_runner_seconds: fresh.reduce((sum,job) => sum + (job.execution_seconds ?? 0),0),
            known_queue_seconds: fresh.reduce((sum,job) => sum + (job.queue_seconds ?? 0),0),
            longest_queue_seconds: Math.max(0,...fresh.map(job => job.queue_seconds ?? 0)) };
    });
}
export async function collectRun(runId: number, head: string, read = githubRead) {
    const path = `repos/${CI_REPOSITORY}/actions/runs/${runId}`;
    let before = await read(path);
    for (let sample = 0; sample < 3; sample++) {
        const jobs = summarizeJobs(await readJobs(runId, 'all',read)), run = await read(path);
        assert.equal(run.head_sha, head, 'CI run belongs to another head');
        assert.equal(run.repository?.full_name, CI_REPOSITORY, 'CI run belongs to another repository');
        assert.equal(run.path, '.github/workflows/ci.yml', 'Unexpected CI workflow');
        if (before.run_attempt === run.run_attempt && before.status === run.status &&
            jobs.every(job => job.attempt <= run.run_attempt)) {
            return { schema_version: 1, run_id: runId, head, event: run.event, attempt: run.run_attempt, status: run.status, conclusion: run.conclusion,
                created_at: run.created_at, updated_at: run.updated_at, jobs, attempt_costs: attemptCosts(jobs) };
        }
        before = run;
    }
    throw new Error('CI attempt changed repeatedly while collecting execution times');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { run: { type: 'string' }, head: { type: 'string' }, report: { type: 'string' }, watch: { type: 'boolean' }, 'timeout-minutes': { type: 'string', default: '120' } } });
    assert(/^\d+$/u.test(values.run ?? '') && /^[a-f0-9]{40}$/u.test(values.head ?? ''), 'Require --run ID --head FULL_SHA');
    const minutes = Number(values['timeout-minutes']); assert(Number.isFinite(minutes) && minutes > 0 && minutes <= 360);
    const deadline = Date.now() + minutes * 60000; let previous = '', previousProgress = '', polls = 0, failures = 0;
    while (true) {
        try {
            // Current progress detects failures early; complete attempt history is collected once at completion.
            const run = await githubRead(`repos/${CI_REPOSITORY}/actions/runs/${values.run}`);
            assert.equal(run.head_sha, values.head, 'CI run belongs to another head');
            assert.equal(run.repository?.full_name, CI_REPOSITORY);
            assert.equal(run.path, '.github/workflows/ci.yml');
            const state = JSON.stringify({ run: run.id, head: run.head_sha, attempt: run.run_attempt, status: run.status, conclusion: run.conclusion });
            if (state !== previous) { console.log(state); previous = state; }
            if (run.status === 'completed' || !values.watch) {
                const report = await collectRun(Number(values.run), values.head!);
                // A rerun can start while historical details are being read. Never exit successfully for an older observation.
                if (report.status === 'completed' || !values.watch) {
                    if (values.report) { const path = resolve(values.report); fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, JSON.stringify(report, null, 2) + '\n'); }
                    console.log(JSON.stringify({ jobs: report.jobs.length, attempt_costs:report.attempt_costs, failed: report.jobs.filter(job => job.conclusion === 'failure').map(job => ({ name: job.name, attempt: job.attempt, steps: job.steps.filter((step: any) => step.conclusion === 'failure').map((step: any) => step.name) })) }));
                    process.exitCode = report.status !== 'completed' ? 2 : report.conclusion === 'success' ? 0 : 1; break;
                }
            } else {
                const progress = JSON.stringify({ run: run.id, attempt: run.run_attempt, progress: jobProgress(await readJobs(run.id, 'latest')) });
                if (progress !== previousProgress) { console.log(progress); previousProgress = progress; }
            }
            failures = 0;
        } catch (error) {
            // An identity/assertion failure is never transient.
            if (!isTransient(error) || ++failures >= 3) throw error;
            console.error('CI observation temporarily unavailable; retrying (' + failures + '/3)');
        }
        if (Date.now() >= deadline) { console.error('Observation deadline reached; CI was not cancelled.'); process.exitCode = 2; break; }
        await new Promise(resolve => setTimeout(resolve, Math.min(60000, 15000 * 2 ** Math.min(polls++, 2))));
    }
}
