import type { ConfigRow, ConfigValue } from 'claude-code';
import type { LocalizedText } from './i18n/index.ts';

/** Actual config-menu row IDs differ from persisted settings keys. */
export const PREFERENCE_SPECS = [
  { id: 'theme', keys: ['theme'], label: 'Theme', group: 'Claude appearance', entry: '/config theme' },
  { id: 'verbose', keys: ['verbose'], label: 'Verbose output', group: 'Claude appearance', entry: '/config verbose' },
  { id: 'showTurnDuration', keys: ['turnDuration', 'showTurnDuration'], label: 'Show turn duration', group: 'Claude appearance', entry: '/config' },
  { id: 'prefersReducedMotion', keys: ['reduceMotion', 'prefersReducedMotion'], label: 'Reduce motion', group: 'Claude appearance', entry: '/config' },
  { id: 'spinnerTipsEnabled', keys: ['tips', 'spinnerTipsEnabled'], label: 'Spinner tips', group: 'Claude appearance', entry: '/config' },
  { id: 'terminalProgressBarEnabled', keys: ['progressBar', 'terminalProgressBarEnabled'], label: 'Terminal progress bar', group: 'Claude appearance', entry: '/config' },
  { id: 'preferredNotifChannel', keys: ['notifChannel', 'preferredNotifChannel'], label: 'Notification channel', group: 'Claude appearance', entry: '/config' },
  { id: 'timeFormat', keys: ['timeFormat'], label: 'Time format', group: 'Claude time / title', entry: '/config timeFormat (24-hour-utc selects UTC)' },
  { id: 'timeZone', keys: ['timeZone'], label: 'Time zone', group: 'Claude time / title', entry: '/config timeFormat or official settings reference' },
  { id: 'title', keys: ['terminalTitle', 'terminalTitleEnabled'], label: 'Terminal title', group: 'Claude time / title', entry: 'Official settings reference: terminal title preferences' },
  { id: 'model', keys: ['model'], label: 'Model behavior', group: 'Claude behavior', entry: '/model' },
  { id: 'effort', keys: ['effort', 'effortLevel'], label: 'Reasoning effort', group: 'Claude behavior', entry: '/effort' },
  { id: 'thinking', keys: ['thinking'], label: 'Thinking behavior', group: 'Claude behavior', entry: '/config' },
  { id: 'fast', keys: ['fast', 'fastMode'], label: 'Fast mode behavior', group: 'Claude behavior', entry: '/fast' },
] as const;

export interface Preference {
  row: ConfigRow;
  baseline: ConfigValue;
  value: ConfigValue;
  result: string;
  localizedResult?: LocalizedText;
}

export function specFor(preference: Preference) {
  return PREFERENCE_SPECS.find((spec) => (spec.keys as readonly string[]).includes(preference.row.key));
}

export function preferences(rows: readonly ConfigRow[]): Preference[] {
  return PREFERENCE_SPECS.flatMap((spec) => {
    const row = rows.find((row) => (spec.keys as readonly string[]).includes(row.key));
    return row ? [{ row: { ...row }, baseline: row.value, value: row.value, result: '' }] : [];
  });
}

export function canEdit(preference: Preference): boolean {
  const row = preference.row;
  return !row.isLocked && (
    (row.kind === 'choice' && typeof row.value === 'string' && !!row.options?.length && row.options.every((s) => typeof s === 'string')) ||
    (row.kind === 'boolean' && typeof row.value === 'boolean') ||
    (row.kind === 'text' && typeof row.value === 'string') ||
    (row.kind === 'number' && typeof row.value === 'number' && Number.isFinite(row.value)));
}

export function validPreferenceValue(preference: Preference): boolean {
  const row = preference.row, value = preference.value;
  return canEdit(preference) && (
    row.kind === 'boolean' ? typeof value === 'boolean' :
    row.kind === 'choice' ? typeof value === 'string' && !!row.options?.includes(value) :
    row.kind === 'number' ? typeof value === 'number' && Number.isFinite(value) :
    typeof value === 'string' && value.length <= 256 && !/[\x00-\x1f\x7f]/.test(value));
}

export function preferenceChanged(preference: Preference): boolean {
  return JSON.stringify(preference.value) !== JSON.stringify(preference.baseline);
}
