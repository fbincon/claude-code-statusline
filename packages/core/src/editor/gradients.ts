/** Presets are expanded into portable colors; saved gradients do not depend on a preset registry. */
import type { EditorField, GradientDraft } from '../contracts/ui.js';
export const GRADIENT_PRESETS = {
  ocean: ['#22d3ee', '#3b82f6'],
  sunset: ['#fb923c', '#f472b6', '#a78bfa'],
  aurora: ['#34d399', '#22d3ee', '#a78bfa'],
} as const;
export const GRADIENT_KEYS = ['foreground_gradient', 'background_gradient'] as const;
export const GRADIENT_DEFAULTS = { foreground_gradient: null, background_gradient: null };
export const GRADIENT_FIELDS: EditorField[] = GRADIENT_KEYS.map(key => ({
  key, label: key === 'foreground_gradient' ? 'Foreground gradient' : 'Powerline background gradient',
  group: 'Item colors', kind: 'text', choices: [], minimum: 0, maximum: 256, nullable: true,
}));
export function validGradient(value: unknown): value is GradientDraft | null {
  return value === null || Array.isArray(value) && value.length >= 2 && value.length <= 5 &&
    [...value].every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/iu.test(color));
}
export function parseGradient(value: unknown): GradientDraft | null {
  if (value === null || value === 'off' || value === 'inherit' || value === 'none') return null;
  if (typeof value === 'string') value = Object.hasOwn(GRADIENT_PRESETS, value)
    ? [...GRADIENT_PRESETS[value as keyof typeof GRADIENT_PRESETS]] : value.split(',').map(color => color.trim());
  if (!validGradient(value)) throw new Error('gradients.invalid');
  return value?.map(color => color.toLowerCase()) ?? null;
}
export function gradientName(value: unknown): string {
  if (value == null) return 'off';
  return Object.entries(GRADIENT_PRESETS).find(([, colors]) => JSON.stringify(colors) === JSON.stringify(value))?.[0] ?? String(value);
}
