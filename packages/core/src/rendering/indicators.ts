/** Pure short bars: observations and direction remain independent of presentation. */
import type { FormattingDraft, ItemOptionsDraft, Scope } from '../contracts/ui.js';
import { supportsIndicator } from '../editor/indicators.js';
import { object } from '../runtime/values.js';
import { finiteNumber, liveRateWindow } from './metrics.js';
import { roundedInteger } from '../runtime/transcript.js';
import type { Presentation } from './language.js';

export function indicator(data: unknown, id: string, scope: Scope, options: ItemOptionsDraft, fmt: FormattingDraft, language: Presentation, now: number): string | null {
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
    phrase = language.text(remaining ? 'context.remaining' : 'context.used', { percentage: agentPercentage ?? roundedInteger(value) });
  } else {
    const names: Record<string, string> = { 'five-hour-limit': 'five_hour', 'weekly-limit': 'weekly', 'spend-limit': 'spend' };
    const windows: Record<string, string> = { 'five-hour-limit': 'five_hour', 'weekly-limit': 'seven_day', 'spend-limit': 'spend_limit' };
    const window = liveRateWindow(data, windows[id]!, now);
    value = window ? finiteNumber(window.used_percentage) : null;
    if (value === null) return null;
    if (remaining) value = Math.max(0, 100 - value);
    phrase = language.text(remaining ? 'limit.remaining' : 'limit.used', { label: language.text('limit.' + names[id]), value: roundedInteger(value) });
  }
  const width = options.bar_width ?? 8, filled = Math.round(Math.min(100, Math.max(0, value)) * width / 100);
  const ascii = options.bar_style === 'ascii' || (options.bar_style ?? 'auto') === 'auto' && fmt.icons === 'ascii';
  return '[' + (ascii ? '#' : '█').repeat(filled) + (ascii ? '-' : '░').repeat(width - filled) + '] ' + phrase;
}
