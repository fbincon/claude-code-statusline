/** One per-instance denominator, shared by both editors and storage validation. */
import type { EditorField, Scope } from '../contracts/ui.js';
export const COST_RATE_DEFAULTS = { cost_rate_basis: 'session' } as const;
export const COST_RATE_FIELD: EditorField = { key: 'cost_rate_basis', label: 'Cost rate denominator', group: 'Item format', kind: 'choice', choices: ['session', 'api'], minimum: 0, maximum: 0, nullable: false };
export function validCostRateOptions(value: Record<string, unknown>, scope?: Scope, id?: string): boolean {
    if (!Object.hasOwn(value, 'cost_rate_basis')) return true;
    return (!scope || scope === 'main' && id === 'session-cost-rate') && (value.cost_rate_basis === 'session' || value.cost_rate_basis === 'api');
}
