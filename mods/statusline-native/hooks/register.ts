import { performSourceAction, closeSources } from '../lib/editor/source-manager.ts';
import { taskDetailLines } from '../lib/editor/task-detail.ts';
import { receivePreset } from '../lib/editor/quick-setup.ts';
import { performProfileAction } from '../lib/editor/profile-manager.ts';
import type {
  Register,
  On,
  EngineInterface,
  PluginOptions,
  Timer,
} from 'claude-code';
import {
  BackendError,
  parseResponse,
  processFailure,
  requestText,
} from '../lib/backend.ts';
import { Editor, copyDraft, sameDraft } from '../lib/editor/draft.ts';
import { createReview } from '../lib/editor/import-review.ts';
import { canEdit, validPreferenceValue, preferences, preferenceChanged } from '../lib/preferences.ts';
import type {
  Draft,
  TaskDetails,
  Operation,
  ResultFor,
} from '../lib/generated-contracts.ts';
import { MIN_COLUMNS, MIN_ROWS, contentColumns, clip } from '../ui/layout.ts';
import { recoveryButton, styles } from '../ui/theme.ts';
import { clientProps } from '../lib/session.ts';
import type { View } from '../lib/session.ts';
import { withinBudget } from '../ui/frame.ts';
import { parseBatch } from '../lib/client/messages.ts';
import { handleKey } from '../lib/client/keys.ts';
import { DEFAULT_PREVIEW_BACKGROUND, PREVIEW_BACKGROUND_KEY, previewBackground } from '../lib/preview-preferences.ts';
import type { PreviewBackground } from '../lib/preview-preferences.ts';
import { text as localizedText, t } from '../lib/i18n/index.ts';
import type { Language } from '../lib/i18n/index.ts';
import { setMessage, failureMessage, setResult, viewMessage } from '../lib/i18n/messages.ts';
import { binding } from '../lib/launch.ts';

const PANE = 'statusline-native';
const COMMAND = 'statusline-configure-native';


async function callBackend<O extends Operation>(
  $: EngineInterface,
  options: PluginOptions,
  operation: O,
  payload: unknown = {},
): Promise<ResultFor<O>> {
  try {
    const launch = binding(options, await $.env.get('CLAUDE_STATUSLINE_NATIVE_EXECUTABLE') || undefined);
    const directory =
      (await $.env.get('CLAUDE_CONFIG_DIR')) ||
      (typeof options.configDir === 'string' ? options.configDir : undefined);
    const argv = directory
      ? [launch.executable, ...launch.args, 'ui', '--config-dir', directory]
      : [launch.executable, ...launch.args, 'ui'];
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
        localizedText("native.hooks.register.the_installed_mod_and_backend_versions_differ_reinstall"),
      );
    }
    return result;
  } catch (error) {
    throw processFailure(error);
  }
}

