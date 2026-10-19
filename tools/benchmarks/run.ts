/** Optional Node-only functional/measurement harness. D06/PERF-01 policy is separate. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { repoRoot, sourceHashes } from '../migration/ts-03/common.js';
import { CASES, createProfile, inputFor } from '../migration/ts-03/performance/fixtures.js';
import { measure } from './engine.js';
const hash = (raw: Buffer | string) => createHash('sha256').update(raw).digest('hex');
export function benchmark(output: string, profiles = ['small'], samples = 1, validation = true, caseName?: string) {
    const dimensions: Record<string, readonly number[]> = { small: [100, 0, 32], medium: [10000, 8, 1000], large: [100000, 32, 10000] };
    if (!profiles.length || profiles.some(p => !dimensions[p]) || !Number.isInteger(samples) || samples < 1 || samples > 1000)
        throw new Error('Invalid benchmark profile or sample count');
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(), dirty = !!execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    if (!validation && dirty)
        throw new Error('Measurement requires a clean fixed source commit');
    fs.mkdirSync(output, { mode: 0o700 });
    const fixtures: Record<string, unknown> = {};
    for (const p of profiles)
        fixtures[p] = createProfile(join(output, p), dimensions[p]!);
    const selected = CASES.filter(c => profiles.includes(c.profile) && (!caseName || c.name === caseName));
    if (!selected.length)
        throw new Error('No matching benchmark cases');
    const worker = fileURLToPath(new URL('../migration/ts-03/performance/candidate.js', import.meta.url)), records = [];
    for (const spec of selected) {
        const config = join(output, 'config'), runtime = join(output, 'runtime');
        fs.mkdirSync(config, { recursive: true });
        fs.rmSync(runtime, { recursive: true, force: true });
        fs.mkdirSync(runtime);
        const input = inputFor(spec, output, dimensions[spec.profile]!, Date.now()), path = join(output, spec.name.replaceAll('/', '-') + '.json');
        fs.writeFileSync(path, JSON.stringify(input));
        fs.writeFileSync(join(config, 'claude-statusline.json'), JSON.stringify(input.display));
        fs.writeFileSync(join(config, 'claude-statusline-runtime.json'), '{"schema_version":2,"native_timing":true,"live_metrics":true}');
        const env = { ...process.env, CLAUDE_CONFIG_DIR: config, CLAUDE_STATUSLINE_RUNTIME_DIR: runtime, CLAUDE_STATUSLINE_SESSIONS_DIR: join(output, 'sessions'), HOME: join(output, 'home'), USERPROFILE: join(output, 'home'), NODE_DISABLE_COMPILE_CACHE: '1', TZ: 'UTC', COLUMNS: '80' };
        const invoke = (phase: string, count: number) => { const r = spawnSync(process.execPath, [worker, path, phase, String(count)], { env, input: input.raw, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 }); if (r.status !== 0)
            throw new Error('Benchmark worker failed: ' + r.stderr); return r; };
        const count = validation ? 1 : samples;
        if (spec.mode === 'in_process') {
            const value = JSON.parse(invoke('measure', count).stdout);
            for (const row of value.records) {
                if (!Number.isFinite(row.ms) || row.ms < 0 || row.peak_rss_bytes <= 0)
                    throw new Error('Invalid worker sample');
                if (spec.operation === 'usage' && spec.cache === 'warm' && row.counts.transcript_reads !== 0 || spec.operation === 'git' && spec.cache === 'hit' && row.counts.git_calls !== 0)
                    throw new Error('Cache hit performed extra collection');
            }
            records.push({ case: spec.name, ...value });
        }
        else {
            const outputs: {
                stdout_sha256: string;
                diagnostic: unknown;
            }[] = [];
            const prepare = () => { fs.rmSync(runtime, { recursive: true, force: true }); fs.mkdirSync(runtime); if (spec.operation === 'render')
                invoke('prepare', 1); };
            const timing = measure(() => { const r = invoke('measure', 1); outputs.push({ stdout_sha256: hash(r.stdout), diagnostic: JSON.parse(r.stderr.trim()) }); }, count, prepare);
            records.push({ case: spec.name, ...timing, outputs });
        }
    }
    const report = { schema_version: 1, kind: validation ? 'functional fixture validation' : 'Node-only descriptive measurement', performance_gate: false, commit, dirty, node: process.version, node_sha256: hash(fs.readFileSync(process.execPath)), source_hashes: sourceHashes(), fixtures, records };
    fs.writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, output: { type: 'string' }, profiles: { type: 'string', default: 'small' }, samples: { type: 'string', default: '1' }, validate: { type: 'boolean' }, case: { type: 'string' } } });
    if (!values.output)
        throw new Error('Require --output NEW_DIRECTORY');
    const result = values.artifact
        ? (await import('./installed.js')).benchmarkInstalled(values.artifact, resolve(values.output), values.profiles!.split(','), Number(values.samples), values.validate === true, values.case)
        : benchmark(resolve(values.output), values.profiles!.split(','), Number(values.samples), values.validate === true, values.case);
    console.log(JSON.stringify({ kind: result.kind, cases: result.records.length, performance_gate: false }));
}
