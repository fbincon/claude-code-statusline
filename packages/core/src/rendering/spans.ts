import { styledUnits } from './layout.js';
import { parse, wireColor } from './styles.js';
export interface Span {
    text: string;
    bold: boolean;
    foreground: ReturnType<typeof wireColor>;
    background: ReturnType<typeof wireColor>;
}
export function rowSpans(row: string): Span[] {
    const result: Span[] = [];
    for (const unit of styledUnits(row)) {
        const state = parse(unit.style), next = { text: unit.text, bold: state.bold, foreground: wireColor(state.foreground), background: wireColor(state.background) }, last = result.at(-1);
        if (last && last.bold === next.bold && JSON.stringify(last.foreground) === JSON.stringify(next.foreground) && JSON.stringify(last.background) === JSON.stringify(next.background))
            last.text += next.text;
        else
            result.push(next);
    }
    return result;
}
