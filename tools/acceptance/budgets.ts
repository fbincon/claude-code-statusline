/** Integration-test envelopes. The product and the original release receipt deadlines stay fixed. */
export const INSTALLED_COMMAND_MS = 30_000;
export const VERSION_OPERATION_MS = 360_000;
export const VERSION_SEQUENCE_MS = 900_000;
export const OFFICIAL_VERSION_SEQUENCE_MS = 1_200_000;
export const VERSION_EDITOR_EXECUTION_MS = 900_000;
export const OFFICIAL_VERSION_EDITOR_EXECUTION_MS = 1_200_000;

export const HANDOFF_MS = 10_000;
export const WORKER_START_MS = 30_000;
export const WORKER_EXIT_MS = 30_000;
export const FIXTURE_INSTALL_MS = 240_000; // verify/copy + offline npm's 180s + publication
export const FIXTURE_CLEANUP_MS = 60_000;
export const FIRST_ENTRY_MS = 180_000 + 2 * 10_000 + FIXTURE_CLEANUP_MS;
export const APPEARANCE_MS = 120_000;
export const APPEARANCE_SCHEMES = ['powerline-daily', 'agent-workbench', 'quota-cost', 'narrow-terminal', 'light-readable'] as const;

export function versionChildBudget(version: '3.7.0' | '3.8.0', official: boolean): number {
    const baseline = official ? OFFICIAL_VERSION_SEQUENCE_MS : VERSION_SEQUENCE_MS;
    const editor = official ? OFFICIAL_VERSION_EDITOR_EXECUTION_MS : VERSION_EDITOR_EXECUTION_MS;
    return supervisionBudget([{ name: 'baseline', budgetMs: baseline }, ...(version === '3.8.0' ? [{ name: 'editor_execution', budgetMs: editor }] : [])]);
}
export function versionManagementBudget(windows: boolean, official = false): number {
    // Each archive can take three independently bounded 60s reads plus backoff;
    // extraction, process handoff, trace publication and cleanup also take time.
    const prepare = 210_000;
    const sequences = (['3.7.0', '3.8.0'] as const).map(version =>
        prepare + versionChildBudget(version, official) + FIXTURE_CLEANUP_MS);
    return (windows ? sequences[0]! + sequences[1]! : Math.max(...sequences)) + HANDOFF_MS;
}

export function officialTransitionPhases(windows: boolean): AcceptancePhase[] {
    return [{ name: 'official-install', budgetMs: FIXTURE_INSTALL_MS },
        { name: 'official-histories', budgetMs: versionManagementBudget(windows, true) },
        { name: 'official-cleanup-and-report', budgetMs: FIXTURE_CLEANUP_MS }];
}


export type AcceptancePhase = { name: string; budgetMs: number };
export const WORKER_OVERHEAD = { start: WORKER_START_MS, handoff: HANDOFF_MS, exit: WORKER_EXIT_MS };
export function supervisionBudget(phases: readonly AcceptancePhase[], overhead = WORKER_OVERHEAD): number {
    // Match the watchdog's allowance for a delivered end and for the next start.
    return overhead.start + phases.reduce((total, phase) => total + phase.budgetMs + 2 * overhead.handoff, 0) + overhead.exit + WORKER_EXIT_MS; // Independent final log drain and diagnostic publication.
}
export const VERSION_MANAGEMENT_MS = versionManagementBudget(process.platform === 'win32');
export const OFFICIAL_TRANSITION_MS = supervisionBudget(officialTransitionPhases(process.platform === 'win32'));
/** Leave room for Actions checkout/setup/download and final receipt upload on hosted jobs. */
export const HOSTED_JOB_MS = 360 * 60_000;
export const ACTIONS_PREPARATION_MS = 15 * 60_000;
export const ACTIONS_UPLOAD_MS = 10 * 60_000;
export const RUNTIME_SOURCE_MS = 600_000;
export const PLATFORM_SOURCE_MS = 30 * 60_000;
export function requireHostedBudget(workerMs: number, remainingWorkMs: number): void {
    if (![workerMs, remainingWorkMs].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid hosted acceptance budget');
    if (workerMs + remainingWorkMs + ACTIONS_PREPARATION_MS + ACTIONS_UPLOAD_MS > HOSTED_JOB_MS)
        throw new Error('Selected acceptance cannot fit the hosted job with setup, source checks and upload; partition the work');
}
