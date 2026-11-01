/** A single independently runnable actor. Promotion verifies its raw output
 * against the original Actions job and the independently reconstructed plan. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { basename, dirname, join, relative, resolve, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { architecture } from '@fbincon/statusline-platform/architecture';
import { matchesNodeCase } from '@fbincon/statusline-core/node-runtime';
import { npmEntry, sha256 } from '../build/files.js';
import { verifyCandidate } from '../build/verify.js';
import { createCoveragePlan, verifyCoveragePlan, type CoveragePlan } from '../checks/ci-coverage.js';
import { probePlan } from '../checks/ci-probe-plan.js';
import { validateFragmentIdentity, type PhysicalFragment, type PhysicalIdentity } from '../checks/ci-fragment.js';
import { sectionInputsAt, validateSectionEvidence, verifySectionLogBytes } from '../checks/ci-section-evidence.js';
import { repoRoot, sourceHashes } from '../migration/ts-03/common.js';
import { executePhysicalSections } from './physical-sections.js';

const json = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));

/** npm's entry stub alone is shared by many releases. Bind the actual entry
 * and its installed implementation, independent of installation prefix. */
export function observedNpm() {
    const entry = fs.realpathSync.native(npmEntry()), root = dirname(dirname(entry)), manifest = json(join(root, 'package.json'));
    assert.equal(basename(entry), 'npm-cli.js'); assert.equal(manifest.name, 'npm');
    const version = execFileSync(process.execPath, [entry, '--version'], { encoding: 'utf8', timeout: 30_000 }).trim();
    assert.equal(version, manifest.version); assert.match(version, /^\d+\.\d+\.\d+$/u);
    const hash = createHash('sha256');
    function walk(directory: string): void {
        for (const name of fs.readdirSync(directory).sort()) {
            const path = join(directory, name), key = relative(root, path).split(sep).join('/'), stat = fs.lstatSync(path);
            if (stat.isDirectory()) walk(path);
            else if (stat.isSymbolicLink()) {
                const target = relative(root, fs.realpathSync.native(path));
                assert(target && !isAbsolute(target) && target !== '..' && !target.startsWith('..' + sep), 'npm contains an external link');
                hash.update(JSON.stringify([key, 'link', target.split(sep).join('/')]) + '\n');
            } else {
                assert(stat.isFile(), 'Unexpected npm package input');
                hash.update(JSON.stringify([key, 'file', sha256(fs.readFileSync(path))]) + '\n');
            }
        }
    }
    walk(root);
    return { npm: version, npm_sha256: hash.digest('hex') };
}

function planForWorker(path: string, commit: string): CoveragePlan {
    const plan = json(path), inputs = json(join(dirname(path), 'runtime-inputs.json'));
    if (!Object.hasOwn(plan, 'diagnostic')) return verifyCoveragePlan(plan, plan.base, commit, inputs, plan.basis);
    // A reduced manual plan never satisfies the normal plan verifier. Only
    // its diagnostic workflow can supply it; the gate refuses these artifacts.
    assert.equal(plan.diagnostic, 'tiered-probe'); assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
    assert.equal(process.env.GITHUB_REF_TYPE, 'branch'); assert.equal(json(process.env.GITHUB_EVENT_PATH!).inputs.validation, 'tiered-probe');
    assert.deepEqual(plan, probePlan(createCoveragePlan(null, commit, inputs), inputs));
    return plan;
}

export async function physical(planPath: string, producer: string, artifact: string, output: string, claude = 'claude'): Promise<void> {
    const env = process.env;
    assert.equal(env.GITHUB_ACTIONS, 'true', 'A physical fragment needs an original Actions execution');
    const commit = execFileSync('git', ['--no-replace-objects', 'rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const plan = planForWorker(planPath, commit), spec = plan.producers.find(p => p.id === producer);
    assert(spec, 'Unknown physical producer'); assert.equal(spec.job_key, env.GITHUB_JOB);
    const rows = plan.obligations.filter(row => spec.obligations.includes(row.id)), target = rows[0]!.target;
    const observed = architecture();
    assert.equal(process.platform, spec.os.startsWith('windows-') ? 'win32' : spec.os.startsWith('macos-') ? 'darwin' : 'linux');
    assert.equal(process.versions.node, spec.node); assert.equal(observed.host_arch, spec.host_arch); assert.equal(observed.process_arch, spec.arch);
    if (env.TS06_RESOLVED_NODE) assert.equal(env.TS06_RESOLVED_NODE, process.versions.node);
    if (env.TS05_TARGET) assert.equal(env.TS05_TARGET, spec.os + '-' + spec.arch);
    for (const row of rows) if (row.selector !== null) assert(matchesNodeCase(process.versions.node, row.selector));
    assert.equal(spec.job_key === 'installed', rows.some(row => row.kind === 'installed'));
    const candidate = verifyCandidate(artifact, commit);
    assert.deepEqual(sourceHashes(), candidate.source.source_hashes, 'Physical test sources differ from the candidate');
    const npm = observedNpm(), node_sha256 = sha256(fs.readFileSync(process.execPath));
    if (process.versions.node === fs.readFileSync(join(repoRoot, '.node-version'), 'utf8').trim()) assert.equal(npm.npm, candidate.source.npm);
    const run_id = Number(env.GITHUB_RUN_ID), attempt = Number(env.GITHUB_RUN_ATTEMPT), workflow_sha = env.GITHUB_WORKFLOW_SHA!;
    assert(Number.isSafeInteger(run_id) && run_id > 0 && Number.isSafeInteger(attempt) && attempt > 0); assert.match(workflow_sha, /^[a-f0-9]{40}$/u);
    fs.mkdirSync(dirname(output), { recursive: true }); fs.mkdirSync(output);
    const report = await executePhysicalSections({ ...spec, target }, artifact, commit, output, claude);
    const identity: PhysicalIdentity = { producer_id: spec.id, commit, tree: plan.tree, policy_sha256: plan.policy_sha256,
        tarball_sha256: candidate.sha256, workflow_sha, os: spec.os, platform: process.platform, process_arch: observed.process_arch, host_arch: observed.host_arch,
        node: process.versions.node, node_sha256, ...npm, host: report.official?.host ?? null, host_sha256: report.official?.host_sha256 ?? null,
        stage: spec.stage, depth: spec.depth, obligations: spec.obligations, run_id, attempt, job: spec.job, job_key: env.GITHUB_JOB! };
    const fragment: PhysicalFragment = { schema_version: 2, kind: 'acceptance-fragment', status: 'pass', identity, report };
    const pending = join(output, 'fragment.pending');
    fs.writeFileSync(pending, JSON.stringify(fragment, null, 2) + '\n', { flag: 'wx' });
    validateFragmentIdentity(fragment, spec, plan, { tarball_sha256: candidate.sha256, run_id, attempt, workflow_sha });
    validateSectionEvidence(fragment, spec, plan, sectionInputsAt(commit)); verifySectionLogBytes(output, report);
    fs.renameSync(pending, join(output, 'fragment.json'));
    console.log(JSON.stringify({ producer, stage: spec.stage, depth: spec.depth, obligations: spec.obligations, status: 'pass' }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { plan: { type: 'string' }, producer: { type: 'string' }, artifact: { type: 'string' }, output: { type: 'string' }, claude: { type: 'string' } } });
    assert(values.plan && values.producer && values.artifact && values.output, 'Require --plan FILE --producer ID --artifact TGZ --output NEW_DIRECTORY');
    await physical(resolve(values.plan), values.producer, resolve(values.artifact), resolve(values.output), values.claude);
}
