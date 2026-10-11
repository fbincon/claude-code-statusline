import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { platform, machine, release } from 'node:os';
import { packageRoot, exportReference, python, reference, cli, sha, sourceHashes } from './context.js';

type Batch = { ms: number[]; rss: number[]; p50: number; p95: number; peak_rss: number };
function percentile(values: number[], p: number): number { return [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]!; }
function median(values: number[]): number { const v = [...values].sort((a,b) => a-b); return (v[Math.floor((v.length-1)/2)]! + v[Math.floor(v.length/2)]!) / 2; }
const output = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass a new report directory');
mkdirSync(output, { recursive: false });
const policyBytes = readFileSync(join(packageRoot, 'policy.json'));
const policy = JSON.parse(policyBytes.toString());
const oracle = exportReference();
const config = join(packageRoot, 'fixtures/model.json');
const fixture = JSON.parse(readFileSync(join(packageRoot, 'fixtures/render.json'), 'utf8'));
const raw = fixture.source_case.input.stdin;
const baseEnv = { ...process.env, TS02_REFERENCE_ROOT: oracle, TS02_MEASURE: '1', CLAUDE_CONFIG_DIR: join(output, 'config'), CLAUDE_STATUSLINE_RUNTIME_DIR: join(output, 'runtime'), PYTHONUTF8: '1', PYTHONPYCACHEPREFIX: join(output, 'warm-bytecode') };
const records: { mode: string; round: number; baseline: Batch; candidate: Batch }[] = [];
const measuredSources = sourceHashes();
try {
  execFileSync(python, ['-m', 'compileall', '-q', join(oracle, 'src')], { env: { ...baseEnv, PYTHONDONTWRITEBYTECODE: '' } });
  function batch(side: string, mode: string): Batch {
    const ms: number[] = [], rss: number[] = [];
    const env = { ...baseEnv, PYTHONDONTWRITEBYTECODE: '1', PYTHONPYCACHEPREFIX: join(output, mode === 'warm' ? 'warm-bytecode' : 'empty-bytecode') };
    const executable = side === 'baseline' ? python : process.execPath;
    const args = side === 'baseline' ? [join(packageRoot, 'scripts/oracle.py'), 'render', config, '80'] : [cli, 'render', config, '80'];
    for (let n = 0; n < policy.samples; n++) {
      const start = performance.now();
      const value = spawnSync(executable, args, { input: raw, env, encoding: 'utf8', timeout: 15000 });
      const elapsed = performance.now() - start;
      if (value.status !== 0 || value.stdout !== fixture.expected.stdout) throw new Error(`Invalid measured render: ${value.stderr}`);
      const metrics = JSON.parse(value.stderr.trim());
      if (!(metrics.peak_rss_bytes > 0)) throw new Error('Missing RSS');
      ms.push(elapsed); rss.push(metrics.peak_rss_bytes);
    }
    return { ms, rss, p50: median(ms), p95: percentile(ms, 0.95), peak_rss: Math.max(...rss) };
  }
  for (const mode of policy.modes) for (let round = 0; round < policy.rounds; round++) {
    const pair: Record<string, Batch> = {};
    for (const side of round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) pair[side] = batch(side, mode);
    records.push({ mode, round, baseline: pair.baseline!, candidate: pair.candidate! });
    process.stdout.write(`${mode} round ${round + 1} complete\n`);
  }
  const summaries = policy.modes.map((mode: string) => {
    const rows = records.filter(r => r.mode === mode);
    const metrics = ['p50', 'p95', 'peak_rss'].map(key => {
      const get = (b: Batch) => b[key as 'p50' | 'p95' | 'peak_rss'];
      const bs = rows.map(r => get(r.baseline)), cs = rows.map(r => get(r.candidate));
      const limits = bs.map(b => key === 'peak_rss' ? b + policy.peak_rss_increment_bytes : b + Math.max(b * policy.command[key + '_ratio'], policy.command[key + '_floor_ms']));
      const exceeded = cs.map((c,i) => c > limits[i]!);
      const noise = Math.max(...bs) - Math.min(...bs);
      const state = !exceeded.some(Boolean) ? 'pass' : exceeded.every(Boolean) && median(cs) - median(bs) > noise ? 'fail' : 'inconclusive';
      return { metric: key, baseline: median(bs), candidate: median(cs), budget: median(limits), baseline_range: noise, state };
    });
    return { mode, metrics };
  });
  const controls: Record<string, { ms: number[]; p50_ms: number; p95_ms: number }> = {};
  for (const [name, executable, args] of [
    ['node-startup', process.execPath, ['-e', '']],
    ['python-startup', python, ['-c', '']],
    ['node-native-clock-load', process.execPath, [cli, 'clock', String(process.pid)]],
    ['python-native-clock-load', python, [join(packageRoot, 'scripts/oracle.py'), 'clock', String(process.pid)]],
  ] as [string, string, string[]][]) {
    const ms: number[] = [];
    for (let i = 0; i < policy.samples; i++) {
      const start = performance.now(); const result = spawnSync(executable, args, { env: baseEnv, encoding: 'utf8', timeout: 15000 });
      if (result.status !== 0) throw new Error(`Control failed: ${result.stderr}`);
      ms.push(performance.now() - start);
    }
    controls[name] = { ms, p50_ms: median(ms), p95_ms: percentile(ms, .95) };
  }
  if (JSON.stringify(measuredSources) !== JSON.stringify(sourceHashes())) throw new Error('Probe sources changed during measurement');
  const report = { format_version: 1, scope: 'minimal-model-render-only', reference, policy_sha256: sha(policyBytes), source_hashes: measuredSources, node: process.version, python: execFileSync(python, ['--version'], { encoding: 'utf8' }).trim(), platform: platform(), host_arch: machine(), process_arch: process.arch, os: release(), records, summaries, controls,
    unmeasured: ['full production render/hook', 'small/medium/large collectors and Agents', 'in-process workloads'], repeat_sets_used: 0 };
  writeFileSync(join(output, 'benchmark.json'), JSON.stringify(report, null, 2) + '\n');
  if (summaries.some((s: { metrics: { state: string }[] }) => s.metrics.some(m => m.state !== 'pass'))) process.exitCode = 1;
} finally { rmSync(oracle, { recursive: true, force: true }); }
