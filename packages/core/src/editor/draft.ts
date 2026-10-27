import type { AlignmentManager } from './alignment-manager.js';
import type { GroupManager } from './group-manager.js';
import { reconcileGroups, insertionAfter } from './groups.js';
import type { ExplanationView } from './explanation.js';
import type { SourceManager } from './source-manager.js';
import type { ProfileManager } from './profile-manager.js';
import type { QuickSetup } from './quick-setup.js';
import { t, text, type Language } from '../i18n/messages.js';
import { alignmentConflicts } from './alignments.js';
import { nodes, newInstance, reconcileRows } from './instances.js';
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

export type Page = 'main' | 'subagents' | 'settings' | 'layout';

/** Copy wire data without sharing editable arrays with the opening snapshot. */
export function copyDraft(draft: Draft): Draft {
  return JSON.parse(JSON.stringify(draft)) as Draft;
}

export function sameDraft(left: Draft, right: Draft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
export const definitiveSaveRefusal = (code: string): boolean => ['invalid_request','invalid_configuration','configuration_conflict','not_installed','ownership_mismatch','unsupported_protocol','unsupported_operation'].includes(code);
export interface PendingSave {
  draft: Draft; revision: string; target?: ConfigTarget; installation: ReadResult['installation'];
}

/** Pure tool draft. Persistence and host configuration calls live in the hook. */
export class Editor {
  draft: Draft;
  baseline: ReadResult;
  page: Page = 'main';
  advanced = false;
  adding = false;
  pickerSaved: {search:string;category:string;selected:string} | null = null;
  detail: { scope: Scope; id: string } | null = null;
  guidanceScroll: number | null = null;
  review: ReviewState | null = null;
  quick: QuickSetup | null = null;
  explanation: ExplanationView | null = null;
  profiles: ProfileManager | null = null;
  sources: SourceManager | null = null;
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
  saveState: 'idle' | 'pending' | 'unknown' = 'idle';
  pendingSave: PendingSave | null = null;
  mutationGeneration = 0;

  canMutateDraft(generation = this.mutationGeneration): boolean {
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
  ) {
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

  replaceDraft(draft: Draft): void {
    if (!this.canMutateDraft()) return;
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

  matches(scope: Scope): {item: CatalogItem & {type_id?:string;custom_label?:string|null;ordinal?:number}; match: Match}[] {
    const catalog = new Map(this.catalog(scope).map(item=>[item.id as string,item]));
    const order = this.adding ? [...catalog.keys()] : this.order[scope];
    return order.flatMap(id=> {
      const node = this.adding ? undefined : this.instance(scope,id);
      const definition = catalog.get(node?.type_id ?? id);
      if (!definition || (this.category[scope] !== 'all' && definition.group !== this.category[scope])) return [];
      const peers = node ? nodes(this.draft,scope).filter(i=>i.type_id===node.type_id) : [];
      const item = {...definition,id,type_id:definition.id,custom_label:node?.options.label || (node?.type_id==='text'?node.text:null),ordinal:peers.length>1?peers.indexOf(node!)+1:undefined};
      const match = normalize(this.search[scope]).characters.length
        ? bestMatch(fields(definition,item.custom_label),this.search[scope])
        : {rank:5,positions:[],text:id,field:'id'};
      return match ? [{item,match}] : [];
    }).sort((a,b)=>a.match.rank-b.match.rank);
  }

  openPicker(scope: Scope): void {
    this.pickerSaved={search:this.search[scope],category:this.category[scope],selected:this.selected[scope]};
    this.adding=true; this.search[scope]='';this.category[scope]='all';this.selected[scope]=this.catalog(scope)[0]?.id ?? '';
  }
  closePicker(scope: Scope): void {
    if(this.pickerSaved){this.search[scope]=this.pickerSaved.search;this.category[scope]=this.pickerSaved.category;this.selected[scope]=this.pickerSaved.selected;}
    this.adding=false;this.pickerSaved=null;
  }
  instanceAction(scope: Scope, action:'add'|'copy'|'remove', typeId?:string): boolean {
    if (!this.canMutateDraft()) return false;
    this.compositionError = text('composition.invalid');
    const draft=copyDraft(this.draft), list=nodes(draft,scope);
    const selected=this.adding ? this.pickerSaved?.selected : this.selected[scope];
    const index=list.findIndex(i=>i.id===selected);
    let next=selected ?? '';
    if(action==='remove'){
      if(index<0)return false;
      list.splice(index,1);next=list[Math.min(index,list.length-1)]?.id??'';
    }else{
      if(action==='copy'&&index<0)return false;
      const node=newInstance(typeId??list[index]!.type_id,list,action==='copy'?list[index]:undefined);
      list.splice(insertionAfter(list, (scope === 'main' ? draft.display : draft.display.subagents).groups, selected),0,node);next=node.id;
    }
    const target = scope === 'main' ? draft.display : draft.display.subagents;
    target.groups = reconcileGroups(target.groups, list);
    if(scope==='main')reconcileRows(draft);
    if(!this.acceptStructure(draft))return false;
    if(this.adding){this.closePicker(scope);this.search[scope]='';this.category[scope]='all';}
    this.draft=draft;this.order[scope]=list.map(i=>i.id);this.selected[scope]=next;
    return true;
  }

  categories(scope: Scope): string[] {
    return ['all', ...new Set(this.catalog(scope).map(item => item.group))];
  }

  filtered(scope: Scope): boolean {
    return this.category[scope] !== 'all' || normalize(this.search[scope]).characters.length > 0;
  }

  chooseCategory(scope: Scope, category: string): void {
    if (!this.categories(scope).includes(category)) return;
    this.category[scope] = category;
    this.filter(scope, this.search[scope]);
  }

  filter(scope: Scope, value: string): void {
    this.search[scope] = value;
    const matches = this.matches(scope), selected = matches.find(result => result.item.id === this.selected[scope]);
    if (!selected || selected.match.rank > matches[0]!.match.rank) {
      this.selected[scope] = matches[0]?.item.id || '';
    }
  }

  toggle(scope: Scope, id: string): boolean {
    if (!this.canMutateDraft()) return false;
    this.compositionError = text('composition.invalid');
    if(this.adding)return this.instanceAction(scope,'add',id);
    const draft=copyDraft(this.draft),node=nodes(draft,scope).find(i=>i.id===id);
    if(!node)return false;
    node.enabled=!node.enabled;
    if(!isDraft(draft))return false;
    this.draft=draft;return true;
  }

  move(scope: Scope, delta: -1 | 1): boolean {
    if (!this.canMutateDraft()) return false;
    this.compositionError = text('composition.invalid');
    if (this.adding || this.filtered(scope)) return false;
    const visible = this.visible(scope).map((item) => item.id as string);
    const id = this.selected[scope];
    const index = visible.indexOf(id);
    const target = visible[index + delta];
    if (index < 0 || !target) return false;
    const draft = copyDraft(this.draft);
    const ordered = nodes(draft, scope);
    const sourceIndex = ordered.findIndex(node => node.id === id);
    const [moving] = ordered.splice(sourceIndex, 1);
    ordered.splice(ordered.findIndex(node => node.id === target) + (delta > 0 ? 1 : 0), 0, moving!);
    if (scope === 'main') reconcileRows(draft);
    if (!this.acceptStructure(draft)) return false;
    this.draft = draft;
    this.order[scope] = ordered.map(node => node.id);
    return true;
  }

  private acceptStructure(draft: Draft): boolean {
    const ids = alignmentConflicts(draft.display);
    if (ids.length) this.compositionError = text('alignment.references', { ids: ids.join(', ') });
    return isDraft(draft);
  }

  setBuffer(field: NumericField, value: string): void {
    if (!this.canMutateDraft()) return;
    this.activeNumeric = field;
    this.buffers[field] = value;
    delete this.fieldErrors[field];
    delete this.fieldErrorMessages[field];
  }

  cancelNumeric(field?: NumericField): void {
    for (const key of field ? [field] : NUMERIC_FIELDS) {
      this.buffers[key] = String(this.draft.host[key]);
      delete this.fieldErrors[key];
      delete this.fieldErrorMessages[key];
    }
    if (!field || this.activeNumeric === field) this.activeNumeric = null;
  }

  acceptNumeric(field?: NumericField): boolean {
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
    if (values.padding !== undefined)
      this.draft.host.padding = values.padding as number;
    if (values.refresh_interval !== undefined)
      this.draft.host.refresh_interval = values.refresh_interval;
    this.cancelNumeric(field);
    return true;
  }

  committed(current: ReadResult): void {
    this.pendingSave=null;this.setSaveState('idle');
    this.baseline = { ...current, draft: copyDraft(current.draft) };
    this.draft = copyDraft(current.draft);
    this.cancelNumeric();
  }

}
