import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CoveragePlan, CoverageProducer } from '../checks/ci-coverage.js';
import { ACTIONS_PREPARATION_MS, ACTIONS_UPLOAD_MS, HANDOFF_MS, HOSTED_JOB_MS, PLATFORM_SOURCE_MS, RUNTIME_SOURCE_MS,
    officialHistoryProfilePhases, requireHostedBudget, supervisionBudget, type AcceptancePhase } from './budgets.js';
import { installedPhases } from './installed-plan.js';

export function sourcePhases(platform: boolean): AcceptancePhase[] {
    const budgetMs = platform ? PLATFORM_SOURCE_MS : RUNTIME_SOURCE_MS;
    return ['isolated', 'serial'].map(name => ({ name, budgetMs }));
}

export const STABILITY_PHASE = { name: 'windows-native-stability', budgetMs: 30_000 + 10 * (180_000 + HANDOFF_MS) + HANDOFF_MS };
export function requiresStability(os: string, host: string): boolean {
    return os === 'windows-2025' && ['2.1.289', '2.1.294'].includes(host);
}

/** Official tests admit one independently bounded command at a time. Reserve
 * the entire selected history and stability workers before starting any batch. */
export function officialPhases(windows: boolean, depth: 'full' | 'short', stable: boolean) {
    const history = officialHistoryProfilePhases(windows, depth);
    const remaining = supervisionBudget(history) + (stable ? supervisionBudget([STABILITY_PHASE]) : 0);
    const overhead = supervisionBudget([{ name: 'official', budgetMs: 0 }]);
    const budgetMs = HOSTED_JOB_MS - ACTIONS_PREPARATION_MS - ACTIONS_UPLOAD_MS - remaining - overhead;
    if (budgetMs < 600_000 + HANDOFF_MS) throw new Error('The official installed-binding command cannot fit; partition the work');
    return { official: { name: 'official', budgetMs }, history };
}
export function admitOfficialCommand(started: number, budgetMs: number, commandMs: number, now = performance.now()): void {
    if (now - started + commandMs + HANDOFF_MS > budgetMs)
        throw new Error('Official acceptance window exhausted before the next command; split this producer');
}

type Job = Pick<CoverageProducer, 'stage' | 'depth' | 'os' | 'host' | 'job_key'>;
/** The candidate checks every planned actor before matrix dispatch. Workers
 * use this same bound, including setup/upload and both real source groups. */
export function physicalJobBudget(spec: Job, languageCount: number): number {
    const windows = spec.os.startsWith('windows-');
    assert(Number.isSafeInteger(languageCount) && languageCount > 0);
    let work: number;
    if (spec.job_key === 'mods') {
        assert(spec.host && spec.stage === 'complete');
        const stable = requiresStability(spec.os, spec.host), phases = officialPhases(windows, spec.depth, stable);
        work = supervisionBudget([phases.official]) + supervisionBudget(phases.history) + (stable ? supervisionBudget([STABILITY_PHASE]) : 0);
    } else {
        assert.equal(spec.host, null);
        const withSource = spec.stage === 'installed' || spec.stage === 'complete';
        work = supervisionBudget(installedPhases(windows, languageCount, undefined, spec)) +
            (withSource ? supervisionBudget(sourcePhases(spec.job_key === 'installed')) : 0);
    }
    requireHostedBudget(work, 0); return work + ACTIONS_PREPARATION_MS + ACTIONS_UPLOAD_MS;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const [path] = process.argv.slice(2); assert(path && process.argv.length === 3, 'Require one coverage plan file');
    const plan: CoveragePlan = JSON.parse(readFileSync(path, 'utf8'));
    assert(plan.schema_version === 2 && plan.kind === 'coverage-plan' && plan.producers.length);
    const { sectionInputsAt, sourceContract } = await import('../checks/ci-section-evidence.js');
    const languages = sourceContract(sectionInputsAt(plan.head)).languages.length;
    const maxima = new Map<string, { producer: string; minutes: number }>();
    for (const spec of plan.producers) {
        let ms: number;
        try { ms = physicalJobBudget(spec, languages); }
        catch (error) { throw new Error('Physical budget rejected before dispatch: ' + spec.id, { cause: error }); }
        const key = spec.job_key + '/' + spec.stage, minutes = ms / 60_000;
        if (!maxima.has(key) || minutes > maxima.get(key)!.minutes) maxima.set(key, { producer: spec.id, minutes });
    }
    console.log(JSON.stringify({ kind: 'physical-budget-preflight', commit: plan.head, languages, producers: plan.producers.length,
        limit_minutes: HOSTED_JOB_MS / 60_000, maximum_by_job_and_stage: Object.fromEntries(maxima) }));
}
