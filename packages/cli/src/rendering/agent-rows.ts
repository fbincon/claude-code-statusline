import { isAbsolute } from 'node:path';
import { safeInteger } from '@fbincon/statusline-core/json';
import { renderOrderedTasks } from '@fbincon/statusline-core/rendering/subagents';
import { trim } from '@fbincon/statusline-core/runtime/transcript';
import { object } from '@fbincon/statusline-core/runtime/values';
import { renderEnvironment } from './environment.js';
import { configDirectory, displayForRender } from './main.js';

export const AGENT_ROW_PROTOCOL_BYTES = 8 * 1024 * 1024;

/** An omitted id leaves the host row intact. An empty body explicitly hides it. */
export async function renderAgentRowBatch(data: unknown, configDir: string): Promise<{ id: string; body?: string }[]> {
    if (!object(data) || !Array.isArray(data.tasks) || !data.tasks.length ||
        typeof data.session_id !== 'string' || !trim(data.session_id) ||
        typeof data.cwd !== 'string' || !isAbsolute(data.cwd) || data.cwd.includes('\0') || !configDir) return [];
    try {
        const columns = safeInteger(data.columns, 0, 10_000);
        const widths = new Map<string, number>();
        for (const task of data.tasks) {
            if (!object(task) || typeof task.id !== 'string' || !trim(task.id) || widths.has(task.id)) return [];
            widths.set(task.id, safeInteger(task._row_columns, 0, columns));
        }
        const payload = { session_id: data.session_id, cwd: data.cwd, tasks: data.tasks };
        const directory = configDirectory(configDir), display = displayForRender(directory, payload);
        if (!display.subagents.enabled) return [];
        const now = Date.now();
        const environment = await renderEnvironment(display, payload, { configDir: directory }, true);
        const { rows, failed } = renderOrderedTasks({
            tasks: payload.tasks, sessionId: payload.session_id, columns: widths, maxOutputUnits: AGENT_ROW_PROTOCOL_BYTES,
        }, display, environment, now);
        return failed ? [] : rows.map(({ id, content }) => ({ id, body: content }));
    }
    catch {
        // A partial batch could hide a different sibling or rotate its colors incorrectly.
        return [];
    }
}
