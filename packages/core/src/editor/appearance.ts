import { COST_RATE_FIELD } from './cost-rate.js';
import { supportsIndicator, INDICATOR_FIELDS } from './indicators.js';
/** Pure controls/validation from Python's scoped visibility capabilities. */
import { VISIBILITY_ITEMS, FORMAT_CHOICES } from '../contracts/ui.js';
import type { Scope, EditorField, ItemCapability } from '../contracts/ui.js';

export function visibilityChoices(scope: Scope, id: string): string[] {
  const rule = (VISIBILITY_ITEMS[scope] as Record<string, string>)[id];
  return rule ? ['always', rule] : ['always'];
}

/** Existing rendering rules remain compatible; editors expose only effective overrides. */
export function supportedFormats(scope: Scope, id: string, capability?: ItemCapability): string[] {
  if (capability) return capability.formats;
  if (id === 'text' || id === 'spacer') return [];
  const fields = ['labels', 'icons'];
  if (['model', 'model-with-effort'].includes(id)) fields.push('model_name');
  const numbers = scope === 'main'
    ? ['context-window-size', 'context-tokens', 'tokens', 'input-tokens', 'output-tokens', 'cost', 'prompt-cache', 'session-cost', 'lines-changed', 'cache-misses', 'api-requests', 'spend-amount', 'active-agents', 'prompt-input-tokens', 'prompt-output-tokens', 'prompt-cost']
    : ['context-window-size', 'context-tokens', 'tokens'];
  if (numbers.includes(id)) fields.push('number_format');
  if (scope === 'main' && ['five-hour-limit', 'weekly-limit', 'spend-limit'].includes(id)) fields.push('allowance');
  if (scope === 'main' && ['five-hour-reset', 'weekly-reset'].includes(id)) fields.push('reset_format', 'reset_timezone');
  return fields;
}

export function itemFields(fields: EditorField[], scope: Scope, id: string, capability?: ItemCapability): EditorField[] {
  if(id==='spacer')return [];
  if(id==='text')return [{key:'text',label:'Literal text',group:'Item format',kind:'text',choices:[],minimum:0,maximum:256,nullable:false},
    ...fields.filter(f=>['label','icon','foreground','background','priority','max_width'].includes(f.key))];
  const choices = capability?.visibility ?? visibilityChoices(scope, id);
  const links: EditorField[] = capability?.link ? [{key:'link',label:'Links',group:'Item format',kind:'choice',choices:['off','auto','on'],minimum:0,maximum:0,nullable:false}] : [];
  const formats = supportedFormats(scope, id, capability);
  fields = fields.filter(field => !Object.hasOwn(FORMAT_CHOICES,field.key) || formats.includes(field.key));
  return [...(scope === 'main' && id === 'session-cost-rate' ? [COST_RATE_FIELD] : []), ...(supportsIndicator(scope, id) ? INDICATOR_FIELDS : []), ...links, ...fields.filter(spec => (spec.key !== 'visibility' || choices.length > 1) &&
    (spec.key !== 'visibility_threshold' || choices.includes('used-at-least')))
    .map(spec => spec.key === 'visibility' ? {...spec, choices} : spec)];
}

export function validColor(value: unknown): boolean {
  return value === null || value === 'default' || typeof value === 'string' && !/\s/u.test(value) &&
    (/^#[0-9a-f]{6}$/i.test(value) || /^ansi:[0-9]{1,3}$/.test(value) && Number(value.slice(5)) <= 255);
}

export function normalizeColor(value: unknown): unknown {
  if (typeof value !== 'string' || !validColor(value)) return value;
  return value.startsWith('ansi:') ? 'ansi:' + Number(value.slice(5)) : value.toLowerCase();
}
