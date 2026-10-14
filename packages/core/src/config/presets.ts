import type { DisplayDraft, InstanceDraft } from '../contracts/ui.js';
import { defaultItem, defaultSubagents } from './display.js';
import { updateDisplay } from './instances.js';
import { fail } from './validation.js';

export const ROWS = {
  'left-right': [['model-with-effort', 'git', 'spacer', 'context-remaining']],
  'repeated-metrics': [['input-tokens', 'input-tokens']],
  minimal: [['model-with-effort', 'current-dir', 'context-remaining', 'task-timer']],
  developer: [['model-with-effort', 'current-dir', 'git'], ['context-remaining', 'tokens', 'task-timer', 'session-cost']],
  monitoring: [['context-used', 'five-hour-limit', 'weekly-limit', 'spend-limit'], ['five-hour-reset', 'weekly-reset', 'cache-state', 'cache-expires'], ['session-cost', 'session-duration', 'api-duration', 'api-requests', 'cache-misses']],
  'multi-agent': [['model-with-effort', 'current-dir', 'git'], ['context-remaining', 'tokens', 'task-timer']],
} as const;
export function applyPreset(config: DisplayDraft, name: string, nextId: () => string): DisplayDraft {
  if (!Object.hasOwn(ROWS, name)) fail('errors.presets.unknown_preset_choose', { value0: Object.keys(ROWS).join(', ') });
  const nodes: InstanceDraft[] = [];
  const rows = ROWS[name as keyof typeof ROWS].map(row => row.map(type_id => {
    const id = nodes.every(node => node.id !== type_id) ? type_id : nextId();
    const options = defaultItem();
    if (type_id !== 'spacer') options.priority = 100 - nodes.length;
    if (name === 'repeated-metrics') options.formatting = { number_format: nodes.length ? 'compact' : 'full' };
    nodes.push({ id, type_id, enabled: true, options, text: null });
    return id;
  }));
  const subagents = defaultSubagents(); subagents.enabled = config.subagents.enabled;
  if (name === 'multi-agent') Object.assign(subagents, { hide_completed: true, row_limit: 6, task_max_width: 48 });
  if (name === 'left-right') subagents.instances = ['status', 'name', 'spacer', 'elapsed'].map(id => ({ id, type_id: id, enabled: true, options: defaultItem(), text: null }));
  return updateDisplay(config, { instances: nodes, subagents, layout: { mode: name === 'minimal' ? 'auto' : 'explicit', rows: name === 'minimal' ? [] : rows }, formatting: { ...config.formatting, model_name: 'short', number_format: 'compact' } });
}
