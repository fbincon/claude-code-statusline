import type {
  CatalogItem,
  DescribeResult,
  Draft,
  ReadResult,
  Scope,
} from '../generated-contracts.ts';
import { NUMERIC_FIELDS, numericValue, numericDiagnostic } from './numeric.ts';
import { t } from '../i18n/index.ts';
import type { LocalizedText } from '../i18n/index.ts';
import type { NumericField } from './numeric.ts';
export type { NumericField } from './numeric.ts';

export type Page = 'main' | 'subagents' | 'settings' | 'layout';

/** Copy wire data without sharing editable arrays with the opening snapshot. */
export function copyDraft(draft: Draft): Draft {
  return JSON.parse(JSON.stringify(draft)) as Draft;
}

export function sameDraft(left: Draft, right: Draft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Pure tool draft. Persistence and host configuration calls live in the hook. */
export class Editor {
  draft: Draft;
  baseline: ReadResult;
  page: Page = 'main';
  advanced = false;
  detail: { scope: Scope; id: string } | null = null;
  preset = 'minimal';
  path = 'statusline.json';
  pendingTransfer: 'import' | 'export' | 'preset' | null = null;
  setting = 'colors';
  activeNumeric: NumericField | null = null;
  selected: Record<Scope, string>;
  order: Record<Scope, string[]>;
  search: Record<Scope, string> = { main: '', subagent: '' };
  buffers: Record<NumericField, string>;
  fieldErrors: Partial<Record<NumericField, string>> = {};
  fieldErrorMessages: Partial<Record<NumericField, LocalizedText>> = {};

  constructor(
    public readonly description: DescribeResult,
    current: ReadResult,
  ) {
    this.baseline = { ...current, draft: copyDraft(current.draft) };
    this.draft = copyDraft(current.draft);
    this.order = { main: [], subagent: [] };
    this.selected = { main: '', subagent: '' };
    for (const scope of ['main', 'subagent'] as const) {
      const enabled = this.items(scope);
      this.order[scope] = [
        ...enabled,
        ...this.catalog(scope)
          .map((item) => item.id)
          .filter((id) => !enabled.includes(id)),
      ];
      this.selected[scope] = this.order[scope][0] || '';
    }
    this.buffers = {
      padding: String(this.draft.host.padding),
      refresh_interval: String(this.draft.host.refresh_interval),
    };
  }

  replaceDraft(draft: Draft): void {
    this.draft = copyDraft(draft);
    for (const scope of ['main', 'subagent'] as const) {
      this.order[scope] = [...this.items(scope), ...this.catalog(scope).map((i) => i.id).filter((id) => !this.items(scope).includes(id))];
      if (!this.order[scope].includes(this.selected[scope])) this.selected[scope] = this.order[scope][0] || '';
    }
    this.buffers = { padding: String(draft.host.padding), refresh_interval: String(draft.host.refresh_interval) };
    this.fieldErrors = {};
    this.fieldErrorMessages = {};
    this.activeNumeric = null;
    this.detail = null;
  }

  get modified(): boolean {
    return (
      !sameDraft(this.draft, this.baseline.draft) ||
      this.buffers.padding !== String(this.draft.host.padding) ||
      this.buffers.refresh_interval !== String(this.draft.host.refresh_interval)
    );
  }

  catalog(scope: Scope): CatalogItem[] {
    return this.description.catalog.filter((item) => item.scope === scope);
  }

  items(scope: Scope): string[] {
    return scope === 'main'
      ? this.draft.display.items
      : this.draft.display.subagents.items;
  }

  visible(scope: Scope): CatalogItem[] {
    const needle = this.search[scope].toLocaleLowerCase();
    const catalog = new Map(
      this.catalog(scope).map((item) => [item.id as string, item]),
    );
    return this.order[scope].flatMap((id) => {
      const item = catalog.get(id);
      return item &&
        `${item.id} ${item.label} ${item.description} ${t('items.' + scope + '.' + item.id + '.label', 'zh-CN')} ${t('items.' + scope + '.' + item.id + '.description', 'zh-CN')} ${((scope === 'main' ? this.draft.display.item_options : this.draft.display.subagents.item_options) as Record<string, {label: string | null} | undefined>)[id]?.label ?? ''}`
          .toLocaleLowerCase()
          .includes(needle)
        ? [item]
        : [];
    });
  }

  filter(scope: Scope, value: string): void {
    this.search[scope] = value;
    if (!this.visible(scope).some((item) => item.id === this.selected[scope])) {
      this.selected[scope] = this.visible(scope)[0]?.id || '';
    }
  }

  toggle(scope: Scope, id: string): boolean {
    const item = this.catalog(scope).find((candidate) => candidate.id === id);
    if (!item) return false;
    const enabled = new Set(this.items(scope));
    if (!enabled.delete(id)) {
      item.excludes.forEach((excluded) => enabled.delete(excluded));
      enabled.add(id);
    }
    this.setItems(
      scope,
      this.order[scope].filter((candidate) => enabled.has(candidate)),
    );
    return true;
  }

  move(scope: Scope, delta: -1 | 1): boolean {
    const visible = this.visible(scope).map((item) => item.id as string);
    const id = this.selected[scope];
    const index = visible.indexOf(id);
    const target = visible[index + delta];
    if (index < 0 || !target) return false;
    const order = this.order[scope];
    order.splice(order.indexOf(id), 1);
    order.splice(order.indexOf(target) + (delta > 0 ? 1 : 0), 0, id);
    const enabled = new Set(this.items(scope));
    this.setItems(
      scope,
      order.filter((candidate) => enabled.has(candidate)),
    );
    return true;
  }

  setBuffer(field: NumericField, value: string): void {
    this.activeNumeric = field;
    this.buffers[field] = value;
    delete this.fieldErrors[field];
    delete this.fieldErrorMessages[field];
  }

  cancelNumeric(field?: NumericField): void {
    for (const key of field ? [field] : NUMERIC_FIELDS) {
      this.buffers[key] = String(this.draft.host[key]);
      delete this.fieldErrors[key];
      delete this.fieldErrorMessages[key];
    }
    if (!field || this.activeNumeric === field) this.activeNumeric = null;
  }

  acceptNumeric(field?: NumericField): boolean {
    const values: Partial<Record<NumericField, number | 'event'>> = {};
    const fields = field ? [field] : NUMERIC_FIELDS;
    for (const key of fields) {
      delete this.fieldErrors[key];
      delete this.fieldErrorMessages[key];
      const parsed = numericValue(this.description, key, this.buffers[key]);
      if (parsed.error !== undefined) { this.fieldErrors[key] = parsed.error; this.fieldErrorMessages[key] = numericDiagnostic(this.description, key); }
      else values[key] = parsed.value;
    }
    if (fields.some((key) => this.fieldErrors[key])) return false;
    if (values.padding !== undefined)
      this.draft.host.padding = values.padding as number;
    if (values.refresh_interval !== undefined)
      this.draft.host.refresh_interval = values.refresh_interval;
    this.cancelNumeric(field);
    return true;
  }

  committed(current: ReadResult): void {
    this.baseline = { ...current, draft: copyDraft(current.draft) };
    this.draft = copyDraft(current.draft);
    this.cancelNumeric();
  }

  private setItems(scope: Scope, items: string[]): void {
    if (scope === 'main') {
      const layout = this.draft.display.layout;
      if (layout.mode === 'explicit') {
        const remaining = [...items] as Draft['display']['items'];
        const selected = new Set(items);
        const rows: typeof layout.rows = [];
        for (const row of layout.rows) {
          const size = row.filter((id) => selected.has(id)).length;
          if (size) rows.push(remaining.splice(0, size));
        }
        if (remaining.length) {
          if (rows.length) rows[rows.length - 1]!.push(...remaining);
          else rows.push(remaining);
        }
        layout.rows = rows;
      }
      this.draft.display.items = items as Draft['display']['items'];
    } else {
      this.draft.display.subagents.items =
        items as Draft['display']['subagents']['items'];
    }
  }
}
