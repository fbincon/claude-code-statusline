import type { Draft, HostDraft } from '../contracts/ui.js';
import { object, fail, ConfigError } from './validation.js';
import { integer, safeInteger } from '../json.js';
import { validateDisplay, isSchema, SCHEMA_VERSION } from './display.js';

export const DEFAULT_HOST: HostDraft = { padding: 0, refresh_interval: 1, hide_vim_mode_indicator: false };
export function requestObject(value: unknown, keys: readonly string[], name: string): asserts value is Record<string, unknown> {
  if (!object(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) {
    throw new ConfigError('errors.protocol.must_be_an_object_containing_exactly', { name, value1: keys.join(', ') }, 'invalid_request');
  }
}
export function validateDraft(value: unknown, requireCurrent = false): Draft {
  requestObject(value, ['display', 'host'], 'draft');
  const display = validateDisplay(value.display);
  if (requireCurrent && (!object(value.display) || !isSchema(value.display.schema_version, SCHEMA_VERSION))) {
    fail('errors.protocol.apply_requires_the_complete_schema_v_draft', { SCHEMA_VERSION });
  }
  requestObject(value.host, ['padding', 'refresh_interval', 'hide_vim_mode_indicator'], 'host');
  try { integer(value.host.padding); } catch { fail('errors.protocol.padding_must_be_an_integer_and_hide'); }
  if (typeof value.host.hide_vim_mode_indicator !== 'boolean') fail('errors.protocol.padding_must_be_an_integer_and_hide');
  if (value.host.refresh_interval !== 'event') {
    try { integer(value.host.refresh_interval); } catch { fail('errors.protocol.refresh_interval_must_be_an_integer_or'); }
  }
  let padding: number, refresh_interval: number | 'event';
  try { padding = safeInteger(value.host.padding, 0, 32); } catch { return fail('errors.host.padding_must_be_an_integer_from_0'); }
  try { refresh_interval = value.host.refresh_interval === 'event' ? 'event' : safeInteger(value.host.refresh_interval, 1, 3600); }
  catch { return fail('errors.host.refresh_interval_must_be_event_or_an'); }
  return { display, host: { padding, refresh_interval, hide_vim_mode_indicator: value.host.hide_vim_mode_indicator } };
}
