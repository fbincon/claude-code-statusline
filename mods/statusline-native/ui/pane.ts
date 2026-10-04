import type { RenderElement } from 'claude-code';
import type { Editor, Page } from '../lib/editor/draft.ts';
import type { PreviewResult } from '../lib/generated-contracts.ts';
import type { Preference } from '../lib/preferences.ts';
import { preferenceChanged } from '../lib/preferences.ts';
import type { Actions, Controls } from './controls.ts';
import { dimensions, MIN_COLUMNS, MIN_ROWS } from './layout.ts';
import { itemPage } from './pages/items.ts';
import { settingsPage } from './pages/settings.ts';
import { preview } from './components/preview.ts';
import { toolbar } from './components/toolbar.ts';

export interface View {
  editor: Editor | null;
  preview: PreviewResult | null;
  preferences: Preference[];
  preferencesError: string;
  error: string;
  previewError: string;
  previewBusy: boolean;
  message: string;
  busy: string;
  uncertain: boolean;
}

export function contentCapacity(page: Page, rows: number): number {
  return Math.max(
    1,
    dimensions(MIN_COLUMNS, rows).bodyRows -
      (page === 'settings' ? 2 : page === 'subagents' ? 4 : 3),
  );
}

export function pane(
  ui: Controls,
  view: View,
  width: number,
  height: number,
  actions: Actions,
): RenderElement {
  const { Box, Text, Button } = ui;
  const editor = view.editor;
  const pending =
    !!editor?.modified || view.preferences.some(preferenceChanged);
  const close = Button({
    key: 'close',
    label: pending ? 'Discard pending changes' : 'Close',
    hotkey: 'q',
    plain: true,
    onPress: actions.close,
  });
  const layout = dimensions(width, height);
  if (!layout.available)
    return Box({
      flexDirection: 'column',
      height: 24,
      children: [
        Text({
          wrap: 'truncate',
          children: [`Resize pane to ${MIN_COLUMNS}x${MIN_ROWS}. Draft kept.`],
        }),
        close,
      ],
    });
  if (view.busy || !editor)
    return Box({
      flexDirection: 'column',
      height: Math.max(MIN_ROWS, height),
      children: [
        Text({
          wrap: 'truncate',
          children: [
            view.busy ||
              (view.error
                ? 'Could not open the editor.'
                : 'Loading configuration…'),
          ],
        }),
        Text({
          wrap: 'truncate',
          color: view.error ? 'red' : undefined,
          children: [view.error || ' '],
        }),
        ...(view.error && !view.busy
          ? [
              Button({
                key: 'reload',
                label: 'Reload',
                hotkey: 'r',
                onPress: actions.reload,
              }),
            ]
          : []),
        close,
      ],
    });
  const numericError = Object.entries(editor.fieldErrors)
    .map(([field, error]) => `${field}: ${error}`)
    .join(' · ');
  const preferenceResults = editor.advanced
    ? view.preferences
        .map((preference) =>
          preference.result
            ? `${preference.row.label}: ${preference.result}`
            : '',
        )
        .filter(Boolean)
        .join(' · ')
    : '';
  const notice =
    numericError ||
    view.error ||
    view.message ||
    (editor.advanced ? view.preferencesError : '') ||
    preferenceResults ||
    'Tab: focus · Enter: control';
  const capacity = contentCapacity(editor.page, height);
  return Box({
    flexDirection: 'column',
    width,
    height,
    children: [
      Text({
        bold: true,
        children: ['Configure Status Line' + (pending ? ' *' : '')],
      }),
      Box({
        flexDirection: 'row',
        columnGap: 1,
        children: (['main', 'subagents', 'settings'] as const).map((page, i) =>
          Button({
            key: 'page-' + page,
            label: ['Main', 'Subagents', 'Settings'][i],
            plain: true,
            hotkey: String(i + 1),
            dimColor: editor.page !== page,
            onPress: () => actions.page(page),
          }),
        ),
      }),
      Text({
        color: numericError || view.error ? 'red' : undefined,
        wrap: 'truncate',
        children: [notice],
      }),
      Box({
        flexDirection: 'column',
        height: layout.bodyRows,
        children:
          editor.page === 'settings'
            ? settingsPage(
                ui,
                editor,
                view.preferences,
                width,
                capacity,
                actions,
              )
            : itemPage(
                ui,
                editor,
                editor.page === 'main' ? 'main' : 'subagent',
                capacity,
                width,
                actions,
              ),
      }),
      ...preview(
        ui,
        view.preview,
        editor.page === 'subagents',
        layout.previewRows,
        view.previewBusy,
        view.previewError,
        actions,
      ),
      ...toolbar(ui, editor, view.uncertain, pending, actions),
    ],
  });
}
