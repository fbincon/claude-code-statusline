import type { ClientElements, RenderElement, TextProps } from 'claude-code';
import { editorLineSpans, type EditorLine } from '../../lib/editor/hints.ts';
import { clip, displayWidth } from '../layout.ts';
import { clipSpans } from '../styled-text.ts';
import { styles } from '../theme.ts';

export interface Shortcut {
  key: string;
  label: string;
  labelKey?: string;
  short?: string;
  optional?: number;
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
export function shortcutSpans(hints: readonly Shortcut[], width: number, prefix: string | readonly TextSpan[] = ''): TextSpan[] {
  const spans: TextSpan[] = [];
  const styledPrefix = typeof prefix !== 'string';
  if (styledPrefix) spans.push(...prefix);
  else if (prefix) spans.push({ text: clip(prefix, width), style: styles.muted });
  let used = displayWidth(spans.map(span => span.text).join(''));
  const firstSeparator = styledPrefix ? '  ' : '';
  const full = hints.map((h) => h.key + ' ' + h.label).join(' · ');
  const compact = used + displayWidth(firstSeparator + full) > width;
  let count = 0;
  for (const hint of hints) {
    const label = compact ? hint.short ?? hint.label : hint.label;
    const separator = count ? ' · ' : firstSeparator;
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

export function shortcuts(ui: ClientElements, hints: readonly Shortcut[], width: number, prefix: string | readonly TextSpan[] = ''): RenderElement {
  return spanLine(ui, shortcutSpans(hints, width, prefix), width);
}

export function inputSpans(line: EditorLine, width: number): TextSpan[] {
  return editorLineSpans(line, width).map(({ text, caret, bold }) => {
    const style = caret ? styles.selected : styles.text;
    return { text, style: bold ? { ...style, bold } : style };
  });
}

export function editorLine(ui: ClientElements, line: EditorLine, width: number, style: TextProps): RenderElement {
  if (line.caret) return spanLine(ui, inputSpans(line, width), width);
  const spans = editorLineSpans(line, width).map(({ text, bold }): TextSpan => ({
    text,
    style: bold ? { ...styles.key, ...(style.color === styles.selected.color && { color: style.color }) } : { bold: false },
  }));
  return spanLine(ui, spans, width, style);
}
