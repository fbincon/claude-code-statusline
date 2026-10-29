import { taskViewerView, taskViewerKey, readTask, type TaskViewer } from '@fbincon/statusline-core/editor/task-viewer';
import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
import { terminal, type TerminalOptions } from '@fbincon/statusline-platform/terminal/session';
import { Canvas, ansiFrame } from './drawing/canvas.js';
import { paint } from './theme.js';
import type { Backend } from './session.js';
export function taskFrame(view: TaskViewer, columns: number, rows: number) {
    const canvas = new Canvas(columns, rows);
    canvas.put(0, 0, [paint(t('task.title', view.language) + ' · ' + t('task.readonly', view.language), true)]);
    taskViewerView(view, Math.max(1, columns), Math.max(1, rows - 3)).forEach((row, index) => canvas.put(index + 1, 0, [paint(row.text, false, row.selected)]));
    canvas.put(rows - 2, 0, [paint(t('task.viewer.help', view.language))]);
    canvas.put(rows - 1, 0, [paint(t('task.viewer.help_read', view.language))]);
    return canvas.frame();
}
export async function runTaskViewer(view: TaskViewer, backend: Backend, options: TerminalOptions = {}, language?: Language): Promise<number> {
    await readTask(view, backend, undefined, language);
    let colors = 16;
    return terminal<number>({
        ready: capability => { colors = capability.colors; },
        draw: (columns, rows) => ansiFrame(taskFrame(view, columns, rows), colors),
        key: async (event) => {
            if (event.ctrl && event.key.toLowerCase() === 'c')
                return 130;
            const effect = taskViewerKey(view, event);
            if (effect === 'close')
                return 0;
            if (effect === 'read')
                await readTask(view, backend, undefined, language);
            return null;
        },
        interrupted: signal => signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 129,
        timeout: () => 0,
    }, options);
}
