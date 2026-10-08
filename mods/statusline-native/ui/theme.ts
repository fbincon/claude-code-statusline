import type { ClientElements, RenderElement, TextProps } from 'claude-code';

/** Host theme tokens follow the applied theme, including auto/custom themes. */
export const styles = {
  text: { color: 'text', backgroundColor: 'inverseText', dimColor: false },
  muted: { color: 'inactive', dimColor: false },
  accent: { color: 'suggestion', dimColor: false },
  error: { color: 'error', dimColor: false },
  selected: { color: 'inverseText', backgroundColor: 'text', dimColor: false },
  key: { color: 'text', bold: true, dimColor: false },
  preview: { color: '#dedee7', backgroundColor: '#17191e', dimColor: false },
} satisfies Record<string, TextProps>;

/** Button has no base color prop; primary uses the host's suggestion token. */
export const recoveryButton = { variant: 'primary' as const, dimColor: false };

export function rowStyle(selected: boolean, editable = true): TextProps {
  return selected ? styles.selected : editable ? styles.text : styles.muted;
}

/** Fill the complete sample row, including unused cells and empty rows. */
export function previewRow(ui: ClientElements, child: RenderElement, width: number): RenderElement {
  return ui.Box({
    width, height: 1, flexShrink: 0, overflow: 'hidden',
    backgroundColor: styles.preview.backgroundColor,
    children: [child],
  });
}
