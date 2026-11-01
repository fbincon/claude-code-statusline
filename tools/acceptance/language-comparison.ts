/** Measure the installed language workload on one package, runtime and runner. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { architecture } from '@fbincon/statusline-platform/architecture';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { npmEntry, sha256 } from '../build/files.js';
import { verifyCandidate } from '../build/verify.js';
import { repoRoot, sourceHashes } from '../migration/ts-03/common.js';
import { installCandidate } from './install.js';
import { installedLanguages, type InstalledLanguageFixture } from './installed-language.js';
import { languageAcceptanceBudget } from './language-budget.js';
import { FIXTURE_INSTALL_MS, FIXTURE_CLEANUP_MS, HANDOFF_MS, requireHostedBudget, supervisionBudget, WORKER_START_MS, WORKER_EXIT_MS } from './budgets.js';
import { phaseSync, superviseInstalled } from './installed-supervisor.js';
import { prepareWindowsPowerShell } from './windows-shell.js';

const pattern = 'installed effective languages';
const orders = [['baseline', 'optimized'], ['optimized', 'baseline'], ['baseline', 'optimized']] as const;
type Mode = 'baseline' | 'optimized';

interface Sample {
    schema_version: number;
    status: string;
    mode: Mode;
    promotable: boolean;
    commit: string;
    tarball_sha256: string;
    node: string;
    platform: string;
    arch: string;
    target: string;
    elapsed_ms: number;
    candidate_launches: number;
    combinations: number;
    obligations_sha256: string;
    content_sha256: string;
    resources: { language: string; entries: number; sha256: string }[];
    pairs: { ui_language: string; output_language: string; preview_sample: boolean; readonly_preview: boolean; reopened_ui: string; reopened_output: string; render_sha256: string }[];
}

function checkSample(sample: Sample, mode: Mode, commit: string, digest: string): void {
    assert.equal(sample.schema_version, 1); assert.equal(sample.status, 'pass');
    assert.equal(sample.mode, mode); assert.equal(sample.promotable, false);
    assert.equal(sample.commit, commit); assert.equal(sample.tarball_sha256, digest);
    assert.equal(sample.node, process.version); assert.equal(sample.platform, process.platform); assert.equal(sample.arch, process.arch);
    assert.equal(sample.target, process.env.TS05_TARGET ?? 'local');
    assert(Number.isFinite(sample.elapsed_ms) && sample.elapsed_ms > 0);
    const languages = LANGUAGES.length, combinations = languages ** 2;
    assert.equal(sample.combinations, combinations); assert.equal(sample.pairs.length, combinations);
    assert.deepEqual(sample.resources.map(resource => resource.language), [...LANGUAGES]);
    for (const resource of sample.resources) {
        assert(Number.isInteger(resource.entries) && resource.entries > 0); assert.match(resource.sha256, /^[a-f0-9]{64}$/u);
    }
    const obligations = sample.pairs.map(pair => [pair.ui_language, pair.output_language]);
    assert.equal(sample.obligations_sha256, sha256(JSON.stringify(obligations)), 'Obligation digest differs');
    assert.equal(sample.content_sha256, sha256(JSON.stringify({ resources: sample.resources, pairs: sample.pairs })), 'Content digest differs');
    if (mode === 'baseline') assert.equal(sample.candidate_launches, 3 + languages + 6 * combinations);
    else assert(Number.isInteger(sample.candidate_launches) && sample.candidate_launches > 0 && sample.candidate_launches <= 3 + 7 * languages + combinations);
    const expected = new Set(LANGUAGES.flatMap(ui => LANGUAGES.map(output => ui + '/' + output)));
    for (const pair of sample.pairs) {
        assert(expected.delete(pair.ui_language + '/' + pair.output_language), 'Duplicate or unexpected language pair');
        assert.equal(pair.preview_sample, true); assert.equal(pair.readonly_preview, true);
        assert.equal(pair.reopened_ui, pair.ui_language);
        assert.equal(pair.reopened_output, pair.output_language);
        assert.match(pair.render_sha256, /^[a-f0-9]{64}$/u);
    }
    assert.equal(expected.size, 0, 'Missing language pairs');
}

export function compareLanguageSamples(samples: Sample[], commit: string, digest: string) {
    assert.equal(samples.length, 6, 'Three matched pairs are required');
    const baseline: number[] = [], optimized: number[] = [], first = samples[0]!;
    for (const [index, mode] of orders.flat().entries()) {
        const sample = samples[index]!;
        checkSample(sample, mode, commit, digest);
        assert.equal(sample.obligations_sha256, first.obligations_sha256, 'Language obligations changed');
        assert.equal(sample.content_sha256, first.content_sha256, 'Observed language content changed');
        assert.deepEqual(sample.pairs, first.pairs, 'Per-pair language observations changed');
        (mode === 'baseline' ? baseline : optimized).push(sample.elapsed_ms);
    }
    const median = (times: number[]) => [...times].sort((a, b) => a - b)[1]!;
    const baselineMedian = median(baseline), optimizedMedian = median(optimized);
    return { baseline_ms: baseline, optimized_ms: optimized, baseline_median_ms: baselineMedian, optimized_median_ms: optimizedMedian,
        improvement: 1 - optimizedMedian / baselineMedian, faster: optimizedMedian < baselineMedian };
}

const self = fileURLToPath(import.meta.url);
const samplesInOrder = orders.flatMap((modes, i) => modes.map(mode => ({ mode, name: `round-${i + 1}-${mode}` })));
export function comparisonPhases(windows: boolean, languages: number) {
    return [
        { name: 'verify-inputs', budgetMs: 120_000 },
        ...(windows ? [{ name: 'prepare-powershell', budgetMs: 60_000 + HANDOFF_MS }] : []),
        { name: 'offline-install', budgetMs: FIXTURE_INSTALL_MS },
        { name: 'protect-package', budgetMs: 60_000 },
        ...samplesInOrder.map(({ name }) => ({ name, budgetMs: WORKER_START_MS + languageAcceptanceBudget(languages) + WORKER_EXIT_MS + FIXTURE_CLEANUP_MS })),
        { name: 'verify-and-clean-up', budgetMs: 120_000 + FIXTURE_CLEANUP_MS },
    ];
}
function write(path: string, value: unknown): void {
    fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
function visit(path: string, action: (path: string, stat: fs.Stats) => void): void {
    const stat = fs.lstatSync(path);
    action(path, stat);
    if (!stat.isSymbolicLink() && stat.isDirectory()) for (const name of fs.readdirSync(path).sort()) visit(join(path, name), action);
}
export function makeRemovable(path: string): void {
    visit(path, (file, stat) => {
        if (!stat.isSymbolicLink() && !(stat.mode & 0o200)) fs.chmodSync(file, stat.mode | 0o200);
    });
}
/** Protect the actual installed package and copied Node, including any file not listed by the driver. */
function packageSnapshot(installed: ReturnType<typeof installCandidate>, protect: boolean): string {
    const files: [string, number, string][] = [];
    for (const root of [installed.root, installed.nodeDir]) visit(root, (file, stat) => {
        if (protect && !stat.isSymbolicLink()) fs.chmodSync(file, stat.mode & ~0o222);
        const mode = fs.lstatSync(file).mode;
        const value = stat.isDirectory() ? 'directory' : stat.isSymbolicLink() ? 'link:' + fs.readlinkSync(file) : sha256(fs.readFileSync(file));
        files.push([relative(installed.temporary, file), mode, value]);
    });
    return sha256(JSON.stringify(files));
}
interface Input { artifact: string; commit: string; digest: string; directory: string }
function identityFor(input: Input) {
    const verified = verifyCandidate(input.artifact, input.commit);
    assert.equal(verified.sha256, input.digest, 'Package differs from the pinned diagnostic input');
    const arch = architecture();
    if (process.env.TS06_RESOLVED_NODE) assert.equal(process.versions.node, process.env.TS06_RESOLVED_NODE);
    if (process.env.TS03_EXPECT_PROCESS_ARCH) assert.equal(arch.process_arch, process.env.TS03_EXPECT_PROCESS_ARCH);
    if (process.env.TS03_EXPECT_HOST_ARCH) assert.equal(arch.host_arch, process.env.TS03_EXPECT_HOST_ARCH);
    const git = (...argv: string[]) => execFileSync('git', argv, { cwd: repoRoot, encoding: 'utf8' }).trim();
    const head = git('rev-parse', 'HEAD'), dirty = git('status', '--porcelain') !== '';
    if (process.env.GITHUB_ACTIONS === 'true') { assert.equal(head, process.env.GITHUB_SHA); assert.equal(dirty, false, 'Diagnostic checkout must be clean'); }
    const npm = fs.realpathSync(npmEntry());
    return { schema_version: 1, kind: 'installed-language-comparison', promotable: false,
        artifact_source: { commit: input.commit, tarball_sha256: input.digest }, harness_source: { commit: head, dirty, source_hashes_sha256: sha256(JSON.stringify(sourceHashes())) },
        runtime: { node: process.version, node_sha256: sha256(fs.readFileSync(process.execPath)), npm_cli_sha256: sha256(fs.readFileSync(npm)),
            npm: JSON.parse(fs.readFileSync(join(dirname(npm), '..', 'package.json'), 'utf8')).version, platform: process.platform, ...arch },
        target: process.env.TS05_TARGET ?? 'local', run_id: process.env.GITHUB_RUN_ID ?? null,
        attempt: process.env.GITHUB_RUN_ATTEMPT ?? null, job: process.env.GITHUB_JOB ?? null };
}
function execute(input: Input, staged: string): void {
    const { artifact, commit, digest, directory } = input;
    const identity = phaseSync('verify-inputs', () => identityFor(input));
    write(join(directory, 'inputs.json'), { ...identity, orders });
    if (process.platform === 'win32') phaseSync('prepare-powershell', () => {
        const shell = prepareWindowsPowerShell(); write(join(directory, 'powershell.json'), shell); assert.equal(shell.status, 'pass');
    });
    const installed = phaseSync('offline-install', () => installCandidate(artifact, commit));
    const original = phaseSync('protect-package', () => {
        const snapshot = packageSnapshot(installed, true);
        assert.equal(execFileSync(installed.node, ['--version'], { env: installed.env, encoding: 'utf8' }).trim(), process.version);
        return snapshot;
    });
    const samples: Sample[] = [], commandTimes: number[] = [];
    for (const { mode, name } of samplesInOrder) {
        phaseSync(name, () => {
            const root = fs.mkdtempSync(join(installed.temporary, 'sample-'));
            const home = join(root, 'home'), cwd = join(root, 'cwd'), temp = join(root, 'tmp'), cache = join(root, 'cache');
            for (const path of [home, cwd, temp, cache]) fs.mkdirSync(path, { mode: 0o700 });
            const env = { ...installed.env, HOME: home, USERPROFILE: home, TMPDIR: temp, TMP: temp, TEMP: temp, npm_config_cache: cache,
                CLAUDE_CONFIG_DIR: join(root, 'i18n-workflow') };
            const fixture: InstalledLanguageFixture = { temporary: root, directory: cwd, node: installed.node, modules: installed.modules,
                entry: installed.entry, env, packed: { source: { commit }, sha256: digest } };
            const spec = join(root, 'fixture.json'), report = join(directory, name + '.json'); write(spec, fixture);
            const started = performance.now();
            execFileSync(process.execPath, [self, 'sample', spec], { cwd, stdio: 'inherit', env: { ...env, TS05_TARGET: identity.target,
                TS05_LANGUAGE_MODE: mode, TS05_DIAGNOSTIC_PATTERN: pattern, TS04_INSTALLED_REPORT: report } });
            commandTimes.push(performance.now() - started);
            const sample: Sample = JSON.parse(fs.readFileSync(report + '.language.json', 'utf8'));
            checkSample(sample, mode, commit, digest);
            for (const resource of sample.resources) assert.equal(resource.sha256, installed.packed.source.files['node_modules/@fbincon/statusline-core/resources/i18n/locales/' + resource.language + '.json'], 'Observed resource differs from package');
            samples.push(sample);
            removeTree(root); assert(!fs.existsSync(root));
            write(report, { kind: 'installed-language-sample', promotable: false, status: 'pass', exit_code: 0, isolated_state_removed: true,
                artifact_source: identity.artifact_source, mode, candidate_launches: sample.candidate_launches, elapsed_ms: sample.elapsed_ms });
        });
    }
    phaseSync('verify-and-clean-up', () => {
        assert.equal(packageSnapshot(installed, false), original, 'Shared installed bytes or modes changed');
        assert.equal(sha256(JSON.stringify(sourceHashes())), identity.harness_source.source_hashes_sha256, 'Harness changed during comparison');
        makeRemovable(installed.temporary); installed.cleanup(); assert(!fs.existsSync(installed.temporary));
        const measurements = compareLanguageSamples(samples, commit, digest);
        console.log(JSON.stringify(measurements)); assert(measurements.faster, 'The optimized median must be lower on this runner');
        write(staged, { ...identity, orders, ...measurements, sample_command_ms: commandTimes,
            offline_installations: 1, readonly_node_executed: true, readonly_snapshot_sha256: original, candidate_launches: samples.map(sample => sample.candidate_launches),
            obligations_sha256: samples[0]!.obligations_sha256, content_sha256: samples[0]!.content_sha256, combinations: samples[0]!.combinations });
    });
}
async function main(): Promise<void> {
    if (process.argv[2] === 'sample') {
        const fixture: InstalledLanguageFixture = JSON.parse(fs.readFileSync(process.argv[3]!, 'utf8'));
        await installedLanguages(fixture); return;
    }
    if (process.argv[2] === 'execute') {
        const path = process.argv[3]!;
        execute(JSON.parse(fs.readFileSync(path, 'utf8')), join(dirname(path), 'result.json')); return;
    }
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, sha256: { type: 'string' }, output: { type: 'string' } } });
    const { artifact, commit, sha256: digest, output } = values;
    assert(artifact && commit && digest && output, 'Require --artifact TGZ --commit PACKAGE_SHA --sha256 PACKAGE_DIGEST --output NEW_DIRECTORY');
    assert.match(commit, /^[a-f0-9]{40}$/u); assert.match(digest, /^[a-f0-9]{64}$/u);
    const directory = resolve(output), phases = comparisonPhases(process.platform === 'win32', LANGUAGES.length);
    if (process.env.GITHUB_ACTIONS) requireHostedBudget(supervisionBudget(phases), FIXTURE_CLEANUP_MS);
    fs.mkdirSync(dirname(directory), { recursive: true }); fs.mkdirSync(directory);
    const workspace = fs.mkdtempSync(join(tmpdir(), 'slab-'));
    let result: unknown;
    try {
        const spec = join(workspace, 'input.json'); write(spec, { artifact: resolve(artifact), commit, digest, directory });
        await superviseInstalled([self, 'execute', spec], phases, { ...process.env, TMPDIR: workspace, TEMP: workspace, TMP: workspace }, join(directory, 'comparison'));
        result = JSON.parse(fs.readFileSync(join(workspace, 'result.json'), 'utf8'));
    } finally {
        makeRemovable(workspace); removeTree(workspace); assert(!fs.existsSync(workspace));
    }
    write(join(directory, 'comparison.json'), result);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
