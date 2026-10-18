import type { Span } from '@fbincon/statusline-core/contracts/ui';

export interface Paint extends Span {
    reverse?: boolean;
}

/** Terminal-owned surfaces; ANSI cyan is the sole chrome accent. */
export const paint = (text: string, bold = false, reverse = false): Paint => ({ text, bold, reverse, foreground: null, background: null });
const cyan = { kind: 'ansi' as const, value: 6 };
export const heading = (text: string, reverse = false): Paint => ({ ...paint(text, true, reverse), foreground: cyan });
