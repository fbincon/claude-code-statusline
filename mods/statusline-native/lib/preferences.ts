import type { ConfigRow, ConfigValue } from 'claude-code';

export interface Preference {
  row: ConfigRow;
  baseline: ConfigValue;
  value: ConfigValue;
  result: string;
}

export function preferences(rows: readonly ConfigRow[]): Preference[] {
  return rows
    .filter((row) => row.key === 'theme' || row.key === 'verbose')
    .map((row) => ({
      row: { ...row },
      baseline: row.value,
      value: row.value,
      result: '',
    }));
}

export function canEdit(preference: Preference): boolean {
  const row = preference.row;
  return (
    !row.isLocked &&
    ((row.key === 'theme' &&
      row.kind === 'choice' &&
      typeof row.value === 'string' &&
      !!row.options?.length &&
      row.options.includes(row.value)) ||
      (row.key === 'verbose' &&
        row.kind === 'boolean' &&
        typeof row.value === 'boolean'))
  );
}

export function preferenceChanged(preference: Preference): boolean {
  return (
    JSON.stringify(preference.value) !== JSON.stringify(preference.baseline)
  );
}
