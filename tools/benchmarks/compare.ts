/** Descriptive Node-to-Node comparison; does not reinterpret historical D06 gates. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { reviewRegression, runPairs, verifySource } from './engine.js';
export async function compareBenchmarks(baseline: string, candidate: string, output: string, samples: number, profiles: string) {
    for (const root of [baseline, candidate]) {
        if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) throw new Error('Both measurements require clean committed checkouts');
        fs.accessSync(join(root, 'dist/typescript/tools/benchmarks/run.js'));
    }
    fs.mkdirSync(output, { mode: 0o700 });
    const runs: any[] = [];
    for (let round = 0; round < 3; round++) {
        const order = round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'];
        runs.push(...await runPairs(['all-cases'], order, async side => {
            const root = side === 'baseline' ? baseline : candidate, directory = join(output, `${round}-${side}`);
            execFileSync(process.execPath, [join(root, 'dist/typescript/tools/benchmarks/run.js'), '--output', directory, '--samples', String(samples), '--profiles', profiles], { cwd: root, timeout: 3600000, maxBuffer: 8 * 1024 * 1024 });
            const report = JSON.parse(fs.readFileSync(join(directory, 'report.json'), 'utf8'));
            verifySource(root, report.source_hashes);
            return { round, ...report };
        }));
    }
    const names: string[] = runs[0].result.records.map((row: any) => row.case);
    const comparisons = names.map(name => {
        const median = (row: any) => row.p50_ms ?? [...row.records.map((r: any) => r.ms)].sort((a, b) => a - b)[Math.floor(row.records.length / 2)];
        const values = (side: string) => runs.filter(row => row.side === side).map(row => median(row.result.records.find((r: any) => r.case === name)));
        const before = values('baseline'), after = values('candidate');
        return { case: name, baseline_p50_ms: before, candidate_p50_ms: after, exceeds_baseline_variation_in_every_round: reviewRegression(before, after) };
    });
    const report = { schema_version: 1, performance_gate: false, method: 'Three alternating sequential Node rounds; startup/setup never overlaps the other side', runs, comparisons };
    fs.writeFileSync(join(output, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { baseline: { type: 'string' }, candidate: { type: 'string' }, 'baseline-artifact': { type: 'string' }, 'candidate-artifact': { type: 'string' }, output: { type: 'string' }, samples: { type: 'string', default: '30' }, profiles: { type: 'string', default: 'small,medium,large' }, validate: { type: 'boolean' } } });
    if (!values.output) throw new Error('Require --output NEW_DIRECTORY');
    let result;
    if (values['baseline-artifact'] || values['candidate-artifact']) {
        if (!values['baseline-artifact'] || !values['candidate-artifact'] || values.baseline || values.candidate) throw new Error('Supply both artifact paths without checkout options');
        result = (await import('./installed.js')).compareInstalled(values['baseline-artifact'], values['candidate-artifact'], resolve(values.output), values.profiles!.split(','), Number(values.samples), values.validate === true);
    } else {
        if (!values.baseline || !values.candidate) throw new Error('Require --baseline BUILT_CHECKOUT --candidate BUILT_CHECKOUT or both --baseline-artifact/--candidate-artifact');
        result = await compareBenchmarks(resolve(values.baseline), resolve(values.candidate), resolve(values.output), Number(values.samples), values.profiles!);
    }
    console.log(JSON.stringify({ cases: result.comparisons.length, performance_gate: false }));
}
