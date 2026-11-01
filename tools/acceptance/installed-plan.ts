import { APPEARANCE_MS, APPEARANCE_SCHEMES, FIRST_ENTRY_MS, FIXTURE_CLEANUP_MS, FIXTURE_INSTALL_MS, HANDOFF_MS, historyProfileBudget, type AcceptancePhase } from './budgets.js';
import { languageAcceptanceBudget } from './language-budget.js';

export const APPEARANCE_CASE = 'installed adaptive indicators and scene schemes retain semantic and persistence contracts';
export const LANGUAGE_CASE = 'installed effective languages retain independent UI/output saves and read-only previews in all registered combinations';
export const HISTORY_CASE = 'installed version management survives published release roundtrips, interruption and separate restoration';
export type InstalledStage = 'complete' | 'installed' | 'language' | 'history';
export interface InstalledSelection { stage: InstalledStage; depth: 'full' | 'short' }
export function physicalSelection(env: NodeJS.ProcessEnv): InstalledSelection | undefined {
    const stage = env.TS05_PHYSICAL_STAGE, depth = env.TS05_PHYSICAL_DEPTH;
    if (!stage && !depth) return undefined;
    if (!(stage === 'complete' || stage === 'installed' || stage === 'language' || stage === 'history') ||
        !(depth === 'full' || depth === 'short') || env.TS05_DIAGNOSTIC_PATTERN)
        throw new Error('Invalid installed physical stage or history depth');
    return { stage, depth };
}
export function includesInstalledCase(stage: InstalledStage, name: string): boolean {
    const section = name === LANGUAGE_CASE ? 'language' : name === HISTORY_CASE ? 'history' : 'installed';
    return stage === 'complete' || stage === section;
}
export const appearancePhase = (scheme: string) => 'appearance/' + scheme;
export function installedPhases(windows: boolean, languages: number, pattern?: string, selection?: InstalledSelection): AcceptancePhase[] {
    // The previously unbounded journeys have individual envelopes calibrated on
    // successful ARM/x64 runs (e.g. #198 job 124463172951); long subprocesses
    // keep their own limits. Unknown or reordered cases cannot produce a receipt.
    const cases: [string, number][] = [
        [LANGUAGE_CASE, languageAcceptanceBudget(languages)],
        ['installed Git policy blocks repository programs without inventing a clean worktree', 70_000],
        ['installed first entry uses real npm and a durable binding beyond the npx cache lifetime', FIRST_ENTRY_MS],
        [HISTORY_CASE, historyProfileBudget(windows, selection?.depth ?? 'full')],
        ['installed terminal policy is shared by setup, configure and the Windows slash bridge', 600_000],
        ['installed selective imports preserve unselected sections, targets and source authority', 180_000],
        ['installed gradients preserve foreground, background, warning, group, Unicode and transfer behavior', 240_000],
        ['installed explicit-row alignment survives editing, hiding, transfers and narrow terminals', 420_000],
        ['installed draft history, structural repairs and reuse preserve revisions across save and reopen', 180_000],
        ['installed groups retain linked visibility, remapped copies and portable references', 180_000],
        ['installed indicators retain defaults, independent agent values and portable options', 180_000],
        ['installed derived rates retain denominators, the observation window and portable choices', 120_000],
        ['installed automatic policies remain separate from display and unsupported lifecycle work', 180_000],
        ['installed sources preserve opt-in, literal commands, portable isolation and OSC8 output', 240_000],
        ['private packed candidate contains only compiled business entry points and complete owned resources', 60_000],
        ['tests.integration.test_compatibility.CompatibilityTests.test_forwarded_functions_and_types_share_identity', 30_000],
        ['tests.integration.test_compatibility.CompatibilityTests.test_legacy_render_modules_match_cli_output', 360_000],
        ['tests.integration.test_compatibility.CompatibilityTests.test_legacy_terminal_entry_point_preserves_error_exit_code', 60_000],
        ['tests.integration.test_compatibility.CompatibilityTests.test_terminal_script_uses_package_root_after_relocation', 150_000],
        ['tests.integration.test_windows_shells.WindowsShellSmokeTests.test_installed_main_and_subagent_commands_match_in_both_shells', 300_000],
        ['installed native-editor protocol supports describe, preview, revision-bound save and portable export', 210_000],
        ['installed task viewer is available without installation and shares registered-language bounded reading', 60_000],
        ['installed setup checks, previews, cancels, saves and integrates in a real terminal', 90_000],
        ['installed external editor saves and cancels in a real native terminal', 45_000],
        ['installed recovery restores interrupted editor publication without Python', 120_000],
        ['installed candidate upgrades owned Python entry bytes while preserving opt-outs and the old environment', 120_000],
        ['installed source operations approve commands separately and protect reviewed binding cleanup', 300_000],
        [APPEARANCE_CASE, 0],
    ];
    // Node accepts both a raw expression and /expression/flags on this option.
    const literal = pattern?.match(/^\/(.*)\/([a-z]*)$/u);
    const filter = pattern ? new RegExp(literal?.[1] ?? pattern, literal?.[2]) : undefined;
    const selected = cases.filter(([name]) => (!filter || filter.test(name)) && (!selection || includesInstalledCase(selection.stage, name)));
    if (!selected.length) throw new Error('No installed acceptance cases match the diagnostic pattern');
    return [
        { name: 'verify-candidate', budgetMs: 60_000 },
        ...(windows ? [{ name: 'prepare-powershell', budgetMs: 60_000 + HANDOFF_MS }] : []),
        { name: 'install-fixture', budgetMs: FIXTURE_INSTALL_MS },
        ...selected.flatMap(([name, budgetMs]) => name === APPEARANCE_CASE ? [
            { name: appearancePhase('setup'), budgetMs: 30_000 + HANDOFF_MS },
            ...APPEARANCE_SCHEMES.map(scheme => ({ name: appearancePhase(scheme), budgetMs: APPEARANCE_MS + HANDOFF_MS })),
            { name: appearancePhase('verify'), budgetMs: HANDOFF_MS },
        ] : [{ name, budgetMs }]),
        { name: 'cleanup-and-report', budgetMs: FIXTURE_CLEANUP_MS },
    ];
}
