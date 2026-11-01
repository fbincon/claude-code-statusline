import { ACTIONS_PREPARATION_MS, ACTIONS_UPLOAD_MS, HANDOFF_MS, HOSTED_JOB_MS, PLATFORM_SOURCE_MS, RUNTIME_SOURCE_MS,
    officialHistoryProfilePhases, supervisionBudget, type AcceptancePhase } from './budgets.js';

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
    return { official: { name: 'official', budgetMs }, history };
}
export function admitOfficialCommand(started: number, budgetMs: number, commandMs: number, now = performance.now()): void {
    if (now - started + commandMs + HANDOFF_MS > budgetMs)
        throw new Error('Official acceptance window exhausted before the next command; split this producer');
}
