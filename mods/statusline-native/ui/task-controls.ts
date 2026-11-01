import type { Elements } from 'claude-code';
import { t, type Language } from '../lib/i18n/index.ts';
import { clip, displayWidth } from './layout.ts';
import { recoveryButton } from './theme.ts';
import { graphemes } from '../lib/unicode.ts';

/** A backend error can contain a single very long combining sequence. Leave
 * space for both complete identity values even on an extremely wide surface. */
export function taskNotice(value: string, width: number): string {
  const line = clip(value, Math.min(width, 512));
  if (line.length <= 1024) return line;
  let prefix = '';
  for (const cluster of graphemes(line)) {
    if (prefix.length + cluster.length > 1023) break;
    prefix += cluster;
  }
  return prefix + '…';
}

const controls = [
  [
    ['search', 'g', 'ui.hints.search'], ['filter', 'f', 'statusline.short.subagent.status'],
    ['evidence', 'e', 'task.controls.evidence'], ['identity', 's', 'task.controls.identity'],
    ['fold', 'z', 'task.controls.fold'],
  ],
  [
    ['previous', 'p', '↑'], ['next', 'n', '↓'], ['up', 'k', '⇞'], ['down', 'j', '⇟'],
    ['refresh', 'r', 'profiles.refresh'], ['close', 'q', 'task.close'],
  ],
] as const;

export function taskControls(ui: Elements['terminal'], language: Language, width: number, press: (key: string) => void) {
  return controls.map(group => {
    const labels = group.map(([, , label]) => label.length === 1 ? label : t(label, language));
    const widths = labels.map(label => displayWidth(label));
    const labelSpace = width - group.length * 3 - (group.length - 1);
    // Reserve the short symbols first, then divide the remaining cells among
    // longer translated labels. Every button keeps a visible keyboard address.
    let cap = 1;
    while (widths.some(cells => cells > cap) &&
           widths.reduce((size, cells) => size + Math.min(cells, cap + 1), 0) <= labelSpace) cap++;
    return ui.Box({ flexDirection: 'row', columnGap: 1, children: group.map(([id, hotkey], index) => ui.Button({
      ...recoveryButton, key: 'task-' + id, hotkey, plain: true, label: clip(labels[index]!, cap),
      ...(id === 'search' ? { autoFocus: true } : {}), onPress: () => press(hotkey),
    })) });
  });
}
