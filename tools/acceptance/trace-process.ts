/** Optional preload for the diagnostic probe, never required for cold installation. */
import { channel } from 'node:diagnostics_channel';
import { appendFileSync } from 'node:fs';
const path = process.env.STATUSLINE_ACCEPTANCE_TIMINGS;
if (path) channel('claude-statusline.management-timing').subscribe(value => {
    const entry = value as { phase: string; elapsed_ms: number };
    if (/^(?:npm|package|management)\.[a-z-]+$/u.test(entry.phase) && Number.isFinite(entry.elapsed_ms))
        appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), pid: process.pid, phase: entry.phase, elapsed_ms: entry.elapsed_ms }) + '\n', { mode: 0o600 });
});
