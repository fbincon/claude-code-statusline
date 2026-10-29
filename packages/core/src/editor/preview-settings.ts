/** Session-only controls; never part of a display draft or portable file. */
export const SCENARIO_IDS = ['normal', 'warning', 'critical', 'zero', 'missing', 'source-stale', 'source-failed', 'long-content', 'git-clean', 'git-modified', 'git-conflicted', 'no-agents', 'few-agents', 'many-agents'] as const;
export type PreviewScenario = typeof SCENARIO_IDS[number];
export const PREVIEW_WIDTHS = ['auto', '40', '80', '120'] as const;
export function isScenario(value: unknown): value is PreviewScenario { return typeof value === 'string' && (SCENARIO_IDS as readonly string[]).includes(value); }
export function previewWidth(available: number, requested: string): number { return Math.max(2, Math.min(available, requested === 'auto' ? available : Number(requested))); }
export function cyclePreview<T>(values: readonly T[], value: T, delta: number): T { return values[(values.indexOf(value) + delta + values.length) % values.length]!; }
