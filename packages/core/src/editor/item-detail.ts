import { clip, clusterWidth, displayWidth, graphemes } from '../unicode/index.js';

export interface ItemDetailRow {
  kind: 'heading' | 'body' | 'example' | 'note' | 'error';
  text: string;
}

export interface ItemDetailBlock extends ItemDetailRow {
  prefix?: 'bullet' | 'indent';
}

export function itemDetailBullet(text: string): ItemDetailBlock {
  return { kind: 'body', text, prefix: 'bullet' };
}

export function itemDetailSection(heading: string, content: readonly ItemDetailBlock[]): ItemDetailBlock[] {
  return content.length ? [{ kind: 'body', text: '' }, { kind: 'heading', text: heading }, ...content] : [];
}

function wrapDetailText(text: string, width: number): string[] {
  if (!text || width <= 0) return [''];
  const clusters = graphemes(text);
  const lines: string[] = [];
  let start = 0;
  while (start < clusters.length) {
    let end = start, space = start, cells = 0;
    while (end < clusters.length) {
      const cluster = clusters[end]!;
      const size = clusterWidth(cluster);
      if (cells + size > width) break;
      if (cluster === ' ') space = end;
      cells += size;
      end++;
    }
    if (end < clusters.length && space > start) end = space;
    if (end === start) {
      lines.push(clip(clusters[end]!, width));
      end++;
    } else {
      lines.push(clusters.slice(start, end).join(''));
    }
    // Skip only separate spaces. A space with a combining mark is its own cluster.
    while (clusters[end] === ' ') end++;
    start = end;
  }
  return lines;
}

export function wrapItemDetailRows(blocks: readonly ItemDetailBlock[], width: number): ItemDetailRow[] {
  return blocks.flatMap(({ kind, text, prefix }) => {
    const marker = prefix && width >= 4 ? prefix === 'bullet' ? '• ' : '  ' : '';
    const indent = displayWidth(marker);
    const available = width - indent;
    const lines = wrapDetailText(text.replace(/[\p{Cc}\p{Cs}]/gu, ' '), available);
    return lines.map((line, index) => ({ kind, text: (index ? ' '.repeat(indent) : marker) + line }));
  });
}

export function itemDetailWindow(rows: readonly ItemDetailRow[], scroll: number, capacity: number, key?: string): {
  start: number;
  rows: readonly ItemDetailRow[];
  summary: string;
} {
  const visible = Math.max(1, Math.trunc(capacity) || 1);
  const last = Math.max(0, rows.length - visible);
  const clamp = (offset: number) => Math.max(0, Math.min(offset, last));
  let start = clamp(Math.trunc(scroll) || 0);
  switch (key) {
    case 'up': start = clamp(start - 1); break;
    case 'down': start = clamp(start + 1); break;
    case 'pageup': start = clamp(start - visible); break;
    case 'pagedown': start = clamp(start + visible); break;
    case 'home': start = 0; break;
    case 'end': start = last; break;
  }
  const end = Math.min(rows.length, start + visible);
  return { start, rows: rows.slice(start, end), summary: `${rows.length ? start + 1 : 0}–${end}/${rows.length}` };
}
