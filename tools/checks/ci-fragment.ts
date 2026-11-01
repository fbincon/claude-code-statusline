/** This physical contract is executable from an isolated, accepted Git first parent. */
import assert from 'node:assert/strict';
import type { CoveragePlan } from './ci-coverage.ts';

type Producer = CoveragePlan['producers'][number];
export interface PhysicalIdentity {
    producer_id: string; commit: string; tree: string; policy_sha256: string; tarball_sha256: string; workflow_sha: string;
    os: string; platform: string; process_arch: string; host_arch: string;
    node: string; node_sha256: string; npm: string; npm_sha256: string; host: string | null; host_sha256: string | null;
    stage: Producer['stage']; depth: Producer['depth']; obligations: string[];
    run_id: number; attempt: number; job: string; job_key: string;
}
export interface PhysicalFragment {
    schema_version: 2; kind: 'acceptance-fragment'; status: 'pass'; identity: PhysicalIdentity; report: Record<string, unknown>;
}
export interface PhysicalExecution {
    identity: PhysicalIdentity; receipt_sha256: string; artifact_id: number; job_id: number; job_name: string;
    started_at: string; completed_at: string;
}
export interface FragmentContext { tarball_sha256: string; run_id?: number; attempt?: number; workflow_sha?: string }
const SHA = /^[a-f0-9]{40}$/u, HASH = /^[a-f0-9]{64}$/u;

export function validatePhysicalIdentity(value: PhysicalIdentity, spec: Producer, plan: CoveragePlan, expected: FragmentContext): void {
    assert(value && typeof value === 'object');
    for (const hash of [value.node_sha256, value.npm_sha256, value.tarball_sha256]) assert.match(hash, HASH);
    assert.match(value.workflow_sha, SHA); assert.match(value.npm, /^\d+\.\d+\.\d+$/u);
    if (spec.host === null) assert.equal(value.host_sha256, null); else assert.match(value.host_sha256!, HASH);
    assert(Number.isSafeInteger(value.run_id) && value.run_id > 0);
    assert(Number.isSafeInteger(value.attempt) && value.attempt > 0 && value.attempt <= (expected.attempt ?? Number.MAX_SAFE_INTEGER));
    if (expected.run_id !== undefined) assert.equal(value.run_id, expected.run_id);
    if (expected.workflow_sha !== undefined) assert.equal(value.workflow_sha, expected.workflow_sha);
    const platform = spec.os.startsWith('windows-') ? 'win32' : spec.os.startsWith('macos-') ? 'darwin' : 'linux';
    assert.deepEqual(value, {
        producer_id: spec.id, commit: plan.head, tree: plan.tree, policy_sha256: plan.policy_sha256,
        tarball_sha256: expected.tarball_sha256, workflow_sha: value.workflow_sha, os: spec.os, platform,
        process_arch: spec.arch, host_arch: spec.host_arch, node: spec.node, node_sha256: value.node_sha256,
        npm: value.npm, npm_sha256: value.npm_sha256, host: spec.host, host_sha256: value.host_sha256,
        stage: spec.stage, depth: spec.depth, obligations: spec.obligations, run_id: value.run_id, attempt: value.attempt,
        job: spec.job, job_key: spec.job_key,
    }, 'Physical execution does not match the required source, runtime, host, stage or obligation');
}
export function validateFragmentIdentity(value: unknown, spec: Producer, plan: CoveragePlan, expected: FragmentContext): asserts value is PhysicalFragment {
    assert(value && typeof value === 'object' && !Array.isArray(value));
    const fragment = value as PhysicalFragment;
    assert.deepEqual(Object.keys(fragment).sort(), ['identity', 'kind', 'report', 'schema_version', 'status']);
    assert.equal(fragment.schema_version, 2); assert.equal(fragment.kind, 'acceptance-fragment'); assert.equal(fragment.status, 'pass');
    assert(fragment.report && typeof fragment.report === 'object' && !Array.isArray(fragment.report) && Object.keys(fragment.report).length > 0, 'Missing original section results');
    validatePhysicalIdentity(fragment.identity, spec, plan, expected);
}
