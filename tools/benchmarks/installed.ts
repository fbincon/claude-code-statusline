/** PERF-01: one harness, verified npm artifacts, fresh processes and full cache snapshots. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { cpus, release } from 'node:os';
import assert from 'node:assert/strict';
import { readTar, extractFiles, sha256, files } from '../build/files.js';
import { repoRoot, sourceHashes } from '../migration/ts-03/common.js';
import { CASES, createProfile, inputFor, record, type BenchmarkCase, type Input } from '../migration/ts-03/performance/fixtures.js';
import { CacheSnapshot, refreshGitCache } from './installed-state.js';

const DIMENSIONS: Record<string, readonly number[]> = { small: [100, 0, 32], medium: [10000, 8, 1000], large: [100000, 32, 10000] };
export const INSTALLED_CASES = [
    ...CASES,
    ...(['medium', 'large'] as const).flatMap(profile => ['replay', 'increment'].map(kind => ({
        name: `in-process/${profile}/transcript/${kind}`, mode: 'in_process' as const,
        operation: 'usage', profile, cache: 'append' as const,
    }))),
];

interface Artifact {
    root: string;
    sha256: string;
    commit: string;
    version: string;
    files: Record<string, string>;
}
interface Sample { ms: number; peak_rss_bytes: number; output_sha256: string }
interface Measurement {
    case: string;
    mode: string;
    samples: Sample[];
    p50_ms: number;
    p95_ms: number;
    peak_rss_bytes: number;
    diagnostic: { output_sha256: string; counts: Record<string, number> };
}
interface Run { round: number; side: string; records: Measurement[] }

export function unpackArtifact(path: string, root: string): Artifact {
    const entries = readTar(path), source = JSON.parse(entries.get('candidate.json')!.toString('utf8'));
    assert.equal(source.schema_version, 1, 'Unknown artifact manifest');
    assert(/^[a-f0-9]{40}$/u.test(source.commit), 'Invalid source commit');
    assert.equal(source.dirty, false, 'Dirty artifact');
    assert(typeof source.application_version === 'string');
    assert(source.files && typeof source.files === 'object');
    assert.equal(JSON.parse(entries.get('package.json')!.toString('utf8')).bin['claude-statusline'], 'bin/claude-statusline.js');
    const expected = { ...source.files, 'candidate.json': sha256(entries.get('candidate.json')!) } as Record<string, string>;
    assert.deepEqual([...entries.keys()].sort(), Object.keys(expected).sort(), 'Unexpected artifact files');
    for (const [name, hash] of Object.entries(expected)) assert.equal(sha256(entries.get(name)!), hash, 'Artifact file differs: ' + name);
    fs.mkdirSync(root);
    extractFiles(entries, root);
    return { root, sha256: sha256(fs.readFileSync(path)), commit: source.commit, version: source.application_version, files: expected };
}

export function verifyInstalled(artifact: Artifact): void {
    assert.deepEqual(files(artifact.root).sort(), Object.keys(artifact.files).sort(), 'Installed inventory changed');
    for (const [name, hash] of Object.entries(artifact.files)) assert.equal(sha256(fs.readFileSync(join(artifact.root, name))), hash, 'Installed file changed: ' + name);
}

export function commandSignature(command: string, stdout: string, runtime: string): string {
    if (command === 'runtime' || command === 'ui') {
        const response = JSON.parse(stdout);
        // Only the documented product identity differs between patch releases.
        if (typeof response.result?.backend_version === 'string') response.result.backend_version = '<backend-version>';
        stdout = JSON.stringify(response);
    }
    if (command === 'hook') {
        const directory = join(runtime, 'turns');
        const names = fs.readdirSync(directory).filter(name => name.endsWith('.json'));
        assert.equal(names.length, 1, 'Hook did not publish its lifecycle state');
        const state = JSON.parse(fs.readFileSync(join(directory, names[0]!), 'utf8'));
        assert.equal(stdout, '', 'Hook polluted stdout');
        return sha256(JSON.stringify({ records: names.length, status: state.status, prompt_id: state.prompt_id }));
    }
    return sha256(stdout);
}

export function summarize(samples: Sample[]) {
    assert(samples.length > 0);
    const times = samples.map(row => row.ms).sort((a, b) => a - b);
    return {
        p50_ms: (times[Math.floor((times.length - 1) / 2)]! + times[Math.floor(times.length / 2)]!) / 2,
        p95_ms: times[Math.ceil(times.length * .95) - 1]!,
        peak_rss_bytes: Math.max(...samples.map(row => row.peak_rss_bytes)),
    };
}

function environment(work: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CONFIG_DIR: join(work, 'config'), CLAUDE_STATUSLINE_RUNTIME_DIR: join(work, 'runtime'),
        CLAUDE_STATUSLINE_SESSIONS_DIR: join(work, 'sessions'), HOME: join(work, 'home'), USERPROFILE: join(work, 'home'),
        NODE_DISABLE_COMPILE_CACHE: '1', TZ: 'UTC', COLUMNS: '80', LC_ALL: 'C' };
    delete env.NODE_OPTIONS;
    delete env.NODE_COMPILE_CACHE;
    delete env.NODE_PATH;
    return env;
}

function fixtureSet(work: string, profiles: string[]) {
    const fixtures: Record<string, unknown> = {};
    for (const profile of profiles) fixtures[profile] = createProfile(join(work, profile), DIMENSIONS[profile]!);
    return fixtures;
}

function measureCase(artifact: Artifact, work: string, snapshotRoot: string, spec: BenchmarkCase, count: number): Measurement {
    const runtime = join(work, 'runtime'), config = join(work, 'config');
    fs.rmSync(runtime, { recursive: true, force: true });
    fs.mkdirSync(runtime);
    fs.mkdirSync(config, { recursive: true });
    const input = inputFor(spec, work, DIMENSIONS[spec.profile]!, Date.now());
    fs.writeFileSync(join(config, 'claude-statusline.json'), JSON.stringify(input.display));
    fs.writeFileSync(join(config, 'claude-statusline-runtime.json'), '{"schema_version":2,"native_timing":true,"live_metrics":true}');
    const request = join(work, 'input.json'), worker = fileURLToPath(new URL('./installed-worker.js', import.meta.url));
    fs.writeFileSync(request, JSON.stringify({ installed: artifact.root, input }));
    const env = environment(work), cache = new CacheSnapshot(runtime, snapshotRoot);
    const invoke = (phase: string) => {
        const result = spawnSync(process.execPath, [worker, request, phase], { cwd: work, env, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
        if (result.error) throw result.error;
        assert.equal(result.status, 0, spec.name + ': ' + result.stderr);
        assert.equal(result.stderr, '', 'Diagnostic polluted stderr');
        return JSON.parse(result.stdout);
    };
    if (spec.operation === 'render' || spec.operation === 'usage' && spec.cache !== 'cold' || spec.operation === 'git') invoke('prepare');
    if (spec.cache === 'miss') fs.rmSync(join(runtime, 'git_cache'), { recursive: true, force: true });
    cache.capture();
    const history = fs.statSync(input.history), originalSize = history.size;
    const prepare = () => {
        cache.restore();
        refreshGitCache(runtime, spec.cache === 'expired');
        if (spec.cache === 'append') {
            let append = input.append;
            if (spec.name.endsWith('/replay')) append = record(0);
            if (spec.name.endsWith('/increment')) append = record(0).replace('"input_tokens":12', '"input_tokens":13');
            fs.appendFileSync(input.history, append);
        }
    };
    const cleanup = () => {
        if (spec.cache === 'append') {
            fs.truncateSync(input.history, originalSize);
            fs.utimesSync(input.history, history.atime, history.mtime);
        }
    };
    let diagnostic: Measurement['diagnostic'];
    prepare();
    try {
        const value = invoke('diagnose');
        diagnostic = { output_sha256: spec.mode === 'command' ? commandSignature(input.command, value.stdout, runtime) : value.output_sha256, counts: value.counts };
        if (spec.operation === 'usage' && spec.cache === 'warm') assert.equal(value.counts.transcript_reads, 0, 'Warm cache reread the transcript');
        if (spec.operation === 'git' && spec.cache === 'hit') assert.equal(value.counts.git_calls, 0, 'Git cache hit launched Git');
        if (spec.operation === 'render') {
            assert.equal(value.counts.usage_calls, 1, 'Repeated display items collected usage twice');
            assert.equal(value.counts.transcript_reads, 0, 'Warm render reread the transcript');
            assert.equal(value.counts.git_calls, 0, 'Warm render launched Git');
        }
    } finally { cleanup(); }
    const samples: Sample[] = [], rssPath = join(work, 'peak-rss.txt');
    for (let index = 0; index < count; index++) {
        prepare();
        try {
            const command = spec.mode === 'command' ? [join(artifact.root, 'bin/claude-statusline.js'), input.command] : [worker, request, 'measure'];
            const start = performance.now();
            const result = spawnSync('/usr/bin/time', ['-f', '%M', '-o', rssPath, process.execPath, ...command], {
                cwd: work, env, input: input.raw, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024,
            });
            const elapsed = performance.now() - start;
            if (result.error) throw result.error;
            assert.equal(result.status, 0, spec.name + ': ' + result.stderr);
            assert.equal(result.stderr, '', 'Measured process polluted stderr');
            const value = spec.mode === 'command' ? null : JSON.parse(result.stdout);
            const sample = {
                ms: value?.ms ?? elapsed,
                peak_rss_bytes: Number(fs.readFileSync(rssPath, 'utf8').trim()) * 1024,
                output_sha256: value?.output_sha256 ?? commandSignature(input.command, result.stdout, runtime),
            };
            assert(Number.isFinite(sample.ms) && sample.ms >= 0 && Number.isFinite(sample.peak_rss_bytes) && sample.peak_rss_bytes > 0, 'Invalid measurement');
            assert.equal(sample.output_sha256, diagnostic!.output_sha256, 'Measured output differs from diagnostic');
            samples.push(sample);
        } finally { cleanup(); }
    }
    return { case: spec.name, mode: spec.mode, samples, ...summarize(samples), diagnostic: diagnostic! };
}

function begin(output: string, profiles: string[], samples: number, validation: boolean) {
    assert.equal(process.platform, 'linux', 'Installed RSS measurement currently requires Linux GNU time');
    assert(profiles.length > 0 && new Set(profiles).size === profiles.length && profiles.every(profile => DIMENSIONS[profile]), 'Invalid profiles');
    assert(Number.isInteger(samples) && samples >= 1 && samples <= 1000, 'Invalid sample count');
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const dirty = !!execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    assert(validation || !dirty, 'Measurement requires a clean committed harness');
    fs.accessSync('/usr/bin/time', fs.constants.X_OK);
    fs.mkdirSync(output, { mode: 0o700 });
    const work = join(output, 'work');
    fs.mkdirSync(work);
    return { schema_version: 2, kind: validation ? 'PERF-01 exploratory installed measurement' : 'PERF-01 installed measurement', performance_gate: false,
        method: { command: 'Fresh installed bin via GNU time; elapsed includes the external supervisor',
            in_process: 'One action per fresh worker; priming and snapshot restoration occur in other processes',
            rss: 'GNU time child maximum resident set, KiB converted to bytes; not V8 heap',
            cold: 'Empty product cache; filesystem page cache is not dropped', diagnostics: 'Separate instrumented invocation, excluded from timing', compile_cache: false },
        harness_commit: commit, harness_dirty: dirty, harness_hashes: sourceHashes(), node: process.version,
        node_sha256: sha256(fs.readFileSync(process.execPath)), system: { platform: process.platform, arch: process.arch, release: release(), cpu: cpus()[0]?.model },
        fixtures: fixtureSet(work, profiles), work };
}

function finish(report: ReturnType<typeof begin>, artifacts: Artifact[]): void {
    for (const artifact of artifacts) verifyInstalled(artifact);
    assert.deepEqual(sourceHashes(), report.harness_hashes, 'Harness changed during measurement');
}

export function benchmarkInstalled(artifactPath: string, output: string, profiles: string[], samples: number, validation = false, caseName?: string) {
    const report = begin(output, profiles, samples, validation), artifact = unpackArtifact(resolve(artifactPath), join(output, 'installed'));
    const selected = INSTALLED_CASES.filter(spec => profiles.includes(spec.profile) && (!caseName || spec.name === caseName));
    assert(selected.length, 'No matching installed cases');
    const records = selected.map(spec => {
        const value = measureCase(artifact, report.work, join(output, 'snapshot'), spec, samples);
        console.log(JSON.stringify({ case: spec.name, p50_ms: value.p50_ms, peak_rss_mib: value.peak_rss_bytes / 1048576 }));
        return value;
    });
    finish(report, [artifact]);
    const result = { ...report, artifact, records };
    fs.writeFileSync(join(output, 'report.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
}

export function compareInstalled(baselinePath: string, candidatePath: string, output: string, profiles: string[], samples: number, validation = false) {
    const report = begin(output, profiles, samples, validation);
    const artifacts = { baseline: unpackArtifact(resolve(baselinePath), join(output, 'baseline')), candidate: unpackArtifact(resolve(candidatePath), join(output, 'candidate')) };
    const runs: Run[] = [];
    for (let round = 0; round < 3; round++) {
        const order = round % 2 ? ['candidate', 'baseline'] as const : ['baseline', 'candidate'] as const;
        const records = { baseline: [] as Measurement[], candidate: [] as Measurement[] };
        for (const spec of INSTALLED_CASES.filter(spec => profiles.includes(spec.profile))) for (const side of order) {
            const value = measureCase(artifacts[side], report.work, join(output, 'snapshot'), spec, samples);
            records[side].push(value);
            console.log(JSON.stringify({ round, side, case: spec.name, p50_ms: value.p50_ms }));
            fs.writeFileSync(join(output, 'progress.json'), JSON.stringify({ round, side, case: spec.name }) + '\n');
        }
        for (const side of order) runs.push({ round, side, records: records[side] });
        fs.writeFileSync(join(output, `round-${round}.json`), JSON.stringify(records, null, 2) + '\n');
    }
    const comparisons = runs[0]!.records.map(row => {
        const values = (side: string) => runs.filter(run => run.side === side).map(run => run.records.find(record => record.case === row.case)!);
        const before = values('baseline'), after = values('candidate');
        assert(before.every((value, index) => value.diagnostic.output_sha256 === after[index]!.diagnostic.output_sha256), 'Baseline/candidate output differs: ' + row.case);
        const metrics = Object.fromEntries((['p50_ms', 'p95_ms', 'peak_rss_bytes'] as const).map(metric => {
            const baseline = before.map(value => value[metric]), candidate = after.map(value => value[metric]);
            const noise = Math.max(...baseline) - Math.min(...baseline);
            return [metric, { baseline, candidate, baseline_range: noise, consistently_higher_than_baseline_range: baseline.every((value, index) => candidate[index]! - value > noise) }];
        }));
        return { case: row.case, metrics, baseline_counts: before.map(value => value.diagnostic.counts), candidate_counts: after.map(value => value.diagnostic.counts) };
    });
    finish(report, Object.values(artifacts));
    const result = { ...report, kind: validation ? 'PERF-01 exploratory installed comparison' : 'PERF-01 installed comparison', artifacts, runs, comparisons };
    fs.writeFileSync(join(output, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
}
