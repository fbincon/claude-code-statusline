import type { RenderElement } from 'claude-code';
import type { Editor } from '../lib/draft.ts';
import type { PreviewResult } from '../lib/generated-contracts.ts';
import type { Preference } from '../lib/preferences.ts';
import { preferenceChanged } from '../lib/preferences.ts';
import { spanColor } from '../lib/backend.ts';
import type { Actions, Controls } from './controls.ts';
import { itemPage } from './items.ts';
import { preferencePage, settingsPage } from './settings.ts';

export interface View {
  editor: Editor | null;
  preview: PreviewResult | null;
  preferences: Preference[];
  preferencesError: string;
  error: string;
  previewError: string;
  message: string;
  busy: string;
  uncertain: boolean;
}

export function pane(
  ui: Controls,
  view: View,
  width: number,
  actions: Actions,
): RenderElement {
  const { Box, Text, Button } = ui;
  const editor = view.editor;
  const close = Button({
    key: 'close',
    label:
      editor?.modified || view.preferences.some(preferenceChanged)
        ? 'Close / discard pending changes'
        : 'Close',
    hotkey: 'q',
    onPress: actions.close,
  });
  const messages = [
    ...(view.error ? [Text({ color: 'red', children: [view.error] })] : []),
    ...(view.message ? [Text({ children: [view.message] })] : []),
  ];
  if (view.busy) {
    return Box({
      flexDirection: 'column',
      children: [Text({ children: [view.busy] }), ...messages, close],
    });
  }
  if (width < 24) {
    return Box({
      flexDirection: 'column',
      children: [
        Text({ children: ['Widen pane to 24 columns. Draft kept.'] }),
        ...messages,
        close,
      ],
    });
  }
  if (!editor) {
    return Box({
      flexDirection: 'column',
      children: [
        Text({
          children: [
            view.error ? 'Could not open the editor.' : 'Loading backend...',
          ],
        }),
        ...messages,
        ...(view.error
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
  }
  return Box({
    flexDirection: 'column',
    children: [
      Text({ bold: true, children: ['Statusline configuration'] }),
      Text({
        dimColor: true,
        children: [
          `Backend ${editor.baseline.backend_version}; ${editor.description.catalog.length} scoped items`,
        ],
      }),
      ...messages,
      ...(view.uncertain
        ? [
            Button({
              key: 'reconcile',
              label: 'Check saved state',
              onPress: actions.reconcile,
            }),
          ]
        : [
            Button({
              key: 'save',
              label: editor.modified
                ? 'Save tool configuration *'
                : 'Save tool configuration',
              hotkey: 's',
              onPress: actions.save,
            }),
          ]),
      close,
      Button({
        key: 'page-main',
        label: 'Main',
        hotkey: '1',
        onPress: () => actions.page('main'),
      }),
      Button({
        key: 'page-subagents',
        label: 'Subagents',
        hotkey: '2',
        onPress: () => actions.page('subagents'),
      }),
      Button({
        key: 'page-settings',
        label: 'Settings',
        hotkey: '3',
        onPress: () => actions.page('settings'),
      }),
      Text({ bold: true, children: ['Sample preview'] }),
      ...(view.previewError
        ? [
            Text({ color: 'red', children: [view.previewError] }),
            Button({
              key: 'retry',
              label: 'Retry preview',
              onPress: actions.retry,
            }),
          ]
        : []),
      ...(view.preview
        ? (editor.page === 'subagents'
            ? view.preview.subagents
            : view.preview.main
          ).map((row) =>
            Box({
              flexDirection: 'row',
              children: row.map((span) =>
                Text({
                  bold: span.bold,
                  color: spanColor(span),
                  children: [span.text],
                }),
              ),
            }),
          )
        : []),
      ...(view.preview &&
      !(
        editor.page === 'subagents' ? view.preview.subagents : view.preview.main
      ).length
        ? [Text({ dimColor: true, children: ['(empty preview)'] })]
        : []),
      ...(editor.page === 'settings'
        ? [
            ...settingsPage(ui, editor, actions),
            ...preferencePage(
              ui,
              view.preferences,
              view.preferencesError,
              actions,
            ),
          ]
        : itemPage(
            ui,
            editor,
            editor.page === 'main' ? 'main' : 'subagent',
            actions,
          )),
      Button({
        key: 'reload',
        label: 'Discard draft and reload',
        hotkey: 'r',
        onPress: actions.reload,
      }),
      Text({
        dimColor: true,
        children: [
          'Tab: focus · Enter: control · 1/2/3: page · s: save · Esc/q: close',
        ],
      }),
    ],
  });
}
