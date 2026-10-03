import type { Register, EngineInterface, PluginOptions, Timer } from 'claude-code';
import {
  BackendError,
  parseResponse,
  processFailure,
  requestText,
} from '../lib/backend.ts';
import { Editor, copyDraft, sameDraft } from '../lib/draft.ts';
import { canEdit, preferences, preferenceChanged } from '../lib/preferences.ts';
import type {
  Draft,
  Operation,
  ResultFor,
} from '../lib/generated-contracts.ts';
import type { Actions } from '../ui/controls.ts';
import { pane } from '../ui/pane.ts';
import type { View } from '../ui/pane.ts';

const PANE = 'statusline-native';
const COMMAND = 'statusline-configure-native';

async function callBackend<O extends Operation>(
  $: EngineInterface,
  options: PluginOptions,
  operation: O,
  payload: unknown = {},
): Promise<ResultFor<O>> {
  try {
    const executable =
      (await $.env.get('CLAUDE_STATUSLINE_NATIVE_EXECUTABLE')) ||
      (typeof options.backendExecutable === 'string'
        ? options.backendExecutable
        : 'claude-statusline');
    const directory =
      (await $.env.get('CLAUDE_CONFIG_DIR')) ||
      (typeof options.configDir === 'string' ? options.configDir : undefined);
    const argv = directory
      ? [executable, 'ui', '--config-dir', directory]
      : [executable, 'ui'];
    const output = await $.process.run(argv, {
      stdin: requestText(operation, payload),
      timeoutMs: 30000,
    });
    const result = parseResponse(operation, output);
    if (
      'backend_version' in result &&
      typeof options.backendVersion === 'string' &&
      options.backendVersion &&
      result.backend_version !== options.backendVersion
    ) {
      throw new BackendError(
        'backend_version_mismatch',
        'The installed Mod and backend versions differ. Reinstall matching resources.',
      );
    }
    return result;
  } catch (error) {
    throw processFailure(error);
  }
}

function emptyView(): View {
  return {
    editor: null,
    preview: null,
    preferences: [],
    preferencesError: '',
    error: '',
    previewError: '',
    previewBusy: false,
    message: '',
    busy: '',
    uncertain: false,
  };
}

function failureText(failure: unknown): string {
  const error = processFailure(failure);
  return `${error.code}: ${error.message}`.replace(
    /[\x00-\x08\x0b-\x1f\x7f]/g,
    '',
  );
}

interface Session {
  ownsCommand: boolean;
  ownsPrimary: boolean;
  view: View;
  epoch: number;
  previewKey: string;
  previewTimer: Timer | null;
  writing: boolean;
  pendingSave: { draft: Draft; revision: string } | null;
}

function discard(state: Session): void {
  state.previewTimer?.cancel();
  state.previewTimer = null;
  state.epoch += 1;
  state.view = emptyView();
  state.previewKey = '';
  state.writing = false;
  state.pendingSave = null;
}

async function load(
  $: EngineInterface,
  state: Session,
  options: PluginOptions,
) {
  discard(state);
  const opening = state.epoch;
  state.view.busy = 'Loading configuration...';
  $.ui.invalidate('ui.render');
  try {
    const description = await callBackend($, options, 'describe');
    const current = await callBackend($, options, 'read');
    if (state.epoch !== opening) return;
    if (description.backend_version !== current.backend_version) {
      throw new BackendError(
        'backend_version_mismatch',
        'The backend changed while opening. Reopen the editor.',
      );
    }
    state.view.editor = new Editor(description, current);
    if (!current.installed)
      state.view.message =
        'The renderer is not installed. Run claude-statusline install before saving.';
    try {
      const rows = await $.config.list();
      if (state.epoch === opening) state.view.preferences = preferences(rows);
    } catch (failure) {
      if (state.epoch === opening)
        state.view.preferencesError =
          'Host preferences unavailable: ' + failureText(failure);
    }
  } catch (failure) {
    if (state.epoch === opening) state.view.error = failureText(failure);
  } finally {
    if (state.epoch === opening) {
      state.view.busy = '';
      $.ui.invalidate('ui.render');
    }
  }
}

