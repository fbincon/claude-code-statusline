/** Opt-in diagnostics for controlled acceptance; never publish arguments, paths or environments. */
import { channel } from 'node:diagnostics_channel';
const events = channel('claude-statusline.management-timing');
const noop = () => {};
export function phaseTimer(phase: string): () => void {
    if (!events.hasSubscribers) return noop;
    const started = performance.now();
    return () => events.publish({ phase, elapsed_ms: performance.now() - started });
}
export function phaseMarker(): (stage: string) => void {
    if (!events.hasSubscribers) return noop;
    let previous = performance.now();
    return stage => { const now = performance.now(); events.publish({ phase: 'management.' + stage, elapsed_ms: now - previous }); previous = now; };
}
