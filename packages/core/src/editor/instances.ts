/** Pure instance identity/order helpers; Python remains the persisted validator. */
import { ITEM_DEFAULTS } from '../contracts/ui.js';
import type { Draft, InstanceDraft, Scope } from '../contracts/ui.js';

let serial = 0;
export function nodes(draft: Draft, scope: Scope): InstanceDraft[] {
  return scope === 'main' ? draft.display.instances : draft.display.subagents.instances;
}

export interface ComponentTypeState {
  count: number;
  enabled: boolean;
  firstId: string;
}

/** Catalog rows describe types. Their instances retain their own IDs and order. */
export function componentTypes(instances: readonly InstanceDraft[]): Map<string, ComponentTypeState> {
  const types = new Map<string, ComponentTypeState>();
  for (const instance of instances) {
    const state = types.get(instance.type_id);
    if (state) {
      state.count++;
      state.enabled ||= instance.enabled;
    } else {
      types.set(instance.type_id, { count: 1, enabled: instance.enabled, firstId: instance.id });
    }
  }
  return types;
}

export type ComponentMarker = 'x' | '–' | ' ';
export function catalogMarker(state: ComponentTypeState | undefined): ComponentMarker {
  return state?.enabled ? 'x' : state ? '–' : ' ';
}

export function newInstance(type_id: string, existing: InstanceDraft[], copy?: InstanceDraft): InstanceDraft {
  let id: string;
  do { id = `i-${Date.now().toString(36)}-${(++serial).toString(36)}-${Math.random().toString(36).slice(2,14)}`; }
  while (existing.some(i=>i.id===id));
  return copy ? {...JSON.parse(JSON.stringify(copy)),id} : {
    id,type_id,enabled:true,text:type_id==='text'?'':null,
    options:{...ITEM_DEFAULTS,visibility:'always',formatting:{}},
  };
}
export function reconcileRows(draft: Draft): void {
  const layout = draft.display.layout;
  if (layout.mode !== 'explicit') return;
  const ids=draft.display.instances.map(i=>i.id);
  if(!layout.rows.length){layout.rows=ids.length?[ids]:[];return;}
  const membership=new Map(layout.rows.flatMap((row,n)=>row.map(id=>[id,n] as const)));
  const sizes=layout.rows.map(()=>0);
  let current=ids.map(id=>membership.get(id)).find(n=>n!==undefined)??0;
  for(const id of ids){current=membership.get(id)??current;sizes[current]=sizes[current]!+1;}
  let offset=0;
  layout.rows=sizes.filter(n=>n>0).map(size=>{const row=ids.slice(offset,offset+size);offset+=size;return row;});
}
