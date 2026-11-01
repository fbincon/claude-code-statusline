import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { sha256 } from '../build/files.js';
import type { CoverageProducer } from '../checks/ci-coverage.js';
import { repoRoot } from '../migration/ts-03/common.js';
import { runInstalled } from './installed.js';
import { superviseInstalled } from './installed-supervisor.js';
import { officialPhases, physicalJobBudget, requiresStability, sourcePhases, STABILITY_PHASE } from './physical-budgets.js';

export type PhysicalWork = Pick<CoverageProducer, 'stage' | 'depth' | 'os' | 'job_key' | 'host'> & { target: string };
type Report = Record<string, any>;
const json = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const entry = (name: string) => fileURLToPath(new URL(name + '.js', import.meta.url));

/** Keep the original runtime suite's guard on every installed harness and
 * source process, including actors that discharge a shared development row. */
export function installedHarnessEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return { ...env, NODE_OPTIONS: '--import=' + pathToFileURL(join(repoRoot, 'tools/testing/no-python.mjs')).href };
}

async function officialSections(spec: PhysicalWork, artifact: string, commit: string, output: string, claude: string, env: NodeJS.ProcessEnv): Promise<Report> {
    assert.equal(spec.stage, 'complete'); assert(spec.host);
    const windows = process.platform === 'win32', stable = requiresStability(spec.os, spec.host);
    const { official, history } = officialPhases(windows, spec.depth, stable);
    const report = join(output, 'official-work'), transition = join(output, 'history-work');
    await superviseInstalled([entry('./mods'), '--artifact', artifact, '--commit', commit, '--report', report,
        '--claude', claude, '--physical-window-ms', String(official.budgetMs)], [official], { ...env, TS05_PHYSICAL_EXPECT_HOST: spec.host }, report);
    const observed = json(report);
    assert.equal(observed.status, 'pass'); assert.equal(observed.host, spec.host);
    const host = claudeLaunch(claude); assert.equal(host.args.length, 0);
    assert.equal(sha256(fs.readFileSync(host.executable)), observed.host_sha256, 'Official binary changed before history');
    await superviseInstalled([entry('./version-management-official'), artifact, commit, JSON.stringify({ ...host, version: observed.host }),
        transition, join(output, 'history-trace.jsonl'), spec.depth], history, env, transition);
    const sections: Report = { status: 'pass', official: observed, history: json(transition) };
    if (stable) {
        const path = join(output, 'stability-work');
        await superviseInstalled([entry('./native-stability'), path, claude, '--physical'], [STABILITY_PHASE], env, path);
        sections.stability = json(path); fs.unlinkSync(path);
    }
    assert.equal(sha256(fs.readFileSync(host.executable)), observed.host_sha256, 'Official binary changed during acceptance');
    fs.unlinkSync(report); fs.unlinkSync(transition);
    return sections;
}

async function installedSections(spec: PhysicalWork, artifact: string, commit: string, output: string, env: NodeJS.ProcessEnv): Promise<Report> {
    const platform = spec.job_key === 'installed', hasSource = spec.stage === 'installed' || spec.stage === 'complete';
    const phases = sourcePhases(platform);
    const selected = { stage: spec.stage, depth: spec.depth };
    const path = join(output, 'installation-work');
    await runInstalled(artifact, commit, path, undefined, env, selected);
    const sections = json(path);
    if (hasSource) {
        const groups = join(output, 'source-groups.json');
        const runner = 'tools/typescript/test.mjs';
        await superviseInstalled([runner, ...(platform ? [] : ['--runtime'])], phases,
            { ...env, TS05_SOURCE_GROUP_REPORT: groups },
            join(output, 'source-tests'), { cwd: repoRoot });
        const observed: { name: string; files: number; exit_code: number }[] = json(groups);
        assert.deepEqual(observed.map(row => row.name), ['isolated', 'serial']);
        assert(observed.every(row => Number.isSafeInteger(row.files) && row.files > 0 && row.exit_code === 0));
        sections.source_tests = { status: 'pass', suite: platform ? 'complete-platform-suite' : 'product-runtime-suite',
            commit, node: process.versions.node, node_sha256: sha256(fs.readFileSync(process.execPath)), platform: process.platform, arch: process.arch,
            run_id: env.GITHUB_RUN_ID ? Number(env.GITHUB_RUN_ID) : null, attempt: env.GITHUB_RUN_ATTEMPT ? Number(env.GITHUB_RUN_ATTEMPT) : null,
            job_key: env.GITHUB_JOB ?? null, runner_sha256: sha256(fs.readFileSync(join(repoRoot, runner))), isolated_passed: true, serial_passed: true };
    }
    fs.unlinkSync(path); return sections;
}

/** Every physical process gets a new installation, home, configuration and
 * npm cache, even when a hosted retry happens on the same machine. */
export async function executePhysicalSections(spec: PhysicalWork, artifact: string, commit: string, output: string, claude = 'claude'): Promise<Report> {
    physicalJobBudget(spec, LANGUAGES.length);
    const root = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'physical-acceptance-')));
    const home = join(root, 'home');
    try {
        fs.mkdirSync(home, { mode: 0o700 });
        // installCandidate and both historical journeys reserve independent
        // prefixes directly under OS temp. Keep their original Windows path depth.
        const env = { ...process.env, TS05_TARGET: spec.target, HOME: home, USERPROFILE: home,
            CLAUDE_CONFIG_DIR: join(root, 'config'), npm_config_cache: join(root, 'npm-cache'),
            npm_config_prefix: join(root, 'npm-prefix'), TS05_LANGUAGE_MODE: 'optimized', TS05_DIAGNOSTIC_PATTERN: '' };
        return spec.job_key === 'mods'
            ? await officialSections(spec, artifact, commit, output, claude, env)
            : await installedSections(spec, artifact, commit, output, installedHarnessEnvironment(env));
    } finally {
        removeTree(root); assert(!fs.existsSync(root), 'Physical acceptance workspace was not removed');
    }
}
