/** Local deterministic search. Original code-point positions survive NFKD. */
import type { CatalogItem } from '../contracts/ui.js';
import { LANGUAGES, t } from '../i18n/messages.js';

const SPACES = new Set([..." \t\n\r\v\f\u0085\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000"]);
export interface Match { rank: number; positions: number[]; text: string; field: string }
const normalizedCache = new Map<string, {characters: string[]; positions: number[]}>();

export function normalize(text: string): { characters: string[]; positions: number[] } {
  const cached = normalizedCache.get(text);
  if (cached) return cached;
  const characters: string[] = [], positions: number[] = [];
  [...text].forEach((original, index) => {
    for (const decomposed of original.normalize('NFKD')) {
      for (let character of decomposed.toLowerCase()) {
        if (SPACES.has(character)) {
          if (!characters.length || characters.at(-1) === ' ') continue;
          character = ' ';
        }
        characters.push(character); positions.push(index);
      }
    }
  });
  if (characters.at(-1) === ' ') { characters.pop(); positions.pop(); }
  const value = { characters, positions };
  if (normalizedCache.size >= 2048) normalizedCache.delete(normalizedCache.keys().next().value!);
  normalizedCache.set(text, value);
  return value;
}

export function matchText(text: string, query: string, field = '', prepared?: ReturnType<typeof normalize>): Match | null {
  const { characters: value, positions: mapping } = prepared ?? normalize(text);
  const { characters: needle } = normalize(query);
  if (!needle.length) return { rank: 5, positions: [], text, field };
  if (!value.length) return null;
  let rank: number, indices: number[];
  const at = (start: number) => needle.every((character, i) => value[start + i] === character);
  if (at(0)) {
    rank = value.length === needle.length ? 0 : 1;
    indices = needle.map((_, i) => i);
  } else {
    const wordStarts = value.flatMap((character, i) => /[a-z0-9]/.test(character) && (i === 0 || !/[a-z0-9]/.test(value[i - 1]!)) ? [i] : []);
    if (needle.length > 1 && needle.every(c => /^[a-z0-9]$/.test(c)) && needle.every((c, i) => value[wordStarts[i]!] === c)) {
      rank = 2; indices = wordStarts.slice(0, needle.length);
    } else {
      const start = value.findIndex((_, i) => at(i));
      if (start >= 0) { rank = 3; indices = needle.map((_, i) => start + i); }
      else {
        rank = 4; indices = [];
        let offset = 0;
        for (const character of needle) {
          const found = value.indexOf(character, offset);
          if (found < 0) return null;
          indices.push(found); offset = found + 1;
        }
      }
    }
  }
  return { rank, positions: [...new Set(indices.map(i => mapping[i]!))], text, field };
}

type SearchField = readonly [string, string, ReturnType<typeof normalize>?];
const fieldCache = new WeakMap<CatalogItem, {customLabel: string | null; fields: SearchField[]}>();

function preparedField(name: string, value: string): SearchField {
  return [name, value, normalize(value)];
}

export function fields(item: CatalogItem, customLabel: string | null = null): readonly SearchField[] {
  const cached = fieldCache.get(item);
  if (cached) {
    if (cached.customLabel !== customLabel) {
      cached.fields[1 + LANGUAGES.length] = preparedField('custom_label', customLabel ?? '');
      cached.customLabel = customLabel;
    }
    return cached.fields;
  }
  const prefix = `items.${item.scope}.${item.id}.`;
  const result = [
    preparedField('id', item.id),
    ...LANGUAGES.map(code => preparedField('label.' + code, code === 'en' ? item.label : t(prefix + 'label', code))),
    preparedField('custom_label', customLabel ?? ''),
    ...LANGUAGES.map(code => preparedField('description.' + code, code === 'en' ? item.description : t(prefix + 'description', code))),
    preparedField('category.id', item.group),
    ...LANGUAGES.map(code => preparedField('category.' + code, t('catalog.categories.' + item.group, code, {}, item.group))),
  ];
  fieldCache.set(item, {customLabel, fields: result});
  return result;
}

export function bestMatch(values: readonly SearchField[], query: string): Match | null {
  let best: Match | null = null;
  for (const [field, value, prepared] of values) {
    const match = matchText(value, query, field, prepared);
    if (match && (!best || match.rank < best.rank)) best = match;
  }
  return best;
}

export function segments(text: string, positions: number[] = []): { text: string; highlighted: boolean }[] {
  const marked = new Set(positions), result: {text: string; highlighted: boolean}[] = [];
  [...text].forEach((character, i) => {
    const highlighted = marked.has(i), last = result.at(-1);
    if (last?.highlighted === highlighted) last.text += character;
    else result.push({text: character, highlighted});
  });
  return result;
}

export function snippet(match: Match): Match {
  const start = Math.max(0, (match.positions[0] ?? 0) - 3);
  return start ? {...match, text: '…' + [...match.text].slice(start).join(''), positions: match.positions.map(p => p - start + 1)} : match;
}
