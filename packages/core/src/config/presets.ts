import { SCENARIO_ROWS, SCENARIO_SCHEMES, scenarioPreset } from './scenario-presets.js';
import type { DisplayDraft, InstanceDraft } from '../contracts/ui.js';
import { defaultItem, defaultSubagents } from './display.js';
import { updateDisplay } from './instances.js';
import { fail } from './validation.js';
import { DEFAULT_POWERLINE } from './defaults.js';

export const ROWS = {
  ...SCENARIO_ROWS,
  'left-right': [['model-with-effort', 'git', 'spacer', 'context-remaining']],
  'repeated-metrics': [['input-tokens', 'input-tokens']],
  minimal: [['model-with-effort', 'current-dir', 'context-remaining', 'task-timer']],
  developer: [['model-with-effort', 'current-dir', 'git'], ['context-remaining', 'tokens', 'task-timer', 'session-cost']],
  monitoring: [['context-used', 'five-hour-limit', 'weekly-limit', 'spend-limit'], ['five-hour-reset', 'weekly-reset', 'cache-state', 'cache-expires'], ['session-cost', 'session-duration', 'api-duration', 'api-requests', 'cache-misses']],
  'multi-agent': [['model-with-effort', 'current-dir', 'git'], ['context-remaining', 'tokens', 'task-timer']],
  'daily-development': [['model-with-effort', 'current-dir', 'git', 'context-remaining', 'task-timer'], ['session-cost']],
  'agent-focus': [['task-timer', 'context-remaining', 'git'], ['run-state', 'task-progress', 'active-agents']],
  'quota-watch': [['context-used', 'five-hour-limit', 'weekly-limit'], ['five-hour-reset', 'weekly-reset'], ['session-cost', 'spend-limit', 'cache-state', 'cache-expires']],
} as const;
export const COMPLETE_SCHEMES = ['daily-development', 'agent-focus', 'quota-watch', ...SCENARIO_SCHEMES] as const;
/** Ordered presentation metadata extends the existing preset registry. */
export const PRESET_PRESENTATION = ['developer', 'minimal', 'monitoring', 'multi-agent', 'left-right', 'repeated-metrics', ...COMPLETE_SCHEMES].map(id => ({
  id, purpose_key: 'quick.purpose.' + id, requirements_key: 'quick.requirements.' + id,
  example: id === 'left-right' || id === 'repeated-metrics',
}));
export function applyPreset(config: DisplayDraft, name: string, nextId: () => string): DisplayDraft {
  if (!Object.hasOwn(ROWS, name)) fail('errors.presets.unknown_preset_choose', { value0: Object.keys(ROWS).join(', ') });
  if (SCENARIO_SCHEMES.includes(name as keyof typeof SCENARIO_ROWS)) return scenarioPreset(config, name as keyof typeof SCENARIO_ROWS);
  const complete = (COMPLETE_SCHEMES as readonly string[]).includes(name);
  const nodes: InstanceDraft[] = [];
  const rows = ROWS[name as keyof typeof ROWS].map(row => row.map(type_id => {
    const id = nodes.every(node => node.id !== type_id) ? type_id : nextId();
    const options = defaultItem();
    if (type_id !== 'spacer') options.priority = 100 - nodes.length;
    if (name === 'repeated-metrics') options.formatting = { number_format: nodes.length ? 'compact' : 'full' };
    if (complete) {
      options.max_width = type_id === 'current-dir' ? 16 : type_id === 'git' ? (name === 'daily-development' ? 20 : 32) : null;
      // Keep essential source labels; omit redundant catalog descriptions.
      if (['five-hour-limit','weekly-limit','five-hour-reset','weekly-reset','spend-limit','session-cost','cache-state','cache-expires','run-state','task-progress','active-agents'].includes(type_id))
        options.formatting.labels = 'legacy';
      if (type_id === 'git') options.icon = 'G';
      if (type_id === 'task-timer') options.priority = 100;
      if (type_id.startsWith('context-')) options.priority = 99;
      if (type_id === 'five-hour-limit') options.priority = 100;
    }
    nodes.push({ id, type_id, enabled: !(name === 'daily-development' && type_id === 'session-cost'), options, text: null });
    return id;
  }));
  const subagents = defaultSubagents(); subagents.enabled = config.subagents.enabled;
  if (name === 'multi-agent') Object.assign(subagents, { hide_completed: true, row_limit: 6, task_max_width: 48 });
  if (name === 'left-right') subagents.instances = ['status', 'name', 'spacer', 'elapsed'].map(id => ({ id, type_id: id, enabled: true, options: defaultItem(), text: null }));
  if (name === 'agent-focus') {
    Object.assign(subagents, { hide_completed: true, row_limit: null, task_max_width: 48 });
    subagents.instances = ['status', 'name', 'model-with-effort', 'context-remaining', 'elapsed', 'task'].map((id, index) => ({
      id, type_id: id, enabled: true, text: null,
      options: { ...defaultItem(), priority: 100 - index * 5, max_width: id === 'name' ? 24 : null },
    }));
  }
  return updateDisplay(config, { instances: nodes, subagents, groups: [],
    ...(complete ? { theme: 'terminal', palette: 'default', separator_style: 'compact', directory_style: 'project-relative',
      powerline_glyph: 'ascii', powerline: { ...DEFAULT_POWERLINE }, use_colors: true } : {}),
    layout: { mode: name === 'minimal' ? 'auto' : 'explicit', rows: name === 'minimal' ? [] : rows },
    formatting: { ...config.formatting, model_name: 'short', number_format: 'compact',
      ...(complete ? { labels: 'off', icons: 'ascii', allowance: 'remaining', reset_format: 'countdown',
        reset_timezone: 'local', thresholds: { enabled: true, warning: 70, critical: 90 } } : {}) },
  });
}
