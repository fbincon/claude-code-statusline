import nodeTest, { type TestOptions } from 'node:test';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { withinInstalledBudget } from './installed-admission.js';
import { APPEARANCE_CASE, includesInstalledCase, installedPhases, physicalSelection } from './installed-plan.js';
import { phaseAsync } from './installed-supervisor.js';

type Body = () => unknown;
const selection = physicalSelection(process.env);
const phases = new Map(installedPhases(process.platform === 'win32', LANGUAGES.length, undefined, selection).map(p => [p.name, p.budgetMs]));
export function installedCase(name: string, body: Body): void;
export function installedCase(name: string, options: TestOptions, body: Body): void;
export function installedCase(name: string, optionsOrBody: TestOptions | Body, body?: Body): void {
    if (selection && !includesInstalledCase(selection.stage, name)) return;
    const options = typeof optionsOrBody === 'function' ? {} : optionsOrBody;
    const run = typeof optionsOrBody === 'function' ? optionsOrBody : body!;
    nodeTest(name, options, async () => {
        // Each appearance subprocess is supervised independently; its five
        // original 120s limits are meaningful even when the worker blocks.
        if (name === APPEARANCE_CASE) { await run(); return; }
        const budget = phases.get(name); if (!budget) throw new Error('Missing installed phase budget: ' + name);
        await phaseAsync(name, () => withinInstalledBudget(name, budget, run));
    });
}
