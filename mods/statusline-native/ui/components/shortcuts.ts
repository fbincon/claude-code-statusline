import type { ClientElements, RenderElement, TextProps } from 'claude-code';
import { clip, displayWidth } from '../layout.ts';

export interface Shortcut {
  key: string;
  label: string;
  short?: string;
}

export interface TextSpan {
  text: string;
  style?: TextProps;
}

/** Wrap complete hints in order; distinct action groups start on new rows. */
export function shortcutRows(groups: readonly (readonly Shortcut[])[], width: number, compact = false): Shortcut[][] {
  const rows: Shortcut[][] = [];
  for (const group of groups) {
    let row: Shortcut[] = [];
    let used = 0;
    for (const hint of group) {
      let label = compact ? hint.short ?? hint.label : hint.label;
      if (displayWidth(hint.key + ' ' + label) > width) label = hint.short ?? label;
      const size = displayWidth(hint.key + ' ' + label);
      if (size > width) continue;
      if (row.length && used + 3 + size > width) {
        rows.push(row);
        row = [];
        used = 0;
      }
      used += (row.length ? 3 : 0) + size;
      row.push({ ...hint, label });
    }
    if (row.length) rows.push(row);
  }
  return rows;
}

/** Fit complete shortcut groups, with shorter descriptions in narrow panes. */
export function shortcutSpans(hints: readonly Shortcut[], width: number, prefix = ''): TextSpan[] {
  const spans: TextSpan[] = [];
  let used = 0;
  if (prefix) {
    const text = clip(prefix, width);
    spans.push({ text, style: { dimColor: true } });
    used = displayWidth(text);
  }
  const full = hints.map((h) => h.key + ' ' + h.label).join(' · ');
  const compact = used + displayWidth(full) > width;
  let count = 0;
  for (const hint of hints) {
    const label = compact ? hint.short ?? hint.label : hint.label;
    const separator = count ? ' · ' : '';
    const size = displayWidth(separator + hint.key + ' ' + label);
    if (used + size > width) break;
    if (separator) spans.push({ text: separator, style: { dimColor: true } });
    spans.push({ text: hint.key, style: { color: 'white', bold: true, dimColor: false } });
    spans.push({ text: ' ' + label, style: { bold: false, dimColor: true } });
    used += size;
    count++;
  }
  return spans;
}

export function spanLine(ui: ClientElements, spans: readonly TextSpan[], width: number, style: TextProps = {}): RenderElement {
  let remaining = Math.max(0, width);
  const children: RenderElement[] = [];
  for (const span of spans) {
    if (remaining <= 0) break;
    if (!span.text) continue;
    const text = clip(span.text, remaining);
    if (!text) continue;
    children.push(ui.Text({ ...span.style, children: [text] }));
    remaining -= displayWidth(text);
  }
  return ui.Text({ wrap: 'truncate', bold: false, ...style, children });
}

export function shortcuts(ui: ClientElements, hints: readonly Shortcut[], width: number, prefix = ''): RenderElement {
  return spanLine(ui, shortcutSpans(hints, width, prefix), width);
}
