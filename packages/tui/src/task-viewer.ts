import { taskViewerKey, type TaskViewer } from '@fbincon/statusline-core/editor/task-viewer';
import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
import { terminal, type TerminalOptions } from '@fbincon/statusline-platform/terminal/session';
import { Canvas, ansiFrame, paintLine } from './drawing/canvas.js';
import { taskReportStatus } from './drawing/presentation.js';
import { shortcuts, taskFooter } from './drawing/shortcuts.js';
import { paint } from './theme.js';
import type { Backend } from './session.js';
import { ForegroundRefresh } from './foreground-refresh.js';
import { externalTaskRows, taskRefresh } from './report-refresh.js';
import { canvasSize, usesReportRows } from './layout.js';

function standaloneRows(view: TaskViewer, columns: number, rows: number) {
    const size = canvasSize(columns, rows);
    return externalTaskRows(view, size.columns, Math.max(1, size.rows - 3));
}

export function taskFrame(view: TaskViewer, columns: number, rows: number) {
    const canvas = new Canvas(columns, rows);
    canvas.put(0, 0, [paint(t('task.title', view.language) + ' · ' + taskReportStatus(view), true)]);
    standaloneRows(view, canvas.columns, canvas.rows)
        .forEach((row, index) => canvas.put(index + 1, 0, paintLine(row, canvas.columns, row.selected)));
    const { actions, help } = taskFooter(view);
    canvas.put(canvas.rows - 2, 0, shortcuts(view.input ? actions : [...actions, help[0]!], canvas.columns));
    canvas.put(canvas.rows - 1, 0, view.input ? shortcuts(help, canvas.columns) : [paint(t('task.viewer.help_read', view.language))]);
    return canvas.frame();
}
export async function runTaskViewer(view: TaskViewer, backend: Backend, options: TerminalOptions = {}, language?: Language): Promise<number> {
    const refresh = new ForegroundRefresh(() => taskRefresh(view, backend, language), options.now);
    let colors = 16;
    return terminal<number>({
        ready: capability => { colors = capability.colors; },
        observe: submit => { refresh.bind(submit); refresh.tick(); },
        closing: () => refresh.close(),
        draw: (columns, rows) => ansiFrame(taskFrame(view, columns, rows), colors),
        key: (event, columns, rows) => {
            if (event.ctrl && event.key.toLowerCase() === 'c')
                return 130;
            if (!view.input && usesReportRows(event)) standaloneRows(view, columns, rows);
            const effect = taskViewerKey(view, event);
            if (effect === 'close')
                return 0;
            if (effect === 'read')
                refresh.immediate();
            return null;
        },
        interrupted: signal => signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 129,
        timeout: () => 0,
    }, options);
}
