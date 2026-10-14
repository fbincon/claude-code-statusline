export interface RecordSample {
    ms: number;
    peak_rss_bytes: number;
    counts: Record<string, number>;
    output_sha256: string;
}
export interface Batch {
    samples: RecordSample[];
    p50: number;
    p95: number;
    peak_rss: number;
}
export interface Policy {
    samples: number;
    rounds: number;
    maximum_additional_round_sets: number;
    modes: string[];
    profiles: Record<string, number[]>;
    peak_rss_increment_bytes: number;
    command: Record<string, number>;
    in_process: Record<string, number>;
}
export function median(values: readonly number[]): number { const v = [...values].sort((a, b) => a - b); return (v[Math.floor((v.length - 1) / 2)]! + v[Math.floor(v.length / 2)]!) / 2; }
export function batch(samples: RecordSample[]): Batch {
    const ordered = samples.map(row => row.ms).sort((a, b) => a - b);
    return { samples, p50: median(ordered), p95: ordered[Math.ceil(ordered.length * .95) - 1]!, peak_rss: Math.max(...samples.map(row => row.peak_rss_bytes)) };
}
export function evaluate(rows: {
    baseline: Batch;
    candidate: Batch;
}[], kind: 'command' | 'in_process', policy: Policy) {
    if (rows.length !== policy.rounds)
        throw new Error('Incomplete D06 rounds');
    return (['p50', 'p95', 'peak_rss'] as const).map(metric => {
        const bs = rows.map(row => row.baseline[metric]), cs = rows.map(row => row.candidate[metric]);
        const limits = bs.map(value => value + (metric === 'peak_rss' ? policy.peak_rss_increment_bytes : Math.max(value * policy[kind][metric + '_ratio']!, policy[kind][metric + '_floor_ms']!)));
        const exceeded = cs.map((value, i) => value > limits[i]!), noise = Math.max(...bs) - Math.min(...bs);
        const state = !exceeded.some(Boolean) ? 'pass' : exceeded.every(Boolean) && median(cs) - median(bs) > noise ? 'fail' : 'inconclusive';
        return { metric, baseline: median(bs), candidate: median(cs), budget: median(limits), baseline_range: noise, exceeded_rounds: exceeded.filter(Boolean).length, state };
    });
}
