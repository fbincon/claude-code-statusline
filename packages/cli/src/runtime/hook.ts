import { readJson } from '@fbincon/statusline-core/json-read';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import type { RuntimeContext } from './context.js';
import { TaskService } from './tasks/service.js';
import { AgentDurations } from './live/durations.js';
/** Lifecycle hooks must never block, restart, or fail a Claude turn. */
export function hook(read: () => string | Uint8Array, context: RuntimeContext): void {
    try {
        const raw = read(), data = readJson(typeof raw === 'string' ? raw : decodeUtf8(raw), { allowBom: true });
        new TaskService(context).handle(data);
        new AgentDurations(context).observe(data);
    }
    catch { /* The host's turn continues even when local evidence is unavailable. */ }
}