async function reconcile(
  $: EngineInterface,
  state: Session,
  options: PluginOptions,
) {
  const editor = state.view.editor;
  const submitted = state.pendingSave;
  if (!editor || !submitted || state.writing) return;
  const saving = state.epoch;
  state.writing = true;
  state.view.busy = 'Checking saved configuration...';
  $.ui.invalidate('ui.render');
  try {
    const current = await callBackend($, options, 'read');
    if (state.epoch !== saving) return;
    if (
      sameDraft(current.draft, submitted.draft) &&
      current.installed &&
      JSON.stringify(current.installation) ===
        JSON.stringify(editor.baseline.installation)
    ) {
      editor.committed(current);
      state.view.message = 'The submitted tool configuration is saved.';
      state.view.error = '';
    } else if (current.revision === submitted.revision) {
      state.view.message =
        'No tool changes were committed. Review the draft before saving again.';
      state.view.error = '';
    } else {
      state.view.error =
        'configuration_conflict: Saved configuration differs. Discard the draft and reload before saving.';
    }
    state.pendingSave = null;
    state.view.uncertain = false;
  } catch (failure) {
    if (state.epoch === saving)
      state.view.error =
        'Save outcome remains unknown. ' + failureText(failure);
  } finally {
    if (state.epoch === saving) {
      state.writing = false;
      state.view.busy = '';
      $.ui.invalidate('ui.render');
    }
  }
}

async function save(
  $: EngineInterface,
  state: Session,
  options: PluginOptions,
) {
  const editor = state.view.editor;
  if (!editor || state.writing || state.view.uncertain) return;
  if (!editor.acceptNumeric()) {
    state.view.error = 'Correct the numeric fields before saving.';
    editor.page = 'settings';
    $.ui.invalidate('ui.render');
    return;
  }
  const saving = state.epoch;
  const submitted = {
    draft: copyDraft(editor.draft),
    revision: editor.baseline.revision,
  };
  state.pendingSave = submitted;
  state.writing = true;
  state.view.busy = 'Saving tool configuration...';
  state.view.error = '';
  $.ui.invalidate('ui.render');
  try {
    const result = await callBackend($, options, 'apply', {
      draft: submitted.draft,
      expected_revision: submitted.revision,
    });
    if (state.epoch !== saving) return;
    editor.committed(result);
    state.pendingSave = null;
    state.view.message = result.changed
      ? 'Tool configuration saved. Later statusline refreshes use these settings.'
      : 'Tool configuration is already current.';
  } catch (failure) {
    if (state.epoch !== saving) return;
    const error = processFailure(failure);
    state.view.error = failureText(error);
    const refused = [
      'invalid_request',
      'invalid_configuration',
      'configuration_conflict',
      'not_installed',
      'ownership_mismatch',
      'unsupported_protocol',
      'unsupported_operation',
    ].includes(error.code);
    state.view.uncertain = !refused;
    if (refused) state.pendingSave = null;
  } finally {
    if (state.epoch === saving) {
      state.writing = false;
      state.view.busy = '';
      $.ui.invalidate('ui.render');
    }
  }
}

