import type { AlignmentManager } from './alignment-manager.js';
import type { GroupManager } from './group-manager.js';
import { groupScope, reconcileGroups, insertionAfter } from './groups.js';
import type { ExplanationView } from './explanation.js';
import type { SourceManager } from './source-manager.js';
import type { ProfileManager } from './profile-manager.js';
import type { QuickSetup } from './quick-setup.js';
import { t, text, type Language } from '../i18n/messages.js';
import { emptyHistory, remember, snapshot, boundHistory, semantic, type DraftHistory } from './history.js';
import { repairStructure, type StructureProposal } from './structure.js';
import { openChanges, targetIdentity, type ChangeReview } from './change-review.js';
import { EditorShortcuts } from './shortcut-settings.js';
import type { EditorSurface } from './shortcut-map.js';
import { componentTypes, instanceUnit, nodes, newInstance, reconcileRows, swapAdjacentUnits } from './instances.js';
import { isDraft } from './backend.js';
import type {
  CatalogItem,
  DescribeResult,
  Draft,
  ReadResult,
  Scope,
  ConfigTarget,
} from '../contracts/ui.js';
import { NUMERIC_FIELDS, numericValue, numericDiagnostic } from './numeric.js';
import { bestMatch, fields, normalize } from './search.js';
import type { Match } from './search.js';
import type { ReviewState } from './import-review.js';
import type { LocalizedText } from '../i18n/messages.js';
import type { NumericField } from './numeric.js';
export type { NumericField } from './numeric.js';

export const EDITOR_PAGES = ['main', 'subagents', 'layout', 'settings'] as const;
export type Page = typeof EDITOR_PAGES[number];

export function cycleEditorPage(page: Page, reverse = false): Page {
  const offset = reverse ? -1 : 1;
  return EDITOR_PAGES[(EDITOR_PAGES.indexOf(page) + offset + EDITOR_PAGES.length) % EDITOR_PAGES.length]!;
}

/** Copy wire data without sharing editable arrays with the opening snapshot. */
export function copyDraft(draft: Draft): Draft {
  return JSON.parse(JSON.stringify(draft)) as Draft;
}

