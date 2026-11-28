import { clusterWidth, graphemes } from '../unicode/index.js';

export function wrapLineEnd(text: string, width: number): number {
  const limit = Math.max(2, width);
  let prefix = '', used = 0;
  for (const character of graphemes(text)) {
    const cells = clusterWidth(character);
    if (used + cells > limit) break;
    prefix += character;
    used += cells;
  }
  if (prefix === text) return text.length;
  const space = prefix.lastIndexOf(' ');
  return space > 0 ? space : prefix.length || [...text][0]!.length;
}

/** Read-only paragraph wrapping with existing terminal cell semantics. */
export function wrapText(paragraphs: readonly string[], width: number): string[] {
  const lines: string[] = [];
  for (let text of paragraphs) {
    if (!text) lines.push('');
    while (text) {
      const cut = wrapLineEnd(text, width);
      lines.push(text.slice(0, cut)); text = text.slice(cut).replace(/^ +/, '');
    }
  }
  return lines;
}
