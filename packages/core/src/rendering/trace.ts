import type { DisplayDraft, Scope, SampleReason, InstanceSample, LayoutReason, InstanceLayout, StyleDecision } from '../contracts/ui.js';

export type FitObserver = (id: string, reason: 'group_hidden' | 'priority_omitted' | 'width_omitted' | 'truncated') => void;
/** Opt-in evidence from actual rendering decisions; never collects observations. */
export class RenderTrace {
  private alignments = new Map<string,boolean>();
  private rows = new Map<string, InstanceLayout[]>();
  private current: Record<Scope,string> = {main:'main',subagent:'subagent'};
  constructor(private config: DisplayDraft) {}
  begin(scope: Scope, row: string): void {
    this.current[scope] = row;
    for (const node of scope === 'main' ? this.config.instances : this.config.subagents.instances) {
      if (node.enabled && (scope === 'main' || this.config.subagents.enabled)) this.mark(scope,node.id,'empty');
    }
  }
  mark(scope: Scope, id: string, reason: LayoutReason | 'truncated'): void {
    const node = (scope === 'main' ? this.config.instances : this.config.subagents.instances).find(node=>node.id===id);
    if (!node || !node.enabled || scope==='subagent'&&!this.config.subagents.enabled) return;
    const key=scope+':'+id, rows=this.rows.get(key) ?? [];
    let sample=rows.find(row=>row.row_id===this.current[scope]);
    if (!sample) { sample={row_id:this.current[scope],outcome:'empty',truncated:false};rows.push(sample);this.rows.set(key,rows); }
    if (reason === 'truncated') sample.truncated=true;
    else sample.outcome=reason;
    if(reason==='visible'){
      if(!this.config.use_colors)this.style(scope,id,'colors_disabled');
      else {
        if(node.options.background_gradient&&this.config.separator_style!=='powerline')this.style(scope,id,'background_gradient_requires_powerline');
        if(this.config.palette==='ansi'&&(node.options.foreground_gradient||node.options.background_gradient||node.options.foreground?.startsWith('#')||node.options.background?.startsWith('#')||!['classic','terminal'].includes(this.config.theme)))this.style(scope,id,'color_quantized');
      }
    }
  }
  style(scope:Scope,id:string,code:StyleDecision['code'],owner_id:string|null=null):void {
    const row=(this.rows.get(scope+':'+id)??[]).find(r=>r.row_id===this.current[scope]);
    if(!row)return;
    const reasons=row.style_reasons??=[];
    if(!reasons.some(r=>r.code===code&&r.owner_id===owner_id))reasons.push({code,owner_id});
  }
  fit(scope: Scope): FitObserver { return (id,reason)=>this.mark(scope,id,reason); }
  alignment(id:string,collapsed:boolean):void { this.alignments.set(id,collapsed); }
  alignmentCollapsed(id:string):boolean|undefined { return this.alignments.get(id); }
  layouts(scope:Scope,id:string): InstanceLayout[] { return (this.rows.get(scope+':'+id) ?? []).map(row=>({...row,...(row.style_reasons?{style_reasons:row.outcome==='visible'?row.style_reasons.map(r=>({...r})):[]}: {})})); }
  samples(scope:Scope,id:string): InstanceSample[] { return this.layouts(scope,id).map(row=>({...row,outcome:('sample_'+row.outcome) as SampleReason})); }
}