export function sameDraft(left: Draft, right: Draft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
export const isSaveConflict = (code: string): boolean => code === 'configuration_conflict' || code === 'profile_conflict';
export const definitiveSaveRefusal = (code: string): boolean => isSaveConflict(code) || ['invalid_request','invalid_configuration','not_installed','ownership_mismatch','unsupported_protocol','unsupported_operation'].includes(code);
export interface PendingSave {
  draft: Draft; revision: string; target?: ConfigTarget; installation: ReadResult['installation'];
}

interface ItemListContext {
  search: string;
  category: string;
  selected: string;
}

interface Picker extends ItemListContext {
  scope: Scope;
  anchor: string;
  changed: string;
  notice: LocalizedText | null;
}

/** Pure tool draft. Persistence and host configuration calls live in the hook. */
export class Editor {
  draft: Draft;
  readonly shortcuts: EditorShortcuts;
  reuse: import('./reuse-manager.js').ReuseManager | null = null;
  history: DraftHistory = emptyHistory();
  changeReview: ChangeReview | null = null;
  structureProposal: StructureProposal | null = null;
  numericBefore: Draft | null = null;
  baseline: ReadResult;
  page: Page = 'main';
  previewScenario: import('./preview-settings.js').PreviewScenario = 'normal';
  previewWidth = 'auto';
  previewOffsets: import('./preview-settings.js').PreviewOffsets = {};
  advanced = false;
  picker: Picker | null = null;
  detail: { scope: Scope; id: string } | null = null;
  guidanceScroll: number | null = null;
  review: ReviewState | null = null;
  quick: QuickSetup | null = null;
  diagnosis: import('./diagnosis-view.js').DiagnosisView | null = null;
  colors: import('./color-manager.js').ColorManager | null = null;
  explanation: ExplanationView | null = null;
  profiles: ProfileManager | null = null;
  sourceDraftRegistered = false;
  sourceDraftOwner = 'draft-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  sources: SourceManager | null = null;
  taskViewer: import('./task-viewer.js').TaskViewer | null = null;
  packages: import('./package-manager.js').PackageManager | null = null;
  groupManager: GroupManager | null = null;
  alignmentManager: AlignmentManager | null = null;
  compositionError: LocalizedText = text('composition.invalid');
  preset = 'minimal';
  path = 'statusline.json';
  pendingTransfer: 'import' | 'export' | 'preset' | null = null;
  setting = 'colors';
  activeNumeric: NumericField | null = null;
  selected: Record<Scope, string>;
  order: Record<Scope, string[]>;
  search: Record<Scope, string> = { main: '', subagent: '' };
  category: Record<Scope, string> = { main: 'all', subagent: 'all' };
  buffers: Record<NumericField, string>;
  fieldErrors: Partial<Record<NumericField, string>> = {};
  fieldErrorMessages: Partial<Record<NumericField, LocalizedText>> = {};
  packageLocked = false;
  saveState: 'idle' | 'pending' | 'unknown' = 'idle';
  pendingSave: PendingSave | null = null;
  mutationGeneration = 0;

  canMutateDraft(generation = this.mutationGeneration): boolean {
    if (this.packageLocked) { this.compositionError=text('package.ui.editor_locked');return false; }
    if (this.saveState === 'idle' && generation === this.mutationGeneration) return true;
    this.compositionError = text('editor.save_locked');
    return false;
  }
  setSaveState(value: Editor['saveState']): void {
    if (this.saveState !== value) this.mutationGeneration++;
    this.saveState = value;
  }
  beginSave(): PendingSave {
    if (!this.canMutateDraft()) throw new Error('A display save is already unresolved');
    this.pendingSave = {draft:copyDraft(this.draft),revision:this.baseline.revision,installation:JSON.parse(JSON.stringify(this.baseline.installation)) as ReadResult['installation'],
      ...(this.baseline.configuration ? {target:JSON.parse(JSON.stringify(this.baseline.configuration.target)) as ConfigTarget} : {})};
    this.setSaveState('pending');
    return this.pendingSave;
  }
  saveFailed(code: string): void {
    const refused = definitiveSaveRefusal(code);
    this.setSaveState(refused ? 'idle' : 'unknown');
    if (refused) this.pendingSave = null;
  }
  reconcileSave(current: ReadResult): 'saved' | 'not_committed' | 'conflict' {
    const submitted = this.pendingSave;
    if (!submitted) throw new Error('No pending display save');
    const outcome = sameDraft(current.draft,submitted.draft) && current.installed && JSON.stringify(current.installation) === JSON.stringify(submitted.installation) ? 'saved' : current.revision === submitted.revision ? 'not_committed' : 'conflict';
    if (outcome === 'saved') this.committed(current);
    else { this.pendingSave=null;this.setSaveState('idle'); }
    return outcome;
  }

  constructor(
    public readonly description: DescribeResult,
    current: ReadResult,
    surface: EditorSurface = 'native',
  ) {
    this.shortcuts = new EditorShortcuts(surface);
    description.catalog.forEach(item => fields(item));
    this.baseline = { ...current, draft: copyDraft(current.draft) };
    this.draft = copyDraft(current.draft);
    this.order = { main: [], subagent: [] };
    this.selected = { main: '', subagent: '' };
    for (const scope of ['main', 'subagent'] as const) {
      this.order[scope] = nodes(this.draft,scope).map(i=>i.id);
      this.selected[scope] = this.order[scope][0] || '';
    }
    this.buffers = {
      padding: String(this.draft.host.padding),
      refresh_interval: String(this.draft.host.refresh_interval),
    };
  }

  private restoreDraft(draft: Draft): void {
    this.draft = copyDraft(draft);
    for (const scope of ['main', 'subagent'] as const) {
      this.order[scope] = nodes(this.draft,scope).map(i=>i.id);
      if (!this.order[scope].includes(this.selected[scope])) this.selected[scope] = this.order[scope][0] || '';
    }
    this.buffers = { padding: String(draft.host.padding), refresh_interval: String(draft.host.refresh_interval) };
    this.fieldErrors = {};
    this.fieldErrorMessages = {};
    this.activeNumeric = null;
    this.detail = null;
    this.guidanceScroll = null;
    this.explanation = null;
    this.review = null; this.alignmentManager = null;
  }

  /** The only accepted draft transition; tentative input and candidates stay separate. */
  commitDraft(draft: Draft, label: LocalizedText = text('history.edit')): boolean {
    if (!this.canMutateDraft() || !isDraft(draft)) return false;
    if (semantic(this.draft) === semantic(draft)) return true;
    remember(this.history, this.draft, label);
    this.draft = copyDraft(draft); this.mutationGeneration++;
    for (const scope of ['main', 'subagent'] as const) {
      this.order[scope] = nodes(this.draft, scope).map(n => n.id);
      if (!this.order[scope].includes(this.selected[scope])) this.selected[scope] = this.order[scope][0] ?? '';
    }
    return true;
  }
  replaceDraft(draft: Draft, label: LocalizedText = text('history.replace')): boolean {
    if (!this.commitDraft(draft, label)) return false;
    this.restoreDraft(draft);
    return true;
  }
  undo(redo = false): boolean {
    if (!this.canMutateDraft() || this.numericBefore) return false;
    const source = redo ? this.history.redo : this.history.undo, target = redo ? this.history.undo : this.history.redo;
    const entry = source.pop();
    if (!entry) {
      this.compositionError = text(redo ? 'history.no_redo' : 'history.no_undo');
      return false;
    }
    target.push(snapshot(this.draft, entry.label)); boundHistory(this.history);
    this.restoreDraft(entry.draft); this.mutationGeneration++;
    this.groupManager = null; this.colors = null; this.structureProposal = null; this.changeReview = null;
    return true;
  }
  applyStructure(draft: Draft, confirmation?: LocalizedText): boolean {
    if (!this.canMutateDraft()) return false;
    try {
      const proposal = repairStructure(this.draft, draft);
      if (!confirmation && !proposal.repairs.length) return this.commitDraft(proposal.draft, text('history.structure'));
      this.structureProposal = { ...proposal, generation: this.mutationGeneration, target: targetIdentity(this.baseline), confirmation };
      openChanges(this, true); return true;
    } catch (error) {
      this.compositionError = text(error instanceof Error && error.message === 'composition.groups.invalid'
        ? 'composition.groups.invalid' : 'composition.invalid');
      return false;
    }
  }
  acceptProposal(): boolean {
    const proposal = this.structureProposal;
    if (!proposal || !this.canMutateDraft(proposal.generation) || targetIdentity(this.baseline) !== proposal.target || semantic(this.draft) !== semantic(proposal.base)) return false;
    if (!this.commitDraft(proposal.draft, text('history.structure'))) return false;
    const addition = proposal.pickerAddition;
    if (this.picker && addition?.scope === this.picker.scope) this.recordPickerAddition(this.picker, addition.id);
    this.structureProposal = null; this.changeReview = null; this.groupManager = null; this.alignmentManager = null; return true;
  }
  adoptRevision(current: ReadResult, generation: number, target: string): boolean {
    if (!this.canMutateDraft(generation) || targetIdentity(current) !== target || targetIdentity(this.baseline) !== target || !current.installed) return false;
    this.baseline = { ...current, draft: copyDraft(current.draft) }; this.mutationGeneration++; return true;
  }

  get adding(): boolean { return this.picker !== null; }

  /** A manager, picker or read-only page owns its input until the user leaves it. */
  get inDraftView(): boolean {
    return !this.adding && this.guidanceScroll === null && !this.shortcuts.panel &&
      !(this.changeReview || this.reuse || this.packages || this.taskViewer || this.diagnosis ||
        this.colors || this.alignmentManager || this.groupManager || this.sources || this.profiles ||
        this.explanation || this.quick || this.review);
  }

  get detailItem(): CatalogItem | undefined {
    if (!this.detail) return undefined;
    const { scope, id } = this.detail;
    // Catalog type IDs and configured instance IDs are independent namespaces.
    return this.picker?.scope === scope ? this.catalog(scope).find(item => item.id === id) : this.definition(scope, id);
  }

  get modified(): boolean {
    return (
      !sameDraft(this.draft, this.baseline.draft) ||
      this.buffers.padding !== String(this.draft.host.padding) ||
      this.buffers.refresh_interval !== String(this.draft.host.refresh_interval)
    );
  }

  catalog(scope: Scope): CatalogItem[] {
    return this.description.catalog.filter((item) => item.scope === scope);
  }

  items(scope: Scope): string[] {
    return nodes(this.draft,scope).filter(i=>i.enabled).map(i=>i.id);
  }

  typeStates(scope: Scope) { return componentTypes(nodes(this.draft, scope)); }

  categoryCounts(scope: Scope): { configured: number; unconfigured: number } {
    const types = this.typeStates(scope);
    let configured = 0, unconfigured = 0;
    for (const item of this.catalog(scope)) {
      if (item.group !== this.category[scope]) continue;
      const state = types.get(item.id);
      if (state) configured += state.count;
      else unconfigured++;
    }
    return { configured, unconfigured };
  }

  instance(scope: Scope, id: string) { return nodes(this.draft,scope).find(i=>i.id===id); }
  definition(scope: Scope, id: string): CatalogItem | undefined {
    return this.catalog(scope).find(i=>i.id===(this.instance(scope,id)?.type_id ?? id));
  }

  instanceLabel(scope:Scope,id:string,language:Language='en'):string {
    const node=this.instance(scope,id),type=node?.type_id??id;
    const peers=nodes(this.draft,scope).filter(i=>i.type_id===type);
    return (node?.options.label || (type==='text'?node?.text:null) || t(`items.${scope}.${type}.label`,language))+
      (node&&peers.length>1?` (${peers.indexOf(node)+1})`:'');
  }

  visible(scope: Scope): CatalogItem[] { return this.matches(scope).map(result => result.item); }

  listContext(scope: Scope): Readonly<ItemListContext> {
    if (this.picker?.scope === scope) return this.picker;
    return { search: this.search[scope], category: this.category[scope], selected: this.selected[scope] };
  }

  selectItem(scope: Scope, id: string): void {
    const picker = this.picker;
    if (picker?.scope === scope) {
      if (picker.selected !== id) picker.notice = null;
      picker.selected = id;
    } else {
      this.selected[scope] = id;
    }
  }

  matches(scope: Scope): {item: CatalogItem & {type_id?:string;custom_label?:string|null;ordinal?:number}; match: Match}[] {
    const catalog = new Map(this.catalog(scope).map(item=>[item.id as string,item]));
    const picker = this.picker?.scope === scope;
    const { category, search } = this.listContext(scope);
    const order = picker ? [...catalog.keys()] : this.order[scope];
    const searching = normalize(search).characters.length > 0;
    return order.flatMap(id=> {
      const node = picker ? undefined : this.instance(scope,id);
      const definition = catalog.get(node?.type_id ?? id);
      if (!definition || (category !== 'all' && definition.group !== category)) return [];
      const peers = node ? nodes(this.draft,scope).filter(i=>i.type_id===node.type_id) : [];
      const item = {...definition,id,type_id:definition.id,custom_label:node?.options.label || (node?.type_id==='text'?node.text:null),ordinal:peers.length>1?peers.indexOf(node!)+1:undefined};
      const match = searching
        ? bestMatch(fields(definition,item.custom_label),search)
        : {rank:5,positions:[],text:id,field:'id'};
      return match ? [{item,match}] : [];
    }).sort((a,b)=>a.match.rank-b.match.rank);
  }

  openPicker(scope: Scope): void {
    if (this.picker) return;
    const { search, category, selected: anchor } = this.listContext(scope);
    const typeId = this.instance(scope, anchor)?.type_id;
    this.picker = { scope, search, category, selected: '', anchor, changed: '', notice: null };
    const visible = this.visible(scope);
    this.picker.selected = visible.find(item => item.id === typeId)?.id ?? visible[0]?.id ?? '';
  }

  closePicker(): void {
    if (!this.picker) return;
    const { scope, changed } = this.picker;
    this.picker = null;
    const visible = this.visible(scope).map(item => item.id as string);
    this.selected[scope] = [changed, this.selected[scope]].find(id => visible.includes(id)) ?? visible[0] ?? '';
  }

  activatePicker(scope: Scope, copyKey: string): void {
    const picker = this.picker;
    if (picker?.scope !== scope || !picker.selected) return;
    if (!this.canMutateDraft()) { picker.notice = this.compositionError; return; }

    const state = this.typeStates(scope).get(picker.selected);
    if (state?.enabled) {
      picker.notice = text('composition.picker_already_enabled', { key: copyKey });
    } else if (state) {
      if (this.toggle(scope, state.firstId)) {
        picker.changed = state.firstId;
        picker.notice = text('composition.picker_enabled');
      } else {
        picker.notice = this.compositionError;
      }
    } else {
      picker.notice = null;
      if (!this.instanceAction(scope, 'add', picker.selected)) picker.notice = this.compositionError;
    }
  }

  private recordPickerAddition(picker: Picker, id: string): void {
    picker.anchor = id;
    picker.changed = id;
    picker.notice = text('composition.picker_added');
  }

  instanceAction(scope: Scope, action:'add'|'copy'|'remove', typeId?:string): boolean {
    if (!this.canMutateDraft()) return false;
    this.compositionError = text('composition.invalid');
    const draft=copyDraft(this.draft), list=nodes(draft,scope);
    const picker = action === 'add' && this.picker?.scope === scope ? this.picker : null;
    const selected = picker?.anchor ?? this.selected[scope];
    const index=list.findIndex(i=>i.id===selected);
    let next=selected;
    if(action==='remove'){
      if(index<0)return false;
      list.splice(index,1);next=list[Math.min(index,list.length-1)]?.id??'';
    }else{
      if(action==='copy'&&index<0)return false;
      const type = typeId ?? list[index]?.type_id;
      if (!type) return false;
      const node=newInstance(type,list,action==='copy'?list[index]:undefined);
      list.splice(insertionAfter(list, (scope === 'main' ? draft.display : draft.display.subagents).groups, selected),0,node);next=node.id;
    }
    const target = scope === 'main' ? draft.display : draft.display.subagents;
    target.groups = reconcileGroups(target.groups, list);
    if(scope==='main')reconcileRows(draft);
    if(!this.applyStructure(draft))return false;
    if (this.structureProposal) {
      if (picker) this.structureProposal.pickerAddition = { scope, id: next };
    } else if (picker) {
      this.recordPickerAddition(picker, next);
    } else {
      this.selected[scope] = next;
    }
    return true;
  }

  categories(scope: Scope): string[] {
    return ['all', ...new Set(this.catalog(scope).map(item => item.group))];
  }

  filtered(scope: Scope): boolean {
    const { category, search } = this.listContext(scope);
    return category !== 'all' || normalize(search).characters.length > 0;
  }

  chooseCategory(scope: Scope, category: string): void {
    if (!this.categories(scope).includes(category)) return;
    const picker = this.picker;
    if (picker?.scope === scope) {
      if (picker.category !== category) picker.notice = null;
      picker.category = category;
    } else {
      this.category[scope] = category;
    }
    this.filter(scope, this.listContext(scope).search);
  }

  clearListFilters(scope: Scope): void {
    if (this.picker?.scope === scope) return;
    this.category[scope] = 'all';
    this.filter(scope, '');
  }

  filter(scope: Scope, value: string): void {
    const picker = this.picker;
    if (picker?.scope === scope) {
      if (picker.search !== value) picker.notice = null;
      picker.search = value;
    } else {
      this.search[scope] = value;
    }
    const { selected: id } = this.listContext(scope);
    const matches = this.matches(scope), selected = matches.find(result => result.item.id === id);
    if (!selected || selected.match.rank > matches[0]!.match.rank) {
      this.selectItem(scope, matches[0]?.item.id ?? '');
    }
  }

  toggle(scope: Scope, id: string): boolean {
    if (!this.canMutateDraft()) return false;
    this.compositionError = text('composition.invalid');
    const draft=copyDraft(this.draft),node=nodes(draft,scope).find(i=>i.id===id);
    if(!node)return false;
    node.enabled=!node.enabled;
    if(!isDraft(draft))return false;
    return this.commitDraft(draft, text('history.edit'));
  }

  move(scope: Scope, delta: -1 | 1): boolean {
    if (!this.canMutateDraft()) return false;
    this.compositionError = text('composition.invalid');
    if (this.adding || this.filtered(scope)) return false;
    const { instances, groups } = groupScope(this.draft.display, scope);
    const selected = instanceUnit(instances, groups, this.selected[scope]);
    if (!selected) return false;
    const neighbor = instances[delta < 0 ? selected.start - 1 : selected.end];
    if (!neighbor) return true; // The arrow is handled at the list edge without changing the draft.
    const adjacent = instanceUnit(instances, groups, neighbor.id)!;
    const [left, right] = delta < 0 ? [adjacent, selected] : [selected, adjacent];
    const draft = copyDraft(this.draft);
    swapAdjacentUnits(nodes(draft, scope), left, right, scope === 'main' ? draft.display.layout : undefined);
    return this.applyStructure(draft);
  }

  setBuffer(field: NumericField, value: string): void {
    if (!this.canMutateDraft()) return;
    this.numericBefore ??= copyDraft(this.draft);
    this.activeNumeric = field;
    this.buffers[field] = value;
    delete this.fieldErrors[field];
    delete this.fieldErrorMessages[field];
  }

  cancelNumeric(field?: NumericField): void {
    if (this.numericBefore) { this.draft = copyDraft(this.numericBefore); this.numericBefore = null; }
    for (const key of field ? [field] : NUMERIC_FIELDS) {
      this.buffers[key] = String(this.draft.host[key]);
      delete this.fieldErrors[key];
      delete this.fieldErrorMessages[key];
    }
    if (!field || this.activeNumeric === field) this.activeNumeric = null;
  }

  acceptNumeric(field?: NumericField, preview = false): boolean {
    if (!this.canMutateDraft()) return false;
    const values: Partial<Record<NumericField, number | 'event'>> = {};
    const fields = field ? [field] : NUMERIC_FIELDS;
    for (const key of fields) {
      delete this.fieldErrors[key];
      delete this.fieldErrorMessages[key];
      const parsed = numericValue(this.description, key, this.buffers[key]);
      if (parsed.error !== undefined) { this.fieldErrors[key] = parsed.error; this.fieldErrorMessages[key] = numericDiagnostic(this.description, key); }
      else values[key] = parsed.value;
    }
    if (fields.some((key) => this.fieldErrors[key])) return false;
    const candidate = copyDraft(this.draft);
    if (values.padding !== undefined) candidate.host.padding = values.padding as number;
    if (values.refresh_interval !== undefined) candidate.host.refresh_interval = values.refresh_interval;
    if (preview) { this.draft = candidate; return true; }
    if (this.numericBefore) this.draft = copyDraft(this.numericBefore);
    this.numericBefore = null;
    if (!this.commitDraft(candidate)) return false;
    this.cancelNumeric(field);
    return true;
  }

  committed(current: ReadResult): void {
    this.pendingSave=null;this.setSaveState('idle');
    this.numericBefore = null; this.history = emptyHistory(); this.structureProposal = null; this.changeReview = null;
    this.baseline = { ...current, draft: copyDraft(current.draft) };
    this.restoreDraft(current.draft); this.mutationGeneration++;
    if (this.picker) this.picker.notice = null;
    this.cancelNumeric();
  }

}
