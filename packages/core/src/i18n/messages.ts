/** Explicit-language messages; canonical backend metadata remains English. */
import { FALLBACK_KEYS, LOCALES, resolveLanguage } from './generated-locales.js';
import type { Language } from './generated-locales.js';
export type { MessageKey, Language } from './generated-locales.js';
export { LANGUAGES, LANGUAGE_NAMES, resolveLanguage } from './generated-locales.js';
export interface LocalizedText { key: string; params: Record<string, unknown>; fallback: string }
const originCache: Partial<Record<Language, ReadonlySet<string>>> = {};

/** Effective English remains English evidence, even when selected through another language. */
export function messageOrigin(key: string, language: Language = 'en'): Language {
  const code = resolveLanguage(language) ?? 'en';
  const fallback = originCache[code] ??= new Set<string>(FALLBACK_KEYS[code]);
  return Object.hasOwn(LOCALES[code], key) && !fallback.has(key) ? code : 'en';
}

export class LocalizedError extends Error {
  constructor(public readonly localization: LocalizedText) { super(localization.fallback); }
}

export function isLocalizedText(value: unknown, depth = 0): value is LocalizedText {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 8) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).sort().join(',') === 'fallback,key,params' &&
    typeof v.key === 'string' && typeof v.fallback === 'string' &&
    !!v.params && typeof v.params === 'object' && !Array.isArray(v.params) &&
    Object.values(v.params).every(p => p === null || ['string', 'number', 'bigint', 'boolean'].includes(typeof p) || isLocalizedText(p, depth + 1));
}

const parameterPattern = /\{\{|\}\}|\{([A-Za-z_][A-Za-z_0-9]*)\}/g;

function messageTemplate(key: string, language: Language, fallback?: string): string {
  const base: Record<string, string> = LOCALES.en;
  const current: Record<string, string> = LOCALES[resolveLanguage(language) ?? 'en'];
  return (Object.hasOwn(current, key) ? current[key] : undefined) ??
    (Object.hasOwn(base, key) ? base[key] : undefined) ?? fallback ?? key;
}

function parameterText(matched: string, name: string | undefined, params: Record<string, unknown>, language: Language): string {
  if (!name) return matched === '{{' ? '{' : '}';
  const value = params[name];
  return isLocalizedText(value) ? renderMessage(value, language) : value === undefined ? matched : String(value);
}

export function t(key: string, language: Language = 'en', params: Record<string, unknown> = {}, fallback?: string): string {
  return messageTemplate(key, language, fallback).replace(parameterPattern,
    (matched, name: string | undefined) => parameterText(matched, name, params, language));
}

/** Interpolate once, preserving the origin of substituted values for presentation. */
export function messageParts(key: string, language: Language, params: Record<string, unknown>, fallback?: string) {
  const template = messageTemplate(key, language, fallback);
  const parts: { text: string; parameter?: string }[] = [];
  let start = 0;
  for (const match of template.matchAll(parameterPattern)) {
    if (start < match.index) parts.push({ text: template.slice(start, match.index) });
    const name = match[1];
    parts.push({ text: parameterText(match[0], name, params, language), parameter: name });
    start = match.index + match[0].length;
  }
  if (start < template.length) parts.push({ text: template.slice(start) });
  return parts;
}

export function text(key: string, params: Record<string, unknown> = {}): LocalizedText {
  return { key, params, fallback: t(key, 'en', params) };
}

export function renderMessage(value: LocalizedText | string, language: Language = 'en'): string {
  return typeof value === 'string' ? value : t(value.key, language, value.params, value.fallback);
}
