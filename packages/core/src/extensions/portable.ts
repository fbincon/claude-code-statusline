import type { DisplayDraft } from '../contracts/ui.js';
/** A portable file cannot carry a machine's opaque authorization binding. */
export function unboundDisplay(display: DisplayDraft): DisplayDraft {
    const clear = (nodes: DisplayDraft['instances']) => nodes.map(node => node.source ? { ...node, source: { binding: null, hint: node.source.hint } } : node);
    return { ...display, instances: clear(display.instances), subagents: { ...display.subagents, instances: clear(display.subagents.instances) } };
}