async function applyPreferences(
  $: EngineInterface,
  state: Session,
  options: PluginOptions,
) {
  if (state.writing || state.view.uncertain) return;
  const applying = state.epoch;
  state.writing = true;
  state.view.busy = 'Applying host preferences...';
  $.ui.invalidate('ui.render');
  try {
    for (const preference of state.view.preferences.filter(preferenceChanged)) {
      const rows = await $.config.list();
      if (state.epoch !== applying) return;
      const latest = rows.find((row) => row.key === preference.row.key);
      if (!latest) {
        preference.result = 'Unavailable; not applied.';
        continue;
      }
      if (
        JSON.stringify(latest.value) !== JSON.stringify(preference.baseline) ||
        JSON.stringify(latest.provider) !==
          JSON.stringify(preference.row.provider)
      ) {
        preference.result =
          'Changed elsewhere; discard and reload before applying.';
        continue;
      }
      preference.row = latest;
      if (!canEdit(preference)) {
        preference.result = latest.isLocked
          ? 'Locked by host policy; not applied.'
          : 'Unsupported control; not applied.';
        continue;
      }
      try {
        const result = await $.config.set({
          key: latest.key,
          value: preference.value,
        });
        if (state.epoch !== applying) return;
        if (result.deny !== undefined) {
          preference.result = 'Refused: ' + result.deny;
        } else {
          preference.baseline = result.value;
          preference.value = result.value;
          preference.row = { ...latest, value: result.value };
          preference.result = 'Applied.';
        }
      } catch (failure) {
        if (state.epoch !== applying) return;
        preference.result =
          'Could not confirm application. ' +
          failureText(failure) +
          ' Discard and reload to check.';
      }
    }
  } catch (failure) {
    if (state.epoch === applying)
      state.view.preferencesError = failureText(failure);
  } finally {
    if (state.epoch === applying) {
      state.writing = false;
      state.view.busy = '';
      $.ui.invalidate('ui.render');
    }
  }
}

async function close($: EngineInterface, state: Session) {
  // A plugin's own API calls skip its hooks; guard programmatic close here too.
  if (state.writing || state.view.uncertain) {
    state.view.error = state.writing
      ? 'Wait for the apply result before closing.'
      : 'Check the saved state before closing; the save outcome is unknown.';
    $.ui.invalidate('ui.render');
    return;
  }
  try {
    await $.ui.close({ id: PANE });
    const open = await $.ui.panes();
    if (!open.some((p) => p.id === PANE)) discard(state);
  } catch (failure) {
    state.view.error = failureText(failure);
    $.ui.invalidate('ui.render');
  }
}

async function openEditor(
  $: EngineInterface,
  state: Session,
  options: PluginOptions,
) {
  if (state.writing || state.view.uncertain)
    return {
      text: 'Finish checking the pending save before reopening the editor.',
    };
  const opening = state.epoch + 1;
  await load($, state, options);
  if (state.epoch !== opening) return {};
  const opened = await $.ui.open({
    id: PANE,
    title: 'Statusline configuration',
    focus: true,
    closeOnEscape: true,
    rows: 24,
  });
  if (!opened.isPlaced) return { text: opened.reason };
  return {};
}

