import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { cpus, machine, release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { decode } from '@fbincon/statusline-core/json';
import { sourceHashes, repoRoot, python, reference, exportReference } from '../common.js';
import { CASES, createProfile, inputFor, type BenchmarkCase, type Input } from './fixtures.js';
import { batch, evaluate, median, type RecordSample, type Batch, type Policy } from './policy.js';
const outputArg = process.argv[2], validation = process.argv[3] === '--validate';
const repeatPath = process.argv[3] === '--repeat-of' ? process.argv[4] : undefined;
if (!outputArg || process.argv.length > 3 && !validation && !repeatPath)
    throw new Error('Usage: benchmark NEW_DIRECTORY [--validate | --repeat-of REPORT]');
if (process.platform !== 'linux' || process.version !== 'v24.21.0')
    throw new Error('Fixed byte/performance reference requires Linux / Node 24.21.0');
const pythonVersion = execFileSync(python, ['--version'], { encoding: 'utf8' }).trim();
if (pythonVersion !== 'Python 3.14.4')
    throw new Error('Fixed Python 3.14.4 is required');
const output = resolve(outputArg), policyBytes = readFileSync(join(repoRoot, 'tools/migration/ts-02/policy.json')), policy = JSON.parse(policyBytes.toString()) as Policy;
if (policy.samples !== 50 || policy.rounds !== 3 || policy.maximum_additional_round_sets !== 1)
    throw new Error('Frozen D06 policy changed');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim());
if (!validation && dirty)
    throw new Error('Commit the exact benchmark/candidate/test graph before D06 measurement');
