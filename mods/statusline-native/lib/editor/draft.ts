import type {
  CatalogItem,
  DescribeResult,
  Draft,
  ReadResult,
  Scope,
} from '../generated-contracts.ts';
import { NUMERIC_FIELDS, numericValue } from './numeric.ts';
import type { NumericField } from './numeric.ts';
export type { NumericField } from './numeric.ts';

export type Page = 'main' | 'subagents' | 'settings';

/** Copy wire data without sharing editable arrays with the opening snapshot. */
export function copyDraft(draft: Draft): Draft {
  return {
    display: {
      ...draft.display,
      items: [...draft.display.items],
      subagents: {
        ...draft.display.subagents,
        items: [...draft.display.subagents.items],
      },
    },
    host: { ...draft.host },
  };
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
  setting = 'colors';
  activeNumeric: NumericField | null = null;
  selected: Record<Scope, string>;
  order: Record<Scope, string[]>;
  search: Record<Scope, string> = { main: '', subagent: '' };
  buffers: Record<NumericField, string>;
  fieldErrors: Partial<Record<NumericField, string>> = {};

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
        `${item.id} ${item.label} ${item.description}`
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
  }

  cancelNumeric(field?: NumericField): void {
    for (const key of field ? [field] : NUMERIC_FIELDS) {
      this.buffers[key] = String(this.draft.host[key]);
      delete this.fieldErrors[key];
    }
    if (!field || this.activeNumeric === field) this.activeNumeric = null;
  }

  acceptNumeric(field?: NumericField): boolean {
    const values: Partial<Record<NumericField, number | 'event'>> = {};
    const fields = field ? [field] : NUMERIC_FIELDS;
    for (const key of fields) {
      delete this.fieldErrors[key];
      const parsed = numericValue(this.description, key, this.buffers[key]);
      if (parsed.error !== undefined) this.fieldErrors[key] = parsed.error;
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
      this.draft.display.items = items as Draft['display']['items'];
    } else {
      this.draft.display.subagents.items =
        items as Draft['display']['subagents']['items'];
    }
  }
}
