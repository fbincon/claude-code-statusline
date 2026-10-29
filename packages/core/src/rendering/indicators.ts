/** Pure short bars: observations and direction remain independent of presentation. */
import type { FormattingDraft, ItemOptionsDraft, Scope } from '../contracts/ui.js';
import { supportsIndicator } from '../editor/indicators.js';
import { object } from '../runtime/values.js';
import { finiteNumber, liveRateWindow } from './metrics.js';
import { roundedInteger } from '../runtime/transcript.js';
import type { Presentation } from './language.js';
import type { Representation } from './fitting.js';
import { decorate } from './preferences.js';

function content(data: unknown, id: string, scope: Scope, options: ItemOptionsDraft, fmt: FormattingDraft, language: Presentation, now: number): { value: number; phrase: string } | null {
  if (!supportsIndicator(scope, id) || !object(data)) return null;
  let value: number | null = null;
  let agentPercentage: number | undefined;
  const remaining = id === 'context-remaining' || !id.startsWith('context-') && fmt.allowance === 'remaining';
  let phrase: string;
  if (id.startsWith('context-')) {
    if (scope === 'subagent') {
      const count = finiteNumber(data.tokenCount), capacity = finiteNumber(data.contextWindowSize);
      if (count !== null && capacity !== null && capacity > 0) {
        value = count * 100 / capacity;
        agentPercentage = Math.trunc(value + 0.5);
        if (remaining) agentPercentage = Math.min(100, Math.max(0, 100 - agentPercentage));
      }
      if (value !== null && remaining) value = Math.max(0, 100 - value);
    } else if (object(data.context_window)) {
      value = finiteNumber(data.context_window[remaining ? 'remaining_percentage' : 'used_percentage']);
      if (value !== null && value > 100) value = null;
    }
    if (value === null || !Number.isFinite(value)) return null;
    phrase = language.text(remaining ? 'indicator.remaining' : 'indicator.used', { percentage: agentPercentage ?? roundedInteger(value) });
  } else {
    const windows: Record<string, string> = { 'five-hour-limit': 'five_hour', 'weekly-limit': 'seven_day', 'spend-limit': 'spend_limit' };
    const window = liveRateWindow(data, windows[id]!, now);
    value = window ? finiteNumber(window.used_percentage) : null;
    if (value === null) return null;
    if (remaining) value = Math.max(0, 100 - value);
    phrase = language.text(remaining ? 'indicator.remaining' : 'indicator.used', { percentage: roundedInteger(value) });
  }
  return { value, phrase };
}
function present(value: { value: number; phrase: string }, id: string, scope: Scope, options: ItemOptionsDraft, fmt: FormattingDraft, language: Presentation, width: number | null): string {
  const filled = Math.round(Math.min(100, Math.max(0, value.value)) * (width ?? 0) / 100);
  const ascii = options.bar_style === 'ascii' || (options.bar_style ?? 'auto') === 'auto' && fmt.icons === 'ascii';
  const bar = width === null ? '' : '[' + (ascii ? '#' : '█').repeat(filled) + (ascii ? '-' : '░').repeat(width - filled) + ']';
  return decorate(value.phrase, id, scope, fmt, options, language, { bar, label: language.prefix(scope, id) });
}
export function indicator(data: unknown, id: string, scope: Scope, options: ItemOptionsDraft, fmt: FormattingDraft, language: Presentation, now: number): string | null {
  const value = content(data, id, scope, options, fmt, language, now);
  return value ? present(value, id, scope, options, fmt, language, options.bar_width ?? 8) : null;
}
export function adaptiveIndicator(data: unknown, id: string, scope: Scope, options: ItemOptionsDraft, fmt: FormattingDraft, language: Presentation, now: number): { text: string; adaptive: Representation[] } | null {
  const value = content(data, id, scope, options, fmt, language, now);
  if (!value) return null;
  const width = options.bar_width ?? 8, adaptive: Representation[] = [];
  let labels = fmt.labels;
  if (options.label === null) for (const next of ['short', 'off'] as const) {
    if (labels === 'off' || labels === next) continue;
    labels = next; adaptive.push({ stage: 0, text: present(value, id, scope, options, { ...fmt, labels }, language, width) });
  }
  const compact = { ...fmt, labels };
  for (let size = width - 1; size >= 4; size--) adaptive.push({ stage: 1, text: present(value, id, scope, options, compact, language, size) });
  adaptive.push({ stage: 2, text: present(value, id, scope, options, compact, language, null) });
  return { text: present(value, id, scope, options, fmt, language, width), adaptive };
}
