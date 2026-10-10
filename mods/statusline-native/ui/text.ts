import { cellWidth } from './layout.ts';

/** Read-only paragraph wrapping with existing terminal cell semantics. */
export function wrapText(paragraphs: readonly string[], width: number): string[] {
  width = Math.max(2, width);
  const lines: string[] = [];
  for (let text of paragraphs) {
    if (!text) lines.push('');
    while (text) {
      let prefix = '', used = 0;
      for (const character of text) {
        if (used + cellWidth(character) > width) break;
        prefix += character; used += cellWidth(character);
      }
      if (prefix === text) { lines.push(text); break; }
      let cut = prefix.lastIndexOf(' ');
      if (cut <= 0) cut = prefix.length || [...text][0]!.length;
      lines.push(text.slice(0, cut)); text = text.slice(cut).replace(/^ +/, '');
    }
  }
  return lines;
}
