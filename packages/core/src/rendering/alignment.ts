import { row as powerlineRow, finishRow, type RowChunk } from './powerline.js';
import type { DisplayDraft } from '../contracts/ui.js';
import { alignmentUnits, refKey, type AlignmentUnit } from '../editor/alignments.js';
import { displayWidth, strip, ensureReset } from './layout.js';
import { RESET } from './styles.js';
import type { ColorCursor } from './powerline.js';

interface Unit extends AlignmentUnit { width:number; before:number; after:number; label?:string }
export function alignedRows(config:DisplayDraft,columns:number,separator:string,label:string|null,colors:ColorCursor,
  renderUnit:(ids:string[],colors:ColorCursor)=>string,
  renderRow:(ids:string[],first:boolean,colors:ColorCursor)=>string[],
  observe?:(ids:string[],collapsed:boolean)=>void, labelBody?:string|null):string[] {
  const reset=config.use_colors?RESET:'', gap=config.separator_style==='powerline'?' ':separator, gapWidth=displayWidth(gap);
  const units:Unit[]=alignmentUnits(config.layout,config.instances,config.groups).map(unit=>{
    const text=renderUnit(unit.ids,{...colors,index:0,capture:undefined});
    return {...unit,width:strip(text).trim()?displayWidth(text):0,before:0,after:0};
  });
  const byKey=new Map(units.map(unit=>[refKey(unit.ref),unit])), nodes=new Map(config.instances.map(node=>[node.id,node]));
  const rows=config.layout.rows.map((ids,row)=>({
    ids, row, units:units.filter(unit=>unit.row===row), spacer:ids.map(id=>nodes.get(id)!).find(node=>node.type_id==='spacer'),
    owners:new Set<string>(), visible:units.some(unit=>unit.row===row&&unit.width>0),
  }));
  const first=rows.find(row=>row.visible);
  if(first&&label)first.units.unshift({ref:{kind:'instance',id:'$scope'},ids:[],row:first.row,side:'left',position:-1,width:displayWidth(label),before:0,after:0,label});
  const size=(unit:Unit)=>unit.width+unit.before+unit.after;
  const total=(values:Unit[])=>{const active=values.filter(unit=>size(unit)>0);return active.reduce((n,unit)=>n+size(unit),0)+Math.max(0,active.length-1)*gapWidth;};
  const collapsed=new Set<string>();
  for(const alignment of config.layout.alignments??[]) {
    for(const column of alignment.columns)for(const ref of column)rows[byKey.get(refKey(ref))!.row]!.owners.add(alignment.id);
    for(const side of ['left','right'] as const) {
      const columns=alignment.columns.filter(column=>byKey.get(refKey(column[0]!))!.side===side);
      for(const column of side==='left'?columns:[...columns].reverse()) {
        const members=column.map(ref=>byKey.get(refKey(ref))!).filter(unit=>rows[unit.row]!.visible);
        const width=Math.max(0,...members.map(unit=>unit.width));
        if(!width)continue; // An entirely hidden column consumes no position.
        const starts=members.map(unit=>{
          const values=rows[unit.row]!.units.filter(other=>other.side===side), index=values.indexOf(unit);
          const preceding=side==='left'?values.slice(0,index):values.slice(index+1);
          const value=total(preceding);return value+(preceding.some(other=>size(other)>0)?gapWidth:0);
        });
        const start=Math.max(0,...starts);
        members.forEach((unit,index)=>{
          if(side==='left')unit.before+=start-starts[index]!;
          else unit.after+=start-starts[index]!;
          unit.after+=width-unit.width;
        });
      }
    }
  }
  for(const row of rows) {
    const occupied=total(row.units.filter(u=>u.side==='left'))+total(row.units.filter(u=>u.side==='right'));
    if(row.visible&&(occupied>columns||row.spacer&&!row.spacer.enabled))for(const owner of row.owners)collapsed.add(owner);
  }
  // Groups sharing a physical row share its width budget and must degrade together.
  let changed=true;
  while(changed){changed=false;for(const row of rows)if([...row.owners].some(owner=>collapsed.has(owner)))
    for(const owner of row.owners)if(!collapsed.has(owner)){collapsed.add(owner);changed=true;}}
  const result:string[]=[];
  const draw=(values:Unit[])=>{
    const active=values.filter(unit=>size(unit)>0);let previous:Unit|undefined;
    return active.map(unit=>{
      const join=previous?(previous.width&&unit.width?gap:' '.repeat(gapWidth)):'';
      previous=unit;
      if (join) colors.capture?.push({gap:join});
      if (unit.before) colors.capture?.push({gap:reset+' '.repeat(unit.before)});
      const text=unit.label??(unit.width?renderUnit(unit.ids,colors):'');
      if (unit.label && colors.capture) powerlineRow([{text:labelBody ?? unit.label,sequence:false}],config,true,true,colors,true);
      if (unit.after) colors.capture?.push({gap:reset+' '.repeat(unit.after)});
      return join+(unit.before?reset+' '.repeat(unit.before):'')+text+(unit.after?reset+' '.repeat(unit.after):'');
    }).join('');
  };
  for(const row of rows) {
    if(!row.visible)continue;
    if(!row.owners.size||[...row.owners].some(owner=>collapsed.has(owner))) {
      result.push(...renderRow(row.ids,result.length===0,colors));continue;
    }
    if(config.powerline.color_mode==='restart')colors.index=0;
    const captured: RowChunk[] | undefined = config.powerline.row_background_gradient && config.use_colors && config.separator_style === 'powerline' ? [] : undefined;
    colors.capture = captured;
    const left=draw(row.units.filter(u=>u.side==='left'));
    const split = captured?.length ?? 0;
    const right=draw(row.units.filter(u=>u.side==='right'));
    const flexible=row.spacer?.enabled?reset+' '.repeat(Math.max(0,columns-displayWidth(left)-displayWidth(right))):'';
    if (row.spacer?.enabled) captured?.splice(split, 0, {gap:flexible,boundary:true});
    const text=captured?finishRow(captured,config):ensureReset(left+flexible+right,reset);
    colors.capture=undefined;
    if(strip(text).trim())result.push(text);
  }
  for(const alignment of config.layout.alignments??[])
    observe?.(alignment.columns.flatMap(column=>column.flatMap(ref=>byKey.get(refKey(ref))!.ids)),collapsed.has(alignment.id));
  return result;
}
