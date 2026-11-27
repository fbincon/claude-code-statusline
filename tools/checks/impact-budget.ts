/** Scheduling policy for new scoped executions. Historical receipts never run this check. */
import assert from 'node:assert/strict';
import type { Check, ImpactPlan, ImpactTask } from './impact-plan.ts';

const MINUTE = 60_000;
export const SCOPED_COMMAND_MS = 15 * MINUTE;
export const SCOPED_HOSTED_JOB_MS = 360 * MINUTE;
export const SCOPED_MOD_VERSION_MS = 10_000;
export const SCOPED_MOD_VALIDATE_MS = 10 * MINUTE;
export const SCOPED_MOD_FILE_MS = 180_000;
const SETUP_UPLOAD_MS = 25 * MINUTE;
export function familyAdmissionMs(files: number): number {
    assert(Number.isSafeInteger(files) && files > 0, 'Empty scoped test family');
    // The previously accepted family window plus dispatch allowance for the
    // actual inventory. Only admission stops at its end; a running file keeps its own deadline.
    return SCOPED_COMMAND_MS + files * 5_000;
}
export function familyEnvelopeMs(files: number): number {
    return familyAdmissionMs(files) + SCOPED_COMMAND_MS + 80_000; // startup, two handoffs, exit
}
export function scopedSourceFiles(check: Check, paths: readonly string[]): string[] {
    const pkg = ['core', 'platform', 'cli', 'tui'].includes(check);
    const prefix = pkg ? 'packages/' + check + '/test/' : check === 'migration' ? 'tools/migration/' : 'tools/' + check + '/test/';
    return paths.filter(path => path.startsWith(prefix) && path.endsWith('.test.ts') && path !== 'tools/migration/ts-04/test/installed.test.ts')
        .map(path => (pkg ? path.replace('/test/', '/dist/test/') : 'dist/typescript/' + path).slice(0, -3) + '.js').sort();
}
export function scopedModFiles(check: 'native' | 'runtime' | 'agent-rows', paths: readonly string[]): string[] {
    const prefix = 'mods/statusline-' + check + '/';
    return paths.filter(path => path.startsWith(prefix) && /\.test\.[cm]?[jt]sx?$/u.test(path))
        .map(path => path.slice(prefix.length)).sort();
}
export function estimatedScopedTaskMs(task: ImpactTask, files: readonly string[]): number {
    let total = SETUP_UPLOAD_MS;
    if (task.checks.some(check => !['actions', 'docs', 'assets'].includes(check))) total += SCOPED_COMMAND_MS; // build, once
    for (const check of task.checks) {
        if (['actions', 'docs', 'assets', 'archive', 'approval'].includes(check)) total += SCOPED_COMMAND_MS;
        else if (check === 'packaging') total += 60 * MINUTE; // optional four 10m build commands and installation smoke
        else if (check === 'native' || check === 'runtime' || check === 'agent-rows') {
            if (files.includes('tools/checks/impact-mod-batches.ts')) {
                const admission = familyAdmissionMs(scopedModFiles(check, files).length);
                total += SCOPED_MOD_VERSION_MS + SCOPED_MOD_VALIDATE_MS + admission + SCOPED_MOD_FILE_MS;
                if (task.host !== '2.1.296') total += MINUTE + SCOPED_COMMAND_MS; // obtain exact declarations and run tsc
            } else total += 40 * MINUTE; // original source's Mod scheduling policy
        }
        else {
            if (check === 'generation') total += SCOPED_COMMAND_MS; // resources --check
            total += familyEnvelopeMs(scopedSourceFiles(check, files).length);
        }
    }
    return total;
}
export function scopedTaskBudget(task: ImpactTask, files: readonly string[]): number {
    const total = estimatedScopedTaskMs(task, files);
    assert(total <= SCOPED_HOSTED_JOB_MS, 'Scoped task ' + task.id + ' needs ' + Math.ceil(total / MINUTE) +
        ' minutes including setup and upload; partition the task before scheduling');
    return total;
}
export function checkScopedSchedule(plan: ImpactPlan, files: readonly string[]): void {
    if (plan.route === 'maintenance') for (const task of plan.tasks) scopedTaskBudget(task, files);
}
