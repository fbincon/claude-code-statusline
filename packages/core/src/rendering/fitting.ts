/** Semantic alternatives are generated before layout; fitting never slices a retained indicator. */
import { displayWidth } from './layout.js';
export interface Representation { stage: 0 | 1 | 2; text: string }
export interface Fittable { text: string; priority?: number; adaptive?: readonly Representation[]; onAdapt?: (stage: Representation['stage']) => void }
export function adapt(values: readonly Fittable[], columns: number, occupied: () => number): void {
  const ordered = values.map((value, index) => ({ value, index })).sort((a, b) => (a.value.priority ?? 50) - (b.value.priority ?? 50) || b.index - a.index);
  for (const stage of [0, 1, 2] as const) for (const { value } of ordered) {
    for (const candidate of value.adaptive ?? []) {
      if (occupied() <= columns) return;
      if (candidate.stage === stage && displayWidth(candidate.text) < displayWidth(value.text)) { value.text = candidate.text; value.onAdapt?.(stage); }
    }
  }
}
export function bounded(value: Fittable, columns: number): void {
  adapt([value], columns, () => displayWidth(value.text));
  if (value.adaptive && displayWidth(value.text) > columns) value.text = '';
}
