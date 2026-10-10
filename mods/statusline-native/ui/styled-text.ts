/** Partition complete rows before styling or clipping, including span boundaries. */
import { graphemes, clusterWidth, cellWidth } from '../lib/unicode.ts';

export function clusterSpans<T extends {text: string}>(spans: readonly T[]): T[] {
  spans = spans.map(span => ({...span, text: span.text.replace(/[\p{Cc}\p{Cs}]/gu, ' ')}));
  const states: T[] = [];
  for (const span of spans) for (const _ of span.text) states.push(span);
  const result: T[] = [];
  let offset = 0;
  for (const cluster of graphemes(spans.map(s => s.text).join(''))) {
    const chars = [...cluster], base = Math.max(0, chars.findIndex(c => cellWidth(c) > 0));
    result.push({...states[offset + base]!, text: cluster});
    offset += chars.length;
  }
  return result;
}
function merge<T extends {text: string}>(spans: T[]): T[] {
  const result: T[] = [];
  for (const span of spans) {
    const previous = result.at(-1);
    const keys = Object.keys(span).filter(key => key !== 'text') as (keyof T)[];
    if (previous && Object.keys(previous).length === Object.keys(span).length && keys.every(key => previous[key] === span[key])) previous.text += span.text;
    else result.push({...span});
  }
  return result;
}
export function clipSpans<T extends {text: string}>(spans: readonly T[], width: number): T[] {
  width = Math.max(0, width);
  if (!width) return [];
  const clusters = clusterSpans(spans);
  if (clusters.reduce((n, c) => n + clusterWidth(c.text), 0) <= width) return merge(clusters);
  const result: T[] = [];
  let used = 0;
  for (const cluster of clusters) {
    const size = clusterWidth(cluster.text);
    if (used + size > width - 1) break;
    result.push(cluster); used += size;
  }
  if (clusters.length) result.push({...((result.length ? result[result.length - 1] : clusters[0])!), text: '…'});
  return merge(result);
}
