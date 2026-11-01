import { INSTALLED_COMMAND_MS } from './budgets.js';
/** An admitted operation keeps its complete deadline, even at the end of a row. */
export const LANGUAGE_OPERATION_MS = INSTALLED_COMMAND_MS;
export const LANGUAGE_ROW_ADMISSION_MS = 180_000;
export const LANGUAGE_WORKER_EXIT_MS = 5_000;
export const LANGUAGE_ROW_MS = LANGUAGE_ROW_ADMISSION_MS + LANGUAGE_OPERATION_MS + 4 * LANGUAGE_WORKER_EXIT_MS + 10_000;
export function languageAcceptanceBudget(languages: number): number {
    if (!Number.isSafeInteger(languages) || languages < 1) throw new Error('Invalid language count');
    // Three real setup commands and resource initialization; each row can finish
    // its last command, close its reader and writer (including forced exit), and
    // record results. Final aggregation and publication have a separate reserve.
    return 4 * LANGUAGE_OPERATION_MS + languages * LANGUAGE_ROW_MS + LANGUAGE_OPERATION_MS;
}
export function admitLanguageOperation(start: number, label: string, now = performance.now()): void {
    if (now - start >= LANGUAGE_ROW_ADMISSION_MS) throw new Error('Language row admission expired before ' + label);
}
