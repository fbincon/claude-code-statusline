/** Keep English diagnostics and message metadata together across frozen ports. */
import type { View } from '../session.ts';
import { processFailure } from '../backend.ts';
import type { Preference } from '../preferences.ts';
import { renderMessage, text, LocalizedError } from './index.ts';
import type { LocalizedText } from './index.ts';

export type MessageSlot = 'message' | 'error' | 'busy' | 'previewError' | 'preferencesError';

export function setMessage(view: View, slot: MessageSlot, value: LocalizedText): void {
  view[slot] = value.fallback;
  (view.localized ??= {})[slot] = value;
}

export function viewMessage(view: View, slot: MessageSlot): string {
  const value = view.localized?.[slot];
  return value?.fallback === view[slot] ? renderMessage(value, view.language ?? 'en') : view[slot];
}

export function failureMessage(error: unknown): LocalizedText {
  if (error instanceof LocalizedError) return error.localization;
  const failure = processFailure(error);
  return text('native.backend_error', {code: failure.code, detail: failure.localization ?? failure.message});
}

export function setResult(preference: Preference, value: LocalizedText): void {
  preference.result = value.fallback;
  preference.localizedResult = value;
}

export function preferenceResult(preference: Preference, language: View['language']): string {
  return preference.localizedResult?.fallback === preference.result ? renderMessage(preference.localizedResult, language ?? 'en') : preference.result;
}
