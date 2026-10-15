import { readFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
export function measure(action: () => void, count: number, prepare = () => { }, cleanup = () => { }, clock = () => performance.now()) {
    if (!Number.isInteger(count) || count < 1 || count > 10000)
        throw new Error('Invalid sample count');
    const raw_ms: number[] = [];
    for (let i = 0; i < count; i++) {
        prepare();
        try {
            const start = clock();
            action();
            raw_ms.push(clock() - start);
        }
        finally {
            cleanup();
        }
    }
    const sorted = [...raw_ms].sort((a, b) => a - b), quantile = (p: number) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]!;
    return { raw_ms, p50_ms: quantile(.5), p95_ms: quantile(.95) };
}
export async function runPairs<T>(cases: readonly string[], order: readonly string[], run: (side: string, name: string) => Promise<T>) {
    const records: {
        side: string;
        name: string;
        result: T;
    }[] = [];
    for (const name of cases)
        for (const side of order)
            records.push({ side, name, result: await run(side, name) });
    return records;
}
export function reviewRegression(baseline: number[], candidate: number[]): boolean {
    if (baseline.length < 3 || baseline.length !== candidate.length || ![...baseline, ...candidate].every(Number.isFinite))
        throw new Error('Require matching finite round samples');
    const noise = Math.max(...baseline) - Math.min(...baseline);
    return baseline.every((before, index) => candidate[index]! - before > noise);
}
export function verifySource(root: string, hashes: Record<string, string>): string {
    if (!Object.keys(hashes).length)
        throw new Error('Empty source manifest');
    for (const [name, expected] of Object.entries(hashes)) {
        const path = resolve(root, name), rel = relative(root, path);
        if (rel.startsWith('..') || isAbsolute(rel) || !/^\w/.test(name))
            throw new Error('Unsafe source path');
        const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
        if (actual !== expected)
            throw new Error('Source does not match immutable manifest: ' + name);
    }
    return createHash('sha256').update(JSON.stringify(Object.entries(hashes).sort())).digest('hex');
}
