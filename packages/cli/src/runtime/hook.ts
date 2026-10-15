import { readJson } from '@fbincon/statusline-core/json-read';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import type { RuntimeContext } from './context.js';
import { TaskService } from './tasks/service.js';
import { object } from '@fbincon/statusline-core/runtime/values';
import { float } from '@fbincon/statusline-core/runtime/transcript';
/** Lifecycle hooks must never block, restart, or fail a Claude turn. */
export async function hook(read: () => string | Uint8Array, context: RuntimeContext): Promise<void> {
    try {
        const raw = read(), data = readJson(typeof raw === 'string' ? raw : decodeUtf8(raw), { allowBom: true });
        new TaskService(context).handle(data);
        if (object(data) && ['SubagentStart', 'SubagentStop'].includes(data.hook_event_name as string)) {
            const now = float(context.nowMs());
            const { AgentDurations } = await import('./live/durations.js');
            new AgentDurations(context).observe(data, now);
        }
    }
    catch { /* The host's turn continues even when local evidence is unavailable. */ }
}
