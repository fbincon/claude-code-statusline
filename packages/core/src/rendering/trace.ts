import type { DisplayDraft, Scope, SampleReason, InstanceSample, LayoutReason, InstanceLayout } from '../contracts/ui.js';

export type FitObserver = (id: string, reason: 'group_hidden' | 'priority_omitted' | 'width_omitted' | 'truncated') => void;
/** Opt-in evidence from actual rendering decisions; never collects observations. */
export class RenderTrace {
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
  }
  fit(scope: Scope): FitObserver { return (id,reason)=>this.mark(scope,id,reason); }
  layouts(scope:Scope,id:string): InstanceLayout[] { return (this.rows.get(scope+':'+id) ?? []).map(row=>({...row})); }
  samples(scope:Scope,id:string): InstanceSample[] { return this.layouts(scope,id).map(row=>({...row,outcome:('sample_'+row.outcome) as SampleReason})); }
}
