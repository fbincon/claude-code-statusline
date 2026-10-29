/** Cross-check with executable verifiers from the already accepted first parent.
 * Never restore candidate compiler output into this isolated verifier directory.
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { PromotionSelection } from './ci-promotion.ts';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export const BASE_VERIFICATION_CHECKS = ['accepted-base-code', 'latest-base-and-pr-runs', 'merge-head-base-tree', 'original-envelope-and-artifacts', 'complete-coverage', 'original-file-bytes'];

export function exportBaseVerifiers(base: string, directory: string): void {
    assert.match(base, /^[a-f0-9]{40}$/u);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(join(directory, 'package.json'), '{"private":true,"type":"module"}\n', { flag: 'wx' });
    for (const row of git('ls-tree', '-r', base, '--', 'tools/checks', 'tools/generation/i18n').split('\n')) {
        const [identity, path] = row.split('\t');
        if (!path?.endsWith('.ts')) continue;
        assert(identity?.startsWith('100644 blob ') || identity?.startsWith('100755 blob '), 'Verifier must be a regular Git blob');
        assert((path.startsWith('tools/checks/') || /^tools\/generation\/i18n\/[^/]+\.ts$/u.test(path)) && !path.includes('\\') && !path.split('/').some(part => part === '..' || part === '.'));
        const target = join(directory, path); fs.mkdirSync(dirname(target), { recursive: true });
        fs.writeFileSync(target, execFileSync('git', ['show', base + ':' + path], { maxBuffer: 4 * 1024 * 1024 }), { flag: 'wx' });
    }
}

export async function verifyWithAcceptedBase(selection: PromotionSelection, evidence: string): Promise<any> {
    assert.equal(selection.route, 'main'); assert(selection.integration && selection.source_record && selection.source_envelope);
    const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ');
    assert.equal(parents.length, 3, 'Trusted verification requires a real two-parent integration');
    const [commit, base, head] = parents as [string, string, string];
    assert.equal(selection.commit, commit); assert.equal(selection.source_commit, head);
    assert.equal(selection.integration.base, base); assert.equal(selection.integration.head, head);
    const directory = fs.mkdtempSync(join(tmpdir(), 'statusline-base-verifier-'));
    try {
        exportBaseVerifiers(base, directory);
        // These imports resolve exclusively inside the frozen base, not HEAD.
        const sources = await import(pathToFileURL(join(directory, 'tools/checks/ci-sources.ts')).href);
        const original = await import(pathToFileURL(join(directory, 'tools/checks/ci-evidence.ts')).href);
        const integration = await import(pathToFileURL(join(directory, 'tools/checks/ci-integration.ts')).href);
        const baseRun = sources.latestRun(await sources.runsFor(base), base, 'main');
        assert(baseRun, 'Independent verifier has no successful base gate'); assert.equal(baseRun.id, selection.base_run);
        await integration.verifyMerge(selection.integration);
        const run = sources.latestRun(await sources.runsFor(head, 'pull_request'), head, selection.source_record.branch, 'pull_request');
        assert(run); assert.equal(run.id, selection.source_run);
        const source = await sources.completeSource(run);
        assert.equal(source.record.pr.head, head); assert.equal(source.record.pr.base, base);
        assert.equal(source.record.pr.number, selection.integration.pr);
        assert.equal(source.record.tree, git('rev-parse', commit + '^{tree}'));
        assert.deepEqual(source.record, selection.source_record); assert.deepEqual(source.envelope, selection.source_envelope);
        assert.deepEqual(source.artifact_ids, selection.artifact_ids);
        original.verifyRecordedFiles(source.record, evidence);
        return { schema_version: 1, kind: 'base-verifier', status: 'pass', verifier_commit: base,
            verifier_tree: git('rev-parse', base + '^{tree}'), base_run: baseRun.id,
            integration_commit: commit, source_commit: head, source_run: run.id, source_envelope: source.envelope,
            source_record_sha256: original.digest(JSON.stringify(source.record)),
            run_id: Number(process.env.GITHUB_RUN_ID), attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
            checks: BASE_VERIFICATION_CHECKS,
        };
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { selection: { type: 'string' }, evidence: { type: 'string' }, output: { type: 'string' } } });
    assert(values.selection && values.evidence && values.output);
    const report = await verifyWithAcceptedBase(JSON.parse(fs.readFileSync(values.selection, 'utf8')), resolve(values.evidence));
    fs.mkdirSync(dirname(resolve(values.output)), { recursive: true });
    fs.writeFileSync(values.output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report));
}