function emptyView(): View {
  return {
    language: 'en',
    previewBackground: DEFAULT_PREVIEW_BACKGROUND,
    editor: null,
    input: null,
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
  uiLanguage: Language;
  previewBackground: PreviewBackground;
  ownsCommand: boolean;
  view: View;
  ack: number;
  generation: number;
  columns: number;
  rows: number;
  displayColumns: number;
  displayRows: number;
  saveOutcome: 'none' | 'pending' | 'saved' | 'unknown' | 'refused';
  placed: boolean;
  clientFault: string;
  inputChain: Promise<void>;
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
  state.ack = 0;
  state.placed = false;
  state.clientFault = '';
  state.saveOutcome = 'none';
}

function props(state: Session) {
  try {
    const projected = clientProps(state.view, state.epoch, state.ack, ++state.generation, state.columns, state.rows);
    state.displayColumns = projected.displayColumns;
    state.displayRows = projected.displayRows;
    return projected;
  } catch (error) {
    state.clientFault = failureText(error).slice(0, 200);
    return null;
  }
}

function clientReply($: EngineInterface, state: Session) {
  const projected = props(state);
  if (projected && !state.clientFault) return { props: projected };
  $.ui.invalidate('ui.render');
  return {};
}

async function load(
  $: EngineInterface,
  state: Session,
  options: PluginOptions,
) {
  if (state.view.editor?.sources) await closeSources(state.view.editor,{request:(operation,payload)=>callBackend($,options,operation,payload)});
  discard(state);
  const opening = state.epoch;
  setMessage(state.view, "busy", localizedText("native.hooks.register.loading_configuration"));
  $.ui.invalidate('ui.render');
  try {
    const description = await callBackend($, options, 'describe');
    const current = await callBackend($, options, 'read', { target: { kind: 'project', path: await $.session.cwd() } });
    if (state.epoch !== opening) return;
    if (description.backend_version !== current.backend_version) {
      throw new BackendError(
        'backend_version_mismatch',
        localizedText("native.hooks.register.the_backend_changed_while_opening_reopen_the_editor"),
      );
    }
    state.view.editor = new Editor(description, current);
    try {
      const preference = await callBackend($, options, 'read_ui_preferences');
      if (state.epoch !== opening) return;
      state.uiLanguage = preference.ui_language;
      state.view.language = preference.ui_language;
      if (preference.warning) setMessage(state.view, 'message', preference.warning);
    } catch (failure) {
      if (state.epoch === opening) {
        state.view.language = state.uiLanguage;
        setMessage(state.view, 'message', localizedText('native.language_read_failed', { detail: failureMessage(failure) }));
      }
    }
    try {
      const background = previewBackground(await $.store.get(PREVIEW_BACKGROUND_KEY));
      if (state.epoch === opening) {
        state.previewBackground = background;
        state.view.previewBackground = background;
      }
    } catch {
      if (state.epoch === opening) {
        state.view.previewBackground = state.previewBackground;
        setMessage(state.view, "message", localizedText("native.hooks.register.preview_background_preference_unavailable_using_the_last_choice"));
      }
    }
    if (!current.installed)
      setMessage(state.view, "message", localizedText("native.hooks.register.the_renderer_is_not_installed_run_claude_statusline"));
    try {
      const rows = await $.config.list();
      if (state.epoch === opening) state.view.preferences = preferences(rows);
    } catch (failure) {
      if (state.epoch === opening)
        setMessage(state.view, "preferencesError", localizedText("native.hooks.register.host_preferences_unavailable", {value0: failureMessage(failure)}));
    }
  } catch (failure) {
    if (state.epoch === opening) setMessage(state.view, "error", failureMessage(failure));
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
  setMessage(state.view, "busy", localizedText("native.hooks.register.checking_saved_configuration"));
  $.ui.invalidate('ui.render');
  try {
    const current = await callBackend($, options, 'read', editor.baseline.configuration ? { target: editor.baseline.configuration.target } : {});
    if (state.epoch !== saving) return;
    if (
      sameDraft(current.draft, submitted.draft) &&
      current.installed &&
      JSON.stringify(current.installation) ===
        JSON.stringify(editor.baseline.installation)
    ) {
      editor.committed(current);
      state.saveOutcome = 'saved';
      setMessage(state.view, "message", localizedText("native.hooks.register.the_submitted_tool_configuration_is_saved"));
      state.view.error = '';
    } else if (current.revision === submitted.revision) {
      state.saveOutcome = 'refused';
      setMessage(state.view, "message", localizedText("native.hooks.register.no_tool_changes_were_committed_review_the_draft"));
      state.view.error = '';
    } else {
      state.saveOutcome = 'refused';
      setMessage(state.view, "error", localizedText("native.hooks.register.configuration_conflict_saved_configuration_differs_discard_the_draft"));
    }
    state.pendingSave = null;
    state.view.uncertain = false;
  } catch (failure) {
    if (state.epoch === saving)
      setMessage(state.view, "error", localizedText("native.hooks.register.save_outcome_remains_unknown", {value0: failureMessage(failure)}));
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
  finish = false,
) {
  const editor = state.view.editor;
  if (!editor || state.writing || state.view.uncertain) return;
  if (!editor.acceptNumeric()) {
    setMessage(state.view, "error", localizedText("native.hooks.register.correct_the_numeric_fields_before_saving"));
    editor.page = 'settings';
    editor.setting = Object.keys(editor.fieldErrors)[0] || 'padding';
    $.ui.invalidate('ui.render');
    return;
  }
  const saving = state.epoch;
  const submitted = {
    draft: copyDraft(editor.draft),
    revision: editor.baseline.revision,
  };
  state.pendingSave = submitted;
  state.saveOutcome = 'pending';
  state.writing = true;
  setMessage(state.view, "busy", localizedText("native.hooks.register.saving_tool_configuration"));
  state.view.error = '';
  let saved = false;
  $.ui.invalidate('ui.render');
  try {
    const result = await callBackend($, options, 'apply', {
      draft: submitted.draft,
      expected_revision: submitted.revision,
      ...(editor.baseline.configuration ? { target: editor.baseline.configuration.target } : {}),
    });
    if (state.epoch !== saving) return;
    editor.committed(result);
    state.pendingSave = null;
    saved = true;
    state.saveOutcome = 'saved';
    setMessage(state.view, "message", (result.changed ? localizedText("native.hooks.register.tool_configuration_saved_later_statusline_refreshes_use_these") : localizedText("native.hooks.register.tool_configuration_is_already_current")));
  } catch (failure) {
    if (state.epoch !== saving) return;
    const error = processFailure(failure);
    setMessage(state.view, "error", failureMessage(error));
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
    state.saveOutcome = refused ? 'refused' : 'unknown';
    if (refused) state.pendingSave = null;
  } finally {
    if (state.epoch === saving) {
      state.writing = false;
      state.view.busy = '';
      $.ui.invalidate('ui.render');
    }
  }
  if (finish && saved && state.epoch === saving) {
    if (state.view.preferences.some(preferenceChanged)) {
      editor.page = 'settings';
      editor.advanced = true;
      editor.setting =
        'host-' + state.view.preferences.find(preferenceChanged)!.row.key;
      setMessage(state.view, "message", localizedText("native.hooks.register.tool_configuration_saved_host_changes_pending_a_apply"));
      $.ui.invalidate('ui.render');
    } else await close($, state, options);
  }
}

async function transferDraft($: EngineInterface, state: Session, options: PluginOptions) {
  const e = state.view.editor;
  const action = e?.pendingTransfer;
  if (!e || !action || state.writing || state.view.uncertain) return;
  const epoch = state.epoch;
  e.pendingTransfer = null;
  state.writing = true;
  setMessage(state.view, "busy", (action === 'export' ? localizedText("native.hooks.register.exporting_current_draft_may_be_unsaved") : localizedText("native.hooks.register.loading_draft")));
  $.ui.invalidate('ui.render');
  try {
    if (action === 'import') {
      const original = copyDraft(e.draft);
      const candidate = new Editor(e.description, {...e.baseline, draft:copyDraft(e.draft)});
      candidate.buffers = {...e.buffers};
      if (!candidate.acceptNumeric()) { setMessage(state.view, 'message', localizedText('native.hooks.register.correct_numeric_fields_first')); return; }
      const result = await callBackend($, options, 'review_import', {draft:copyDraft(candidate.draft), path:e.path});
      if (state.epoch === epoch && state.view.editor === e) {
        if (!sameDraft(e.draft, original)) { setMessage(state.view, 'message', localizedText('review.stale')); return; }
        e.review = createReview(result, candidate.draft);
        state.view.preview = null;
        state.previewKey = '';
        state.view.message = '';
      }
      return;
    }
    if (!e.acceptNumeric()) { setMessage(state.view, "message", localizedText("native.hooks.register.correct_numeric_fields_first")); return; }
    const payload = action === 'preset' ? { draft: copyDraft(e.quick?.base ?? e.draft), preset: e.preset } : { draft: copyDraft(e.draft), path: e.path, overwrite: false };
    if (action === 'export') {
      const result = await callBackend($, options, action, payload);
      if (state.epoch === epoch) setMessage(state.view, "message", localizedText("native.hooks.register.exported_current_draft_may_be_unsaved", {path: result.path}));
    } else {
      const result = await callBackend($, options, action, payload);
      if (state.epoch === epoch) {
        if (e.quick) receivePreset(e.quick,result.draft); else e.replaceDraft(result.draft);
        setMessage(state.view, "message", localizedText("native.hooks.register.draft_replaced_review_preview_and_save_or_discard"));
        state.previewKey = '';
      }
    }
  } catch (failure) {
    if (state.epoch === epoch) setMessage(state.view, "message", failureMessage(failure));
  } finally {
    if (state.epoch === epoch) {
      state.writing = false;
      state.view.busy = '';
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
  setMessage(state.view, "busy", localizedText("native.hooks.register.applying_host_preferences"));
  state.view.message = '';
  state.view.preferencesError = '';
  $.ui.invalidate('ui.render');
  try {
    for (const preference of state.view.preferences.filter(preferenceChanged)) {
      const rows = await $.config.list();
      if (state.epoch !== applying) return;
      const latest = rows.find((row) => row.key === preference.row.key);
      if (!latest) {
        setResult(preference, localizedText("native.hooks.register.unavailable_not_applied"));
        continue;
      }
      if (
        JSON.stringify(latest.value) !== JSON.stringify(preference.baseline) ||
        latest.kind !== preference.row.kind ||
        JSON.stringify(latest.provider) !==
          JSON.stringify(preference.row.provider)
      ) {
        setResult(preference, localizedText("native.hooks.register.changed_elsewhere_discard_and_reload_before_applying"));
        continue;
      }
      preference.row = latest;
      if (!canEdit(preference)) {
        setResult(preference, (latest.isLocked ? localizedText("native.hooks.register.locked_by_host_policy_not_applied") : localizedText("native.hooks.register.unsupported_control_not_applied")));
        continue;
      }
      if (!validPreferenceValue(preference)) {
        setResult(preference, localizedText("native.hooks.register.value_no_longer_fits_this_row_discard_and"));
        continue;
      }
      try {
        const result = await $.config.set({
          key: latest.key,
          value: preference.value,
        });
        if (state.epoch !== applying) return;
        if (result.deny !== undefined) {
          setResult(preference, localizedText("native.hooks.register.refused", {deny: result.deny}));
        } else {
          preference.baseline = result.value;
          preference.value = result.value;
          preference.row = { ...latest, value: result.value };
          setResult(preference, localizedText("native.hooks.register.applied"));
        }
      } catch (failure) {
        if (state.epoch !== applying) return;
        setResult(preference, localizedText("native.hooks.register.could_not_confirm_application_discard_and_reload_to", {value0: failureMessage(failure)}));
      }
    }
  } catch (failure) {
    if (state.epoch === applying)
      setMessage(state.view, "preferencesError", failureMessage(failure));
  } finally {
    if (state.epoch === applying) {
      state.writing = false;
      state.view.busy = '';
      $.ui.invalidate('ui.render');
    }
  }
}

async function close($: EngineInterface, state: Session, options: PluginOptions) {
  if (state.view.editor?.sources) await closeSources(state.view.editor,{request:(operation,payload)=>callBackend($,options,operation,payload)});
  // A plugin's own API calls skip its hooks; guard programmatic close here too.
  if (state.writing || state.view.uncertain) {
    setMessage(state.view, "error", (state.writing ? localizedText("native.hooks.register.wait_for_the_apply_result_before_closing") : localizedText("native.hooks.register.check_the_saved_state_before_closing_the_save")));
    $.ui.invalidate('ui.render');
    return;
  }
  try {
    await $.ui.close({ id: PANE });
    const open = await $.ui.panes();
    if (!open.some((p) => p.id === PANE)) discard(state);
  } catch (failure) {
    setMessage(state.view, "error", failureMessage(failure));
    $.ui.invalidate('ui.render');
  }
}

async function openEditor(
  $: EngineInterface,
  state: Session,
  options: PluginOptions,
) {
  const tr = (key: string, params: Record<string, unknown> = {}) => t(key, state.view.language ?? 'en', params);

  if (state.writing || state.view.uncertain)
    return {
      text: tr("native.hooks.register.finish_checking_the_pending_save_before_reopening_the"),
    };
  if (!state.placed) {
    const opening = state.epoch + 1;
    await load($, state, options);
    if (state.epoch !== opening) return {};
  }
  const opened = await $.ui.open({
    id: PANE,
    title: tr("native.hooks.register.statusline_configuration"),
    focus: true,
    closeOnEscape: true,
    rows: 24,
    columns: 72,
  });
  state.placed = opened.isPlaced;
  if (!opened.isPlaced) return { text: opened.reason };
  return {};
}

/** Task host calls stay in this statically inspected entry; presentation is shared in core. */
const TASK_COMMAND = 'statusline-task', TASK_PANE = 'statusline-task-details';
export interface TaskPaneState {
  owned: boolean; loading: boolean; generation: number; offset: number;
  language: Language; report: TaskDetails | null; error: string;
}
export function taskPaneState(): TaskPaneState {
  return { owned:false, loading:false, generation:0, offset:0, language:'en', report:null, error:'' };
}
export async function startTaskDetails($: EngineInterface, state: TaskPaneState): Promise<void> {
  state.generation++; state.loading=false; state.report=null; state.error=''; state.offset=0; state.owned=false;
  const commands=await $.command.list();
  if(!commands.some(c=>c.name===TASK_COMMAND && c.plugin!=='statusline-native')) {
    await $.command.register({name:TASK_COMMAND,description:t('task.title',state.language)}); state.owned=true;
  }
}
async function refreshTaskDetails($: EngineInterface, options: PluginOptions, state: TaskPaneState): Promise<void> {
  if (state.loading) return;
  state.loading=true; state.error=''; const epoch=state.generation;
  $.ui.invalidate('ui.render');
  try {
    const launch=binding(options,await $.env.get('CLAUDE_STATUSLINE_NATIVE_EXECUTABLE') || undefined);
    const directory=await $.env.get('CLAUDE_CONFIG_DIR') || (typeof options.configDir==='string' ? options.configDir : '');
    const argv=[launch.executable,...launch.args,'ui',...(directory ? ['--config-dir',directory] : [])];
    const session=await $.session.id();
    let host_agents: { observed_at:number; agents:{id:string;name:string|null}[] } | undefined;
    try {
      const agents=await $.agent.list();
      host_agents={observed_at:await $.clock.now(),agents:agents.slice(0,256).map(a=>({id:a.id,name:[...(a.name ?? a.description ?? '').replace(/[\p{Cc}\p{Cs}]/gu,'')].slice(0,256).join('') || null}))};
    } catch { /* Published evidence remains usable without a host snapshot. */ }
    const preference=parseResponse('read_ui_preferences',await $.process.run(argv,{stdin:requestText('read_ui_preferences',{}),timeoutMs:30000}));
    const result=parseResponse('task_details',await $.process.run(argv,{stdin:requestText('task_details',{session_id:session,...(host_agents ? {host_agents} : {})}),timeoutMs:30000}));
    if(result.session_id!==session)throw new Error(t('task.error.input',state.language));
    if(state.generation!==epoch)return;
    state.report=result;state.language=preference.ui_language;state.offset=0;
  } catch(failure) {
    if(state.generation===epoch)state.error=failure instanceof Error ? failure.message : String(failure);
  } finally {
    if(state.generation===epoch){state.loading=false;$.ui.invalidate('ui.render');}
  }
}
export function registerTaskDetails(on: On, options: PluginOptions, state: TaskPaneState): void {
  const tr=(key:string)=>t(key,state.language);
  on('command.run',{command:'statusline-task'},async($,e,next)=>{
    if(!state.owned)return next(e);
    const opened=await $.ui.open({id:TASK_PANE,title:tr('task.title'),focus:true,closeOnEscape:true,rows:24,columns:88});
    if(!opened.isPlaced)return {text:tr('task.fallback')};
    await refreshTaskDetails($,options,state);return {};
  });
  on('ui.close',{id:'statusline-task-details'},async($,e,next)=>{
    state.generation++;state.loading=false;state.report=null;state.error='';return next(e);
  });
  on('ui.render',{component:'Pane',requestId:'statusline-task-details'},async($,e,next)=>{
    if(!state.owned)return next(e);
    const {Box,Text,Button}=$.ui.resolve(e);
    if(e.surface!=='terminal')return Text({...styles.text,children:[tr('task.fallback')]});
    const width=Math.max(2,e.props.bodyColumns),height=Math.max(4,e.props.scroll.bodyRows),capacity=Math.max(1,height-3);
    const lines=state.report ? taskDetailLines(state.report,state.language,Math.max(2,width-2)) : [tr(state.loading?'profiles.loading':'task.unknown')];
    state.offset=Math.max(0,Math.min(state.offset,Math.max(0,lines.length-capacity)));
    return Box({width,height,flexDirection:'column',children:[
      Text({...styles.accent,bold:true,wrap:'truncate',children:[tr('task.title')+' · '+(state.loading?tr('profiles.loading'):tr('task.readonly'))]}),
      ...lines.slice(state.offset,state.offset+capacity).map(line=>Text({...styles.text,wrap:'truncate',children:[line]})),
      ...(state.error?[Text({...styles.error,wrap:'truncate',children:[state.error.replace(/[\p{Cc}\p{Cs}]/gu,'')]} )]:[]),
      Box({flexDirection:'row',columnGap:1,children:[
        Button({...recoveryButton,key:'task-up',label:'↑',hotkey:'k',onPress:()=>{state.offset=Math.max(0,state.offset-capacity);$.ui.invalidate('ui.render');}}),
        Button({...recoveryButton,key:'task-down',label:'↓',hotkey:'j',onPress:()=>{state.offset=Math.min(Math.max(0,lines.length-capacity),state.offset+capacity);$.ui.invalidate('ui.render');}}),
        Button({...recoveryButton,key:'task-refresh',label:tr('profiles.refresh'),hotkey:'r',onPress:()=>refreshTaskDetails($,options,state)}),
        Button({...recoveryButton,key:'task-close',label:tr('task.close'),hotkey:'q',onPress:()=>$.ui.close({id:TASK_PANE})}),
      ]}),
    ]});
  });
}

export const register: Register = (on, options) => {
  const taskDetails = taskPaneState();
  registerTaskDetails(on, options, taskDetails);
  const tr = (key: string, params: Record<string, unknown> = {}) => t(key, state.view.language ?? 'en', params);

  const state: Session = {
    uiLanguage: 'en',
    previewBackground: DEFAULT_PREVIEW_BACKGROUND,
    ownsCommand: false,
    view: emptyView(),
    epoch: 0,
    ack: 0,
    generation: 0,
    columns: 72,
    rows: 24,
    displayColumns: 72,
    displayRows: 24,
    saveOutcome: 'none',
    placed: false,
    clientFault: '',
    inputChain: Promise.resolve(),
    previewKey: '',
    previewTimer: null,
    writing: false,
    pendingSave: null,
  };

  on('session.start', async ($, e, next) => {
    await startTaskDetails($, taskDetails);
    state.ownsCommand = false;
    if (state.view.editor?.sources) await closeSources(state.view.editor,{request:(operation,payload)=>callBackend($,options,operation,payload)});
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
        '/statusline-configure-native belongs to another command; the Client entry is inactive.',
      );
    } else {
      await $.command.register({
        name: 'statusline-configure-native',
        description: tr("native.hooks.register.open_the_experimental_in_session_client_tui"),
      });
      state.ownsCommand = true;
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

  on('ui.close', { id: 'statusline-native' }, async ($, e, next) => {
    if (e.origin.kind !== 'unload' && (state.writing || state.view.uncertain)) {
      setMessage(state.view, "error", (state.writing ? localizedText("native.hooks.register.wait_for_the_apply_result_before_closing") : localizedText("native.hooks.register.check_the_saved_state_before_closing_the_save")));
      $.ui.invalidate('ui.render');
      return { deny: state.view.error };
    }
    if (state.view.editor?.sources) await closeSources(state.view.editor,{request:(operation,payload)=>callBackend($,options,operation,payload)});
    const result = await next(e);
    const open = await $.ui.panes();
    if (!open.some((p) => p.id === PANE)) discard(state);
    return result;
  });

  // Namespace registration remains valid on hosts predating ui.fault.
  on('ui.*', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (String(next.event) === 'ui.fault' && state.ownsCommand) {
      const fault = e as unknown as { component?: string; requestId?: string; element?: string; module?: string; surface?: string; reason?: unknown };
      if (fault.component === 'Pane' && fault.requestId === PANE && fault.element === 'statusline-client-' + state.epoch && fault.module === 'ui/client/surface.ts' && fault.surface === 'terminal') {
        state.clientFault = failureText(fault.reason).slice(0, 200);
      }
    }
    return next(e);
  });

  on('ui.message', { component: 'Pane' }, async ($, e, next) => {
    if (
      e.requestId !== PANE ||
      e.element !== 'statusline-client-' + state.epoch ||
      e.module !== 'ui/client/surface.ts' ||
      e.surface !== 'terminal' ||
      !state.ownsCommand
    )
      return next(e);
    const fault = e.data as { epoch?: unknown; fault?: unknown } | null;
    if (
      fault &&
      typeof fault === 'object' &&
      Object.keys(fault).sort().join(',') === 'epoch,fault' &&
      fault.epoch === state.epoch &&
      typeof fault.fault === 'string' &&
      fault.fault.length > 0 &&
      fault.fault.length <= 200
    ) {
      state.clientFault = failureText(fault.fault);
      $.ui.invalidate('ui.render');
      return {};
    }
    const batch = parseBatch(e.data);
    if (!batch) {
      setMessage(state.view, "error", localizedText("native.hooks.register.invalid_client_input_retry_the_client_region"));
      return clientReply($, state);
    }
    const run = state.inputChain.then(async () => {
      if (batch.epoch !== state.epoch || !state.placed) return {};
      const currentEpoch = state.epoch;
      if (state.columns !== batch.columns || state.rows !== batch.rows) {
        state.columns = batch.columns;
        state.rows = batch.rows;
        props(state);
      }
      for (const message of batch.events) {
        if (message.seq <= state.ack) continue;
        if (message.seq !== state.ack + 1) {
          setMessage(state.view, "error", localizedText("native.hooks.register.client_input_sequence_is_incomplete_retry_the_client"));
          break;
        }
        state.ack = message.seq;
        state.view.message = '';
        const effect = handleKey(
          state.view,
          message.event,
          state.displayColumns,
          state.displayRows,
        );
        if (effect === 'save' || effect === 'finish') {
          await save($, state, options, effect === 'finish');
        } else if (effect === 'close') await close($, state, options);
        else if (effect === 'reload') {
          await load($, state, options);
          state.placed = true;
        } else if (effect === 'reconcile') await reconcile($, state, options);
        else if (effect === 'transfer') await transferDraft($, state, options);
        else if (effect === 'sources' && state.view.editor) {
          state.writing=true;
          try { await performSourceAction(state.view.editor,{request:(operation,payload)=>callBackend($,options,operation,payload)}); }
          finally {state.writing=false;state.previewKey='';}
        }
        else if (effect === 'profiles' && state.view.editor) {
          state.writing = true;
          try { await performProfileAction(state.view.editor, { request: (operation, payload) => callBackend($, options, operation, payload) }); }
          finally { state.writing = false; state.previewKey = ''; }
        }
        else if (effect === 'applyPreferences')
          await applyPreferences($, state, options);
        else if (effect === 'retry') state.previewKey = '';
        else if (effect === 'reviewPreview' || effect === 'explain') {
          state.previewTimer?.cancel();
          state.previewKey = '';
          state.view.preview = null;
          state.view.previewError = '';
        }
        else if (effect === 'uiLanguage') {
          const requested = state.view.language ?? 'en';
          try {
            const preference = await callBackend($, options, 'set_ui_language', {ui_language: requested});
            if (state.epoch === currentEpoch) {
              state.uiLanguage = preference.ui_language;
              state.view.language = preference.ui_language;
              if (state.view.localized?.error?.key === 'native.language_save_failed') state.view.error = '';
              setMessage(state.view, 'message', localizedText('native.language_saved'));
            }
          } catch (failure) {
            if (state.epoch === currentEpoch) {
              state.view.language = state.uiLanguage;
              setMessage(state.view, 'error', localizedText('native.language_save_failed', {detail: failureMessage(failure)}));
            }
          }
        }
        else if (effect === 'previewBackground') {
          const background = previewBackground(state.view.previewBackground);
          try {
            await $.store.set(PREVIEW_BACKGROUND_KEY, background);
            if (state.epoch === currentEpoch) {
              state.previewBackground = background;
              if (state.view.localized?.error?.key === 'native.remember_preview_failed') state.view.error = '';
              setMessage(state.view, "message", localizedText("native.hooks.register.preview_background_remembered_status_line_colors_unchanged"));
            }
          } catch {
            if (state.epoch === currentEpoch) {
              state.view.previewBackground = state.previewBackground;
              setMessage(state.view, 'error', localizedText('native.remember_preview_failed'));
            }
          }
        }
        if (state.epoch !== currentEpoch) break;
      }
      $.ui.invalidate('ui.render');
      if (state.epoch !== currentEpoch) return {};
      return clientReply($, state);
    });
    state.inputChain = run.then(
      () => {},
      () => {},
    );
    return run;
  }).catch(($, e, next) => {
    if (e.requestId !== PANE || !state.ownsCommand) return next(e);
    state.clientFault = failureText(next.error.message ?? 'Client reply failed').slice(0, 200);
    $.ui.invalidate('ui.render');
    return {};
  });

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE || !state.ownsCommand) return next(e);
    const ui = $.ui.resolve(e);
    if (e.surface !== 'terminal')
      return ui.Text({
        ...styles.text,
        children: [tr("native.hooks.register.open_this_editor_in_the_claude_code_terminal")],
      });
    const { Box, Text, Button, Client } = $.ui.resolve(e);
    const width = Math.max(2, Math.min(10000, e.props.bodyColumns));
    const height = Math.max(0, Math.min(10000, e.props.scroll.bodyRows));
    state.columns = width;
    state.rows = height;
    const editor = state.view.editor;
    const previewDraft = editor?.profiles?.candidate ? { ...editor.draft, display: editor.profiles.candidate } : editor?.quick?.candidate ?? editor?.review?.result.draft ?? editor?.draft;
    const previewColumns = contentColumns(width, height);
    const explanation=editor?.explanation;
    const key = `${state.epoch}:${previewColumns}:${explanation ? explanation.scope+':'+explanation.id : ''}:${previewDraft ? JSON.stringify(previewDraft) : ''}`;
    if (
      editor &&
      width >= MIN_COLUMNS &&
      height >= MIN_ROWS &&
      !state.writing &&
      state.previewKey !== key
    ) {
      state.previewKey = key;
      const requestedEpoch = state.epoch;
      const draft = copyDraft(previewDraft!);
      state.previewTimer?.cancel();
      state.view.previewBusy = true;
      state.previewTimer = $.clock.after(0, async () => {
        try {
          const explained=explanation ? await callBackend($,options,'explain',{draft,scope:explanation.scope,width:previewColumns}) : null;
          if(explained && (explained.scope!==explanation!.scope || explained.width!==previewColumns)) throw new Error('Explanation response does not match the request');
          const preview=explained?.preview ?? await callBackend($, options, 'preview', {draft,width:previewColumns});
          if (state.epoch === requestedEpoch && state.previewKey === key) {
            if(explanation && explained) { explanation.result=explained;explanation.error=''; }
            state.view.preview = preview;
            state.view.previewError = '';
          }
        } catch (failure) {
          if (state.epoch === requestedEpoch && state.previewKey === key) {
            if(explanation) explanation.error=failureMessage(failure).fallback;
            state.view.preview = null;
            setMessage(state.view, "previewError", failureMessage(failure));
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
    const retry = async () => {
      if (state.writing || state.view.uncertain) return;
      if (!state.view.editor) await load($, state, options);
      else {
        state.epoch++;
        state.ack = 0;
        state.clientFault = '';
        state.view.error = '';
      }
      state.placed = true;
      $.ui.invalidate('ui.render');
    };
    if (
      editor &&
      !state.clientFault &&
      width >= MIN_COLUMNS &&
      height >= MIN_ROWS
    ) {
      const projected = props(state);
      const tree = projected ? Box({
        width,
        height,
        flexDirection: 'column',
        children: [
          Client({
            key: 'statusline-client-' + state.epoch,
            module: '../ui/client/surface.ts',
            width,
            height,
            props: projected,
          }),
          Box({
            position: 'absolute',
            top: 0,
            right: 0,
            width: 20,
            height: 1,
            flexDirection: 'row',
            columnGap: 1,
            children: [
              Button({ ...recoveryButton, key: 'retry-client', label: tr("native.hooks.register.retry"), onPress: retry }),
              Button({
                ...recoveryButton,
                key: 'close',
                label: tr("native.hooks.register.close"),
                onPress: () => close($, state, options),
              }),
            ],
          }),
        ],
      }) : null;
      if (tree && withinBudget(tree)) return tree;
      state.clientFault ||= tr('native.capacity.failed');
    }
    return Box({
      backgroundColor: styles.text.backgroundColor,
      flexDirection: 'column',
      width,
      // Keep the requested height while undersized; otherwise an inline host
      // measures the short error tree and never grows it after a terminal resize.
      height: Math.max(24, height),
      children: [
        Text({
          ...styles.text,
          bold: true,
          wrap: 'truncate',
          children: [
            width < MIN_COLUMNS || height < MIN_ROWS
              ? tr("native.hooks.register.resize_pane_to_32x12_draft_kept")
              : state.clientFault
                ? tr("native.hooks.register.client_failed_received_draft_kept")
                : viewMessage(state.view, 'busy') || tr("native.hooks.register.could_not_open_the_client_editor"),
          ],
        }),
        Text({
          ...styles.error,
          wrap: 'truncate',
          children: [clip((state.clientFault || viewMessage(state.view, 'error') || ' ').slice(0, 200), Math.min(width, 200))],
        }),
        Text({ ...styles.text, wrap: 'truncate', children: [clip(
          state.saveOutcome === 'saved' ? tr('native.capacity.saved') : state.view.uncertain ? tr('native.capacity.unknown') : state.writing ? viewMessage(state.view, 'busy') : tr('native.capacity.retained'),
          Math.min(width, 200),
        )] }),
        ...(state.view.uncertain
          ? [
              Button({
                ...recoveryButton,
                key: 'reconcile',
                label: tr("native.hooks.register.check_saved_state"),
                hotkey: 'k',
                onPress: () => reconcile($, state, options),
              }),
            ]
          : []),
        ...(!state.view.busy && !state.view.uncertain
          ? [
              Button({
                ...recoveryButton,
                key: 'retry-client',
                label: tr("native.hooks.register.retry_client"),
                hotkey: 'r',
                onPress: retry,
              }),
            ]
          : []),
        Button({
          ...recoveryButton,
          key: 'close',
          label: tr("native.hooks.register.discard_pending_close"),
          hotkey: 'q',
          onPress: () => close($, state, options),
        }),
      ],
    });
  }).catch(($, e, next) => {
    if (e.requestId !== PANE || !state.ownsCommand || e.surface !== 'terminal') return next(e);
    state.clientFault = failureText(next.error.message ?? 'Pane rendering failed').slice(0, 200);
    $.ui.invalidate('ui.render');
    const { Box, Text, Button } = $.ui.resolve(e);
    return Box({ flexDirection: 'column', children: [
      Text({ children: [tr('native.capacity.failed')] }),
      Text({ children: [state.saveOutcome === 'saved' ? tr('native.capacity.saved') : state.view.uncertain ? tr('native.capacity.unknown') : tr('native.capacity.retained')] }),
      Button({ ...recoveryButton, key: 'retry-client', label: tr('native.hooks.register.retry_client'), onPress: () => {
        if (state.writing || state.view.uncertain) return;
        state.epoch++; state.ack = 0; state.clientFault = '';
        $.ui.invalidate('ui.render');
      } }),
      ...(state.view.uncertain ? [Button({ ...recoveryButton, key: 'reconcile', label: tr('native.hooks.register.check_saved_state'), onPress: () => reconcile($, state, options) })] : []),
      Button({ ...recoveryButton, key: 'close', label: tr('native.hooks.register.discard_pending_close'), onPress: () => close($, state, options) }),
    ] });
  });
};
