/** The accepted verifier can replay the small residual checks from immutable Git blobs using Node alone. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { checkAssetInputs } from './impact-assets.ts';
import { APPROVAL_REGISTRY_PATH, assessApprovalRegistry, sourceStableApproval } from '../release/approval.ts';
import type { Check } from './impact-plan.ts';
import type { CompleteEvidenceV2 } from './ci-evidence.ts';

export type ExtraCheck = 'approval' | 'assets';
/** Each entry names the original execution that already satisfies this impact check. */
export const PRODUCT_CHECKS = {
    actions: 'scope/actions-check', docs: 'development/docs-check', archive: 'development/archive-check',
    generation: 'development/generation-check-and-tests', core: 'installed/platform-source-suite',
    platform: 'installed/platform-source-suite', cli: 'installed/platform-source-suite', tui: 'installed/platform-source-suite',
    checks: 'installed/platform-source-suite', release: 'installed/platform-source-suite', build: 'installed/platform-source-suite',
    acceptance: 'installed/platform-source-suite', benchmarks: 'installed/platform-source-suite', migration: 'installed/platform-source-suite',
    packaging: 'candidate/reproducible-build-and-platform-installations', native: 'mods/exact-official-hosts', runtime: 'mods/exact-official-hosts',
} satisfies Record<Exclude<Check, ExtraCheck>, string>;

export function extraCheck(path: string): ExtraCheck | undefined {
    if (/^docs\/(?:releases\/approvals\/.*|development\/.*approval)\.json$/u.test(path)) return 'approval';
    if (/^docs\/.*\.(?:png|jpe?g|gif|webp|svg|mp4|webm|pdf|json)$/u.test(path)) return 'assets';
    return undefined;
}
export function productResponsibilities(checks: readonly Check[]) {
    return { covered: checks.filter(check => Object.hasOwn(PRODUCT_CHECKS,check)),
        additional: checks.filter((check): check is ExtraCheck => check === 'assets' || check === 'approval') };
}
const git = (...args: string[]) => execFileSync('git', ['--no-replace-objects', ...args], {
    maxBuffer: 64 * 1024 * 1024, stdio: ['ignore','pipe','pipe'] });
type Source = Pick<CompleteEvidenceV2,'source_commit'|'tree'|'event'|'pr'>;
export function supplementBoundary(record: Source): string | null {
    if (record.event === 'pull_request') {
        assert(record.pr);
        const base = git('merge-base','--all',record.pr.base,record.source_commit).toString().trim();
        assert.match(base,/^[a-f0-9]{40}$/u); return base;
    }
    assert.equal(record.event,'push');
    return git('rev-list','--parents','-n','1',record.source_commit).toString().trim().split(' ')[1] ?? null;
}
export function supplementPlan(record: Source, boundary?: string | null) {
    const minimum = supplementBoundary(record), base = boundary === undefined ? minimum : boundary;
    if (record.pr || !minimum) assert.equal(base, minimum);
    else {
        assert(base && /^[a-f0-9]{40}$/u.test(base));
        git('merge-base','--is-ancestor',base,minimum);
    }
    const names = new Set<string>();
    for (const from of new Set([minimum, base])) {
        const raw = from ? git('diff','--no-renames','--name-only','-z',from,record.source_commit,'--','docs/') :
            git('ls-tree','-rz','--name-only',record.source_commit,'--','docs/');
        for (const name of raw.toString('utf8').split('\0')) if (extraCheck(name)) names.add(name);
    }
    const paths = [...names].sort();
    return { base, paths, checks: [...new Set(paths.map(name => extraCheck(name)!))].sort() };
}
export interface ProductCheckReceipt {
    schema_version: 1; kind: 'supplemental-product-checks'; status: 'pass'; commit: string; tree: string;
    plan: ReturnType<typeof supplementPlan>; inputs_sha256: string;
    run_id: number; attempt: number; job_id: number; job: 'Complete candidate evidence'; started_at: string; completed_at: string;
}
/** Execute against the source being promoted even when this verifier is loaded from a different first parent. */
export function runProductChecks(commit: string, plan: ReturnType<typeof supplementPlan>): string {
    const index = new Map<string,string>();
    const list = git('ls-tree','-rz',commit,'--','docs/').toString('utf8').split('\0').filter(Boolean);
    for (const row of list) {
        const tab = row.indexOf('\t');
        index.set(row.slice(tab + 1),row.slice(0,tab));
    }
    const hashes = new Map<string,string>();
    const observed = (name: string, bytes: Buffer) => { hashes.set(name,createHash('sha256').update(bytes).digest('hex')); };
    const read = (name: string): Buffer | undefined => {
        const entry = index.get(name);
        if (!entry) return undefined;
        const match = /^100(?:644|755) blob ([a-f0-9]{40})$/u.exec(entry);
        assert(match, 'Product check input must be a regular file: ' + name);
        return git('cat-file','blob',match[1]!);
    };
    if (plan.checks.includes('assets')) checkAssetInputs(plan.paths.filter(path => extraCheck(path) === 'assets'), {
        read, jsonFiles: () => [...index.keys()].filter(name => name.endsWith('.json')),
    }, observed);
    if (plan.checks.includes('approval')) {
        const raw = read(APPROVAL_REGISTRY_PATH); assert(raw); observed(APPROVAL_REGISTRY_PATH,raw);
        const registry = assessApprovalRegistry(JSON.parse(raw.toString('utf8')));
        const entries = new Map([[APPROVAL_REGISTRY_PATH,raw]]);
        for (const row of registry.approvals) { const approval = read(row.path); assert(approval); observed(row.path,approval); entries.set(row.path, approval); }
        for (const row of registry.approvals) sourceStableApproval(entries,row.version);
    }
    return createHash('sha256').update(JSON.stringify([...hashes].sort(([left],[right]) => left < right ? -1 : left > right ? 1 : 0))).digest('hex');
}
export function validateProductChecks(record: Source & Pick<CompleteEvidenceV2,'product_checks' | 'run_id' | 'attempt'>): void {
    const receipt = record.product_checks;
    const expected = supplementPlan(record, receipt?.plan.base);
    if (!expected.checks.length) { assert.equal(receipt,undefined); return; }
    assert(receipt,'Missing original supplemental product checks: ' + expected.checks.join(', '));
    assert.equal(receipt.kind,'supplemental-product-checks'); assert.equal(receipt.schema_version,1); assert.equal(receipt.status,'pass');
    assert.deepEqual(receipt.plan,expected,'Changed paths or supplemental checks were omitted');
    assert.equal(receipt.commit,record.source_commit); assert.equal(receipt.tree,record.tree);
    assert.equal(receipt.run_id,record.run_id); assert.equal(receipt.attempt,record.attempt); assert.equal(receipt.job,'Complete candidate evidence');
    assert(Number.isSafeInteger(receipt.job_id) && receipt.job_id > 0);
    assert(Number.isFinite(Date.parse(receipt.started_at)) && Date.parse(receipt.completed_at) >= Date.parse(receipt.started_at));
    assert.equal(receipt.inputs_sha256,runProductChecks(record.source_commit,expected),'Original supplemental inputs changed');
}