function measuredHashes() {
    const hashes = sourceHashes();
    hashes['tools/migration/ts-02/policy.json'] = sha256(policyBytes);
    for (const root of ['packages/core/dist/src', 'packages/platform/dist/src', 'packages/cli/dist/src', 'dist/typescript/tools/migration/ts-03/performance'])
        for (const item of readdirSync(join(repoRoot, root), { recursive: true }).map(String).filter(path => path.endsWith('.js'))) {
            const path = root + '/' + item.replaceAll('\\', '/');
            hashes[path] = sha256(readFileSync(join(repoRoot, path)));
        }
    return Object.fromEntries(Object.entries(hashes).sort());
}
const sources = measuredHashes();
const observationTime = Date.now();
let repeat: {
    parent_sha256: string;
    repeat_sets_used: number;
} | null = null;
if (repeatPath) {
    const bytes = readFileSync(repeatPath), previous = JSON.parse(bytes.toString());
    if (previous.repeat_sets_used !== 0 || previous.reference !== reference || previous.policy_sha256 !== sha256(policyBytes) || JSON.stringify(previous.source_hashes) !== JSON.stringify(sources) || previous.summaries.some((s: any) => s.metrics.some((m: any) => m.state === 'fail')) || !previous.summaries.some((s: any) => s.metrics.some((m: any) => m.state === 'inconclusive')))
        throw new Error('Repeat is not authorized by D06');
    repeat = { parent_sha256: sha256(bytes), repeat_sets_used: 1 };
    writeFileSync(realpathSync(repeatPath) + '.repeat-reservation.json', JSON.stringify({ ...repeat, output, policy_sha256: sha256(policyBytes) }) + '\n', { flag: 'wx', mode: 0o600 });
}
mkdirSync(output, { recursive: false, mode: 0o700 });
const oracle = exportReference();
const candidate = fileURLToPath(new URL('./candidate.js', import.meta.url)), baseline = join(repoRoot, 'tools/migration/ts-03/performance/oracle.py');
const records: {
    case: string;
    mode: string;
    round: number;
    baseline: Batch;
    candidate: Batch;
}[] = [];
const fixtureMetadata: Record<string, unknown> = {};
const warmed = new Set<string>();
const pythonExecutable = execFileSync(python, ['-c', 'import sys;print(sys.executable)'], { encoding: 'utf8' }).trim();
const runtime = { node: process.version, node_sha256: sha256(readFileSync(process.execPath)), python: pythonVersion, python_sha256: sha256(readFileSync(pythonExecutable)), platform: process.platform, host_arch: machine(), process_arch: process.arch, os: release(), cpu: cpus()[0]?.model };
try {
    const fixtures = join(output, 'fixtures');
    mkdirSync(fixtures);
    for (const [profile, dimensions] of Object.entries(policy.profiles))
        fixtureMetadata[profile] = createProfile(join(fixtures, profile), dimensions);
    for (const side of ['baseline', 'candidate']) {
        const root = join(output, side);
        mkdirSync(root);
        for (const profile of Object.keys(policy.profiles))
            cpSync(join(fixtures, profile), join(root, profile), { recursive: true, preserveTimestamps: true });
        mkdirSync(join(root, 'config'));
    }
    const baseEnv = { ...process.env, TS03_REFERENCE_ROOT: oracle, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1', NODE_DISABLE_COMPILE_CACHE: '1', TZ: 'UTC', COLUMNS: '80', HOME: '/benchmark/home', USERPROFILE: '/benchmark/home' };
    delete (baseEnv as NodeJS.ProcessEnv).NODE_COMPILE_CACHE;
    const warmBytecode = join(output, 'warm-bytecode');
    execFileSync(python, ['-m', 'compileall', '-q', join(oracle, 'src'), baseline], { env: { ...baseEnv, PYTHONPYCACHEPREFIX: warmBytecode, PYTHONDONTWRITEBYTECODE: '' }, timeout: 60000 });
    function setup(spec: BenchmarkCase, side: string, mode: string) {
        const root = join(output, side), input = inputFor(spec, root, policy.profiles[spec.profile]!, observationTime), path = join(output, spec.name.replaceAll('/', '-') + '-' + side + '.json');
        const runtimeRoot = join(root, 'runtime');
        rmSync(runtimeRoot, { recursive: true, force: true });
        mkdirSync(runtimeRoot);
        writeFileSync(path, JSON.stringify(input));
        writeFileSync(join(root, 'config/claude-statusline.json'), JSON.stringify(input.display));
        writeFileSync(join(root, 'config/claude-statusline-runtime.json'), '{"schema_version":2,"native_timing":true,"live_metrics":true}');
        const env = { ...baseEnv, PYTHONPYCACHEPREFIX: mode === 'warm' ? warmBytecode : join(output, 'empty-bytecode'), CLAUDE_CONFIG_DIR: join(root, 'config'), CLAUDE_STATUSLINE_RUNTIME_DIR: runtimeRoot, CLAUDE_STATUSLINE_SESSIONS_DIR: join(root, 'sessions') };
        const runtimeSnapshot = join(root, 'primed-runtime');
        rmSync(runtimeSnapshot, { recursive: true, force: true });
        if (spec.mode === 'command' && spec.operation === 'render') {
            const prime = spawnSync(side === 'baseline' ? python : process.execPath, [side === 'baseline' ? baseline : candidate, path, 'prepare'], { env, encoding: 'utf8', timeout: 120000 });
            if (prime.status !== 0 || JSON.parse(prime.stdout).prepared !== true)
                throw new Error('Cache preparation failed: ' + prime.stderr);
            cpSync(runtimeRoot, runtimeSnapshot, { recursive: true, preserveTimestamps: true });
        }
        return { input, path, env, runtimeSnapshot };
    }
    function expectedCounts(spec: BenchmarkCase, input: Input) {
        return { usage_calls: ['render', 'usage'].includes(spec.operation) ? 1 : 0,
            // A fresh legacy cache also performs the one-time lifecycle/usage migrations.
            transcript_reads: spec.operation === 'usage' ? spec.cache === 'cold' ? 3 + input.agents * 2 : spec.cache === 'append' ? 1 : 0 : 0,
            git_calls: spec.operation === 'git' && spec.cache !== 'hit' ? 1 : 0 };
    }
    function assertCounts(spec: BenchmarkCase, input: Input, sample: RecordSample) {
        const expected = expectedCounts(spec, input);
        if (JSON.stringify(sample.counts) !== JSON.stringify(expected))
            throw new Error('Unexpected collection count: ' + spec.name + ' ' + JSON.stringify({ actual: sample.counts, expected }));
        if (!(sample.peak_rss_bytes > 0) || !Number.isFinite(sample.ms) || sample.ms < 0)
            throw new Error('Invalid sample');
    }
    function collect(spec: BenchmarkCase, side: string, mode: string): Batch {
        let run = setup(spec, side, mode);
        const samples: RecordSample[] = [], size = validation ? 1 : policy.samples;
        const executable = side === 'baseline' ? python : process.execPath, args = [side === 'baseline' ? baseline : candidate, run.path, 'measure', String(size)];
        if (side === 'baseline' && mode === 'warm' && !warmed.has(spec.name)) {
            const prime = spawnSync(executable, [...args.slice(0, -1), '1'], { input: run.input.raw, env: { ...run.env, PYTHONDONTWRITEBYTECODE: '' }, encoding: 'utf8', timeout: 120000 });
            if (prime.status !== 0)
                throw new Error('Warm bytecode preparation failed: ' + spec.name + ' ' + prime.stderr);
            warmed.add(spec.name);
            run = setup(spec, side, mode);
        }
        if (spec.mode === 'in_process') {
            const result = spawnSync(executable, args, { env: run.env, encoding: 'utf8', timeout: 600000, maxBuffer: 4 * 1024 * 1024 });
            if (result.status !== 0 || result.stderr)
                throw new Error('In-process worker failed: ' + spec.name + ' ' + result.stderr);
            const measured = JSON.parse(result.stdout);
            samples.push(...measured.records);
        }
        else
            for (let index = 0; index < size; index++) {
                const runtimeRoot = run.env.CLAUDE_STATUSLINE_RUNTIME_DIR!;
                rmSync(runtimeRoot, { recursive: true, force: true });
                if (existsSync(run.runtimeSnapshot)) {
                    cpSync(run.runtimeSnapshot, runtimeRoot, { recursive: true, preserveTimestamps: true });
                    const cache = join(runtimeRoot, 'git_cache');
                    for (const name of readdirSync(cache).filter(name => name.endsWith('.json'))) {
                        const path = join(cache, name), value = decode(readFileSync(path, 'utf8')) as Record<string, unknown>;
                        value.checked_ns = BigInt(Date.now()) * 1000000n;
                        writeFileSync(path, pythonJson(value, { compact: true }));
                    }
                }
                else
                    mkdirSync(runtimeRoot);
                const start = performance.now(), result = spawnSync(executable, args, { input: run.input.raw, env: run.env, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 }), elapsed = performance.now() - start;
                if (result.status !== 0)
                    throw new Error('Command worker failed: ' + spec.name + ' ' + result.stderr);
                const measured = JSON.parse(result.stderr.trim());
                if (spec.operation === 'hook' && JSON.stringify(measured.signature) !== JSON.stringify({ records: 1, status: 'running', prompt_id: 'p' }))
                    throw new Error('Hook did not persist the expected lifecycle state');
                samples.push({ ms: elapsed, peak_rss_bytes: measured.peak_rss_bytes, counts: measured.counts, output_sha256: sha256(result.stdout) });
            }
        if (samples.length !== size)
            throw new Error('Incorrect sample count');
        for (const sample of samples)
            assertCounts(spec, run.input, sample);
        if (new Set(samples.map(sample => sample.output_sha256)).size !== 1)
            throw new Error('Repeated output changed: ' + spec.name);
        return batch(samples);
    }
    const modes = validation ? ['warm'] : policy.modes;
    for (const mode of modes)
        for (let round = 0; round < (validation ? 1 : policy.rounds); round++)
            for (const spec of CASES) {
                const pair: Record<string, Batch> = {};
                for (const side of round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'])
                    pair[side] = collect(spec, side, mode);
                if (pair.baseline!.samples[0]!.output_sha256 !== pair.candidate!.samples[0]!.output_sha256)
                    throw new Error('Python/TS measured output mismatch: ' + spec.name);
                const row = { case: spec.name, mode, round, baseline: pair.baseline!, candidate: pair.candidate! };
                records.push(row);
                appendFileSync(join(output, 'rounds.jsonl'), JSON.stringify(row) + '\n');
                process.stdout.write(`${mode} ${round + 1} ${spec.name} complete\n`);
            }
    const startupControls: Record<string, {
        raw_ms: number[];
        p50_ms: number;
        p95_ms: number;
    }> = {};
    if (!validation)
        for (const mode of policy.modes) {
            const env = { ...baseEnv, PYTHONPATH: join(oracle, 'src'), PYTHONPYCACHEPREFIX: mode === 'warm' ? warmBytecode : join(output, 'empty-bytecode') };
            for (const [name, executable, args] of [
                ['node-startup', process.execPath, ['-e', '']], ['python-startup', python, ['-c', '']],
                ['node-native-clock', process.execPath, ['--input-type=module', '-e', "const {sample}=await import('@fbincon/statusline-platform/clocks');sample();"]],
                ['python-native-clock', python, ['-c', 'from claude_statusline.platforms.clocks import now_clocks;now_clocks()']],
            ] as [
                string,
                string,
                string[]
            ][]) {
                const raw_ms: number[] = [];
                if (mode === 'warm' && name.startsWith('python'))
                    execFileSync(executable, args, { env: { ...env, PYTHONDONTWRITEBYTECODE: '' }, stdio: 'pipe', timeout: 15000 });
                for (let index = 0; index < policy.samples; index++) {
                    const start = performance.now(), result = spawnSync(executable, args, { env, encoding: 'utf8', timeout: 15000 });
                    if (result.status !== 0 || result.stdout || result.stderr)
                        throw new Error('Runtime control failed: ' + name);
                    raw_ms.push(performance.now() - start);
                }
                startupControls[mode + '/' + name] = { raw_ms, p50_ms: median(raw_ms), p95_ms: [...raw_ms].sort((a, b) => a - b)[Math.ceil(raw_ms.length * .95) - 1]! };
            }
        }
    for (const [profile, metadata] of Object.entries(fixtureMetadata)) for (const [path, hash] of Object.entries((metadata as { hashes: Record<string, string> }).hashes)) {
        for (const side of ['fixtures', 'baseline', 'candidate']) if (sha256(readFileSync(join(output, side, profile, path))) !== hash) throw new Error('Measured transcript fixture changed: ' + side + '/' + profile + '/' + path);
    }
    if (JSON.stringify(measuredHashes()) !== JSON.stringify(sources))
        throw new Error('Executed source graph changed during measurement');
    const summaries = validation ? [] : policy.modes.flatMap(mode => CASES.map(spec => ({ case: spec.name, mode, metrics: evaluate(records.filter(row => row.case === spec.name && row.mode === mode), spec.mode, policy) })));
    const state = validation ? 'fixture-validation-only' : summaries.some(row => row.metrics.some(metric => metric.state === 'fail')) ? 'fail' : summaries.some(row => row.metrics.some(metric => metric.state === 'inconclusive')) ? 'inconclusive' : 'pass';
    const report = { format_version: 1, scope: 'TS-03 migrated backend; installed distribution/terminal acceptance remains TS-04/05', state, reference, commit, dirty, source_hashes: sources, policy_sha256: sha256(policyBytes), runtime, fixtures: fixtureMetadata, cases: CASES, records, summaries, samples: validation ? 1 : policy.samples, rounds: validation ? 1 : policy.rounds, repeat_sets_used: repeat?.repeat_sets_used ?? 0, repeat_of_sha256: repeat?.parent_sha256 ?? null,
        startup_controls: startupControls, observation_time_ms: observationTime,
        controls: 'Fresh process for every command sample; equal-size fresh-process batches for in-process samples; fixture/cache preparation excluded. Collector calls and output hashes checked for every sample. Peak RSS is the actual worker process high-water mark; no summed child peaks. Cold/warm Python bytecode use separate cache roots. No TypeScript compile cache. Startup/native-load controls are descriptive and do not replace the full-workload gates.',
        remaining_release_gates: ['Installed-package performance and terminal acceptance in TS-04/05', 'Approved physical/desktop release-before gates'] };
    writeFileSync(join(output, 'benchmark.json'), JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ state, cases: CASES.length, comparisons: summaries.length }) + '\n');
    if (!validation && state !== 'pass')
        process.exitCode = 1;
}
catch (error) {
    writeFileSync(join(output, 'failure.json'), JSON.stringify({ error: String(error), commit, dirty, source_hashes: sources, policy_sha256: sha256(policyBytes), runtime, records }, null, 2) + '\n');
    throw error;
}
finally {
    rmSync(oracle, { recursive: true, force: true });
}
