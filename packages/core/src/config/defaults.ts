import type { DisplayDraft, SubagentDraft, ItemOptionsDraft, FormattingDraft, InstanceDraft } from '../contracts/ui.js';
import { ITEM_DEFAULTS, FORMAT_DEFAULTS } from './generated-constants.js';
import { defaultItems } from './catalog.js';

export const DEFAULT_ITEM: ItemOptionsDraft = { ...ITEM_DEFAULTS, formatting: {} };
export const DEFAULT_FORMATTING: FormattingDraft = { ...FORMAT_DEFAULTS, thresholds: { ...FORMAT_DEFAULTS.thresholds } };
function instance(id: string): InstanceDraft {
  return { id, type_id: id, enabled: true, options: { ...DEFAULT_ITEM, formatting: {} }, text: null };
}
export const DEFAULT_SUBAGENTS: SubagentDraft = {
  enabled: true, visibility: 'all', hide_completed: false, row_limit: null, task_max_width: null,
  instances: defaultItems('subagent').map(instance),
};
export const DEFAULT_POWERLINE: DisplayDraft['powerline'] = {
  padding: 'both', separator: 'arrow', start_cap: false, end_cap: true, color_mode: 'semantic',
};
export const DEFAULT_DISPLAY: DisplayDraft = {
  schema_version: 9, use_colors: true, palette: 'default', directory_style: 'full', separator_style: 'classic',
  scope_labels: 'when-subagents', statusline_language: 'en', theme: 'classic', powerline_glyph: 'ascii', powerline: DEFAULT_POWERLINE,
  subagents: DEFAULT_SUBAGENTS, formatting: DEFAULT_FORMATTING,
  layout: { mode: 'auto', rows: [] }, metrics: { branch_diff_base_ref: null },
  instances: defaultItems('main').map(instance),
};
