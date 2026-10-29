/** Display-only scenarios. No local binding, installation or source authorization is created. */
import type { DisplayDraft, InstanceDraft, Theme } from '../contracts/ui.js';
import { defaultItem, defaultSubagents } from './display.js';
import { updateDisplay } from './instances.js';
import { DEFAULT_POWERLINE } from './defaults.js';
import { supportsIndicator } from '../editor/indicators.js';
import { GRADIENT_PRESETS } from '../editor/gradients.js';

export const SCENARIO_ROWS = {
  'powerline-daily': [['model-with-effort', 'current-dir', 'git'], ['context-remaining', 'task-timer', 'session-cost']],
  'agent-workbench': [['task-timer', 'context-remaining', 'git'], ['run-state', 'task-progress', 'active-agents']],
  'quota-cost': [['five-hour-limit', 'weekly-limit'], ['five-hour-reset', 'weekly-reset'], ['context-used', 'spend-limit'], ['session-cost', 'session-cost-rate']],
  'narrow-terminal': [['model-with-effort', 'current-dir', 'context-remaining', 'task-timer']],
  'light-readable': [['model-with-effort', 'current-dir', 'git'], ['context-remaining', 'task-timer', 'session-cost']],
} as const;
export const SCENARIO_SCHEMES = Object.keys(SCENARIO_ROWS) as (keyof typeof SCENARIO_ROWS)[];
export function scenarioPreset(config: DisplayDraft, name: keyof typeof SCENARIO_ROWS): DisplayDraft {
  const narrow = name === 'narrow-terminal', agent = name === 'agent-workbench';
  const themes: Record<typeof name, Theme> = { 'powerline-daily': 'ocean', 'agent-workbench': 'slate', 'quota-cost': 'ember', 'narrow-terminal': 'terminal', 'light-readable': 'light' };
  const stops = name === 'light-readable' ? GRADIENT_PRESETS.petal : name === 'quota-cost' ? GRADIENT_PRESETS.copper : agent ? GRADIENT_PRESETS.sage : GRADIENT_PRESETS.lagoon;
  const instances: InstanceDraft[] = SCENARIO_ROWS[name].flat().map<InstanceDraft>((type_id, index) => ({
    id: type_id, type_id, enabled: true, text: null,
    options: { ...defaultItem(), priority: type_id === 'task-timer' ? 100 : type_id.startsWith('context-') || type_id === 'five-hour-limit' ? 99 : 90 - index,
      max_width: type_id === 'current-dir' ? (narrow ? 12 : 20) : type_id === 'git' ? 24 : null,
      ...(supportsIndicator('main', type_id) ? { presentation: 'adaptive' as const, bar_width: narrow ? 4 : 8 } : {}),
      formatting: Object.fromEntries(['five-hour-limit', 'weekly-limit', 'five-hour-reset', 'weekly-reset', 'spend-limit', 'session-cost', 'session-cost-rate', 'run-state', 'task-progress', 'active-agents'].includes(type_id) ? [['labels', 'legacy']] : []),
    },
  }));
  const subagents = defaultSubagents(); subagents.enabled = config.subagents.enabled;
  subagents.instances = (narrow ? ['status', 'name', 'context-remaining', 'elapsed'] : ['status', 'name', 'model-with-effort', 'context-remaining', 'elapsed', 'task']).map((type_id, index) => ({
    id: type_id, type_id, enabled: true, text: null,
    options: { ...defaultItem(), priority: 100 - index * 5, max_width: type_id === 'name' ? 24 : null,
      ...(supportsIndicator('subagent', type_id) ? { presentation: 'adaptive' as const, bar_width: narrow ? 4 : 8 } : {}) },
  }));
  if (agent) { subagents.hide_completed = true; subagents.row_limit = 6; subagents.task_max_width = 48; }
  const groups = agent ? [{ id: 'agent-activity', member_ids: ['run-state', 'task-progress', 'active-agents'], primary_id: 'run-state', link_visibility: true, shared_powerline: true }]
    : name === 'quota-cost' ? [{ id: 'context-spend', member_ids: ['context-used', 'spend-limit'], primary_id: 'context-used', link_visibility: false, shared_powerline: true }] : [];
  return updateDisplay(config, { instances, subagents, groups, theme: themes[name], use_colors: true, palette: 'default',
    separator_style: narrow ? 'compact' : 'powerline', directory_style: 'project-relative', powerline_glyph: 'ascii',
    powerline: { ...DEFAULT_POWERLINE, ...(narrow ? {} : { row_background_gradient: [...stops] }) },
    layout: { mode: narrow ? 'auto' : 'explicit', rows: narrow ? [] : SCENARIO_ROWS[name].map(row => [...row]),
      ...(name === 'quota-cost' ? { alignments: [{ id: 'quota-reset-columns', columns: [
        [{ kind: 'instance' as const, id: 'five-hour-limit' }, { kind: 'instance' as const, id: 'five-hour-reset' }],
        [{ kind: 'instance' as const, id: 'weekly-limit' }, { kind: 'instance' as const, id: 'weekly-reset' }],
      ] }] } : {}) },
    formatting: { ...config.formatting, model_name: 'short', number_format: 'compact', labels: narrow ? 'off' : 'short', icons: 'ascii', allowance: 'remaining', reset_format: 'countdown', reset_timezone: 'local', thresholds: { enabled: true, warning: 70, critical: 90 } },
  });
}