export const register: Register = (on, options) => {
  const state: Session = {
    ownsCommand: false,
    ownsPrimary: false,
    view: emptyView(),
    epoch: 0,
    previewKey: '',
    previewTimer: null,
    writing: false,
    pendingSave: null,
  };

  on('session.start', async ($, e, next) => {
    state.ownsCommand = false;
    state.ownsPrimary = false;
    discard(state);
    const open = await $.ui.panes();
    if (open.some((p) => p.id === PANE)) {
      await $.ui.close({ id: PANE });
      $.ui.toast('Statusline editor reloaded. Unsaved drafts were discarded.');
    }
    const commands = await $.command.list();
    const collision = commands.find((command) => command.name === COMMAND);
    if (collision && collision.plugin !== 'statusline-native') {
      $.ui.log(
        '/statusline-configure-native belongs to another command; the alias is inactive.',
      );
    } else {
      await $.command.register({
        name: 'statusline-configure-native',
        description: 'Open the native statusline configuration editor',
      });
      state.ownsCommand = true;
    }
    if (options.primaryCommand === true) {
      const primary = commands.find(
        (command) => command.name === 'statusline-configure',
      );
      if (primary && primary.plugin !== 'statusline-native') {
        $.ui.log(
          '/statusline-configure belongs to another command; resolve the collision and restart.',
        );
      } else {
        await $.command.register({
          name: 'statusline-configure',
          description: 'Open the native statusline configuration editor',
        });
        state.ownsPrimary = true;
      }
    }
    return next(e);
  });

  on(
    'command.run',
    { command: 'statusline-configure-native' },
    async ($, e, next) => {
      if (!state.ownsCommand) return next(e);
      return openEditor($, state, options);
    },
  );

  on('command.run', { command: 'statusline-configure' }, async ($, e, next) => {
    if (!state.ownsPrimary) return next(e);
    return openEditor($, state, options);
  });

  on('ui.close', { id: 'statusline-native' }, async ($, e, next) => {
    if (e.origin.kind !== 'unload' && (state.writing || state.view.uncertain)) {
      state.view.error = state.writing
        ? 'Wait for the apply result before closing.'
        : 'Check the saved state before closing; the save outcome is unknown.';
      $.ui.invalidate('ui.render');
      return { deny: state.view.error };
    }
    const result = await next(e);
    const open = await $.ui.panes();
    if (!open.some((p) => p.id === PANE)) discard(state);
    return result;
  });

  on('ui.focus', { component: 'Pane' }, ($, e, next) => {
    if (
      e.requestId === PANE &&
      e.origin.kind === 'person' &&
      !e.element &&
      !state.writing
    ) {
      state.view.editor?.cancelNumeric();
      $.ui.invalidate('ui.render');
    }
    return next(e);
  });

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE || (!state.ownsCommand && !state.ownsPrimary))
      return next(e);
    if (e.surface !== 'terminal') {
      const { Text } = $.ui.resolve(e);
      return Text({
        children: ['Open this editor in the Claude Code terminal CLI.'],
      });
    }
    const ui = $.ui.resolve(e);
    const width = Math.max(2, Math.min(10000, e.props.bodyColumns));
    const editor = state.view.editor;
    const key = `${state.epoch}:${width}:${editor ? JSON.stringify(editor.draft) : ''}`;
    if (editor && width >= 24 && !state.writing && state.previewKey !== key) {
      state.previewKey = key;
      const requestedEpoch = state.epoch;
      const draft = copyDraft(editor.draft);
      state.previewTimer?.cancel();
      state.view.previewBusy = true;
      state.previewTimer = $.clock.after(0, async () => {
        try {
          const preview = await callBackend($, options, 'preview', { draft, width });
          if (state.epoch === requestedEpoch && state.previewKey === key) {
            state.view.preview = preview;
            state.view.previewError = '';
          }
        } catch (failure) {
          if (state.epoch === requestedEpoch && state.previewKey === key) {
            state.view.preview = null;
            state.view.previewError = failureText(failure);
          }
        } finally {
          if (state.epoch === requestedEpoch && state.previewKey === key) {
            state.view.previewBusy = false;
            state.previewTimer = null;
            $.ui.invalidate('ui.render');
          }
        }
      });
    }

    const actions: Actions = {
      edit: (change) => {
        if (!state.view.editor || state.writing || state.view.uncertain) return;
        change(state.view.editor);
        state.view.message = '';
        $.ui.invalidate('ui.render');
      },
      page: (page) => {
        if (!state.view.editor || state.writing) return;
        state.view.editor.page = page;
        $.ui.invalidate('ui.render');
      },
      save: () => save($, state, options),
      close: () => close($, state),
      reload: async () => {
        if (!state.writing && !state.view.uncertain)
          await load($, state, options);
      },
      retry: () => {
        state.previewKey = '';
        $.ui.invalidate('ui.render');
      },
      reconcile: () => reconcile($, state, options),
      preference: (key, value) => {
        if (state.writing || state.view.uncertain) return;
        const preference = state.view.preferences.find(
          (item) => item.row.key === key,
        );
        if (!preference || !canEdit(preference)) return;
        if (
          preference.row.kind === 'choice' &&
          (typeof value !== 'string' ||
            !preference.row.options?.includes(value))
        )
          return;
        if (preference.row.kind === 'boolean' && typeof value !== 'boolean')
          return;
        preference.value = value;
        preference.result = '';
        $.ui.invalidate('ui.render');
      },
      applyPreferences: () => applyPreferences($, state, options),
    };
    return pane(ui, state.view, width, actions);
  });
};
