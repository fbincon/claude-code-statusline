/** Stable references to whole units; row positions are resolved from the current explicit layout. */
import type { AlignmentRef, DisplayDraft, GroupDraft, InstanceDraft, LayoutDraft } from '../contracts/ui.js';
export interface AlignmentUnit { ref: AlignmentRef; ids: string[]; row: number; side: 'left' | 'right'; position: number }
export const refKey = (ref: AlignmentRef): string => ref.kind + ':' + ref.id;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/u.test(v);
export function alignmentUnits(layout: LayoutDraft, nodes: readonly InstanceDraft[], groups: readonly GroupDraft[]): AlignmentUnit[] {
  const byId = new Map(nodes.map(n => [n.id,n])), membership = new Map(groups.flatMap(g=>g.member_ids.map(id=>[id,g] as const)));
  return layout.rows.flatMap((ids,row) => {
    const seen = new Set<string>(), units: AlignmentUnit[] = []; let side: 'left' | 'right' = 'left';
    for (const id of ids) {
      if (byId.get(id)?.type_id === 'spacer') { side='right';continue; }
      const group=membership.get(id); if(group && seen.has(group.id))continue;
      if(group)seen.add(group.id);
      units.push({ref:{kind:group?'group':'instance',id:group?.id??id},ids:group?[...group.member_ids]:[id],row,side,position:units.length});
    }
    return units;
  });
}
export function validAlignments(value: unknown, layout: LayoutDraft, nodes: readonly InstanceDraft[], groups: readonly GroupDraft[]): boolean {
  if(value === undefined)return true;
  if(!Array.isArray(value)||value.length>nodes.length)return false;
  if(!value.length)return true;
  if(layout.mode!=='explicit')return false;
  const units=new Map(alignmentUnits(layout,nodes,groups).map(u=>[refKey(u.ref),u])), used=new Set<string>(), ids=new Set<string>(), ownership=new Map<string,string>();
  return value.every(alignment=>{
    if(!object(alignment)||Object.keys(alignment).sort().join(',')!=='columns,id'||!identifier(alignment.id)||ids.has(alignment.id)||
      !Array.isArray(alignment.columns)||!alignment.columns.length||alignment.columns.length>nodes.length)return false;
    ids.add(alignment.id);const positions=new Map<string,number>();
    return alignment.columns.every(column=>{
      if(!Array.isArray(column)||column.length<2||column.length>layout.rows.length)return false;
      const rows=new Set<number>();let side: string|undefined;
      return column.every(ref=>{
        if(!object(ref)||Object.keys(ref).sort().join(',')!=='id,kind'||!['instance','group'].includes(String(ref.kind))||!identifier(ref.id))return false;
        const key=refKey(ref as unknown as AlignmentRef), unit=units.get(key);
        if(!unit||used.has(key)||rows.has(unit.row)||side!==undefined&&unit.side!==side)return false;
        const owner=unit.row+':'+unit.side, previous=positions.get(owner);
        if(ownership.has(owner)&&ownership.get(owner)!==alignment.id||previous!==undefined&&previous>=unit.position)return false;
        ownership.set(owner,alignment.id as string);positions.set(owner,unit.position);rows.add(unit.row);used.add(key);side=unit.side;return true;
      });
    });
  });
}
export function editAlignment(display: DisplayDraft, id: string, columns?: AlignmentRef[][]): DisplayDraft {
  const result=JSON.parse(JSON.stringify(display)) as DisplayDraft, values=result.layout.alignments??[];
  if(!identifier(id))throw new Error('alignment.invalid');
  const index=values.findIndex(v=>v.id===id);
  if(columns===undefined) { if(index<0)throw new Error('alignment.invalid');values.splice(index,1); }
  else { const value={id,columns};if(index<0)values.push(value);else values[index]=value; }
  result.layout.alignments=values;
  if(!validAlignments(values,result.layout,result.instances,result.groups))throw new Error('alignment.invalid');
  return result;
}
/** Identify relationships that a proposed structural edit would invalidate. */
export function alignmentConflicts(display: DisplayDraft): string[] {
  const values = display.layout.alignments;
  if (validAlignments(values, display.layout, display.instances, display.groups)) return [];
  if (!Array.isArray(values)) return [];
  const named = values.filter(value => object(value) && identifier(value.id));
  const invalid = named.filter(value => !validAlignments([value], display.layout, display.instances, display.groups));
  return (invalid.length ? invalid : named).map(value => value.id);
}
export function requireAlignments(display: DisplayDraft): void {
  const ids = alignmentConflicts(display);
  if (ids.length) throw new AlignmentReferenceError(ids);
}
export class AlignmentReferenceError extends Error {
  constructor(readonly ids: string[]) { super('alignment.references'); }
}
export function parseAlignmentColumns(raw: string): AlignmentRef[][] {
  return raw.split(';').map(column=>column.split(',').map(token=>{
    const match=/^(instance|group):([A-Za-z0-9][A-Za-z0-9_-]{0,95})$/u.exec(token.trim());
    if(!match)throw new Error('alignment.invalid');
    return {kind:match[1] as AlignmentRef['kind'],id:match[2]!};
  }));
}
