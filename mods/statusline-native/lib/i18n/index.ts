/** Explicit-language messages; canonical backend metadata remains English. */
import { LOCALES } from './generated-locales.ts';
export type { MessageKey } from './generated-locales.ts';

export type Language = 'en' | 'zh-CN';
export const LANGUAGES: readonly Language[] = ['en', 'zh-CN'];
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', 'zh-CN': '简体中文' };
export interface LocalizedText { key: string; params: Record<string, unknown>; fallback: string }

export function isLocalizedText(value: unknown, depth = 0): value is LocalizedText {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 8) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).sort().join(',') === 'fallback,key,params' &&
    typeof v.key === 'string' && typeof v.fallback === 'string' &&
    !!v.params && typeof v.params === 'object' && !Array.isArray(v.params) &&
    Object.values(v.params).every(p => p === null || ['string', 'number', 'boolean'].includes(typeof p) || isLocalizedText(p, depth + 1));
}

export function t(key: string, language: Language = 'en', params: Record<string, unknown> = {}, fallback?: string): string {
  const base: Record<string, string> = LOCALES.en;
  const current: Record<string, string> = LOCALES[language] ?? base;
  const template = current[key] ?? base[key] ?? fallback ?? key;
  return template.replace(/\{\{|\}\}|\{([A-Za-z_][A-Za-z_0-9]*)\}/g, (matched, name: string | undefined) => {
    if (!name) return matched === '{{' ? '{' : '}';
    const value = params[name];
    return isLocalizedText(value) ? renderMessage(value, language) : value === undefined ? matched : String(value);
  });
}

export function text(key: string, params: Record<string, unknown> = {}): LocalizedText {
  return { key, params, fallback: t(key, 'en', params) };
}

export function renderMessage(value: LocalizedText | string, language: Language = 'en'): string {
  return typeof value === 'string' ? value : t(value.key, language, value.params, value.fallback);
}
