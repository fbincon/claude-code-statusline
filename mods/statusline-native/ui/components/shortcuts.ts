import type { ClientElements, RenderElement, TextProps } from 'claude-code';
import { clip, displayWidth } from '../layout.ts';
import { clipSpans } from '../styled-text.ts';
import { styles } from '../theme.ts';

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
    spans.push({ text, style: styles.muted });
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
    if (separator) spans.push({ text: separator, style: styles.muted });
    spans.push({ text: hint.key, style: styles.key });
    spans.push({ text: ' ' + label, style: { ...styles.muted, bold: false } });
    used += size;
    count++;
  }
  return spans;
}

export function spanLine(ui: ClientElements, spans: readonly TextSpan[], width: number, style: TextProps = {}): RenderElement {
  let remaining = Math.max(0, width);
  const children: RenderElement[] = [];
  const runs: TextSpan[] = [];
  for (const span of clipSpans(spans, width)) {
    if (remaining <= 0) break;
    if (!span.text) continue;
    const text = span.text;
    if (!text) continue;
    const previous = runs[runs.length - 1], keys = Object.keys(span.style ?? {}) as (keyof TextProps)[];
    if (previous && keys.length === Object.keys(previous.style ?? {}).length && keys.every(key => previous.style?.[key] === span.style?.[key])) previous.text += text;
    else runs.push({ ...span, text });
    remaining -= displayWidth(text);
  }
  for (const run of runs) children.push(ui.Text({ ...run.style, children: [run.text] }));
  return ui.Text({ wrap: 'truncate', bold: false, ...styles.text, ...style, children });
}

export function shortcuts(ui: ClientElements, hints: readonly Shortcut[], width: number, prefix = ''): RenderElement {
  return spanLine(ui, shortcutSpans(hints, width, prefix), width);
}
