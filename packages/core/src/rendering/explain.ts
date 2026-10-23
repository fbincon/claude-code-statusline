import type { Draft, Scope, PreviewResult, ExplainResult, ExplainReason, InstanceDraft } from '../contracts/ui.js';
import { BY_SCOPE } from '../config/catalog.js';
import type { RenderTrace } from './trace.js';

export interface ExplanationFacts {
  installation: { main: 'owned' | 'absent' | 'foreign' | 'unknown'; subagent: 'owned' | 'absent' | 'foreign' | 'unknown' };
  host_version: readonly number[] | null;
  runtime: { native_timing: boolean; live_metrics: boolean } | null;
}
function atLeast(actual: readonly number[], required: string): boolean {
  const wanted=required.split('.').map(Number);
  for(let i=0;i<3;i++) if((actual[i]??0)!==(wanted[i]??0)) return (actual[i]??0)>(wanted[i]??0);
  return true;
}
export function explain(draft: Draft, scope: Scope, width: number, preview: PreviewResult, trace: RenderTrace, facts: ExplanationFacts): ExplainResult {
  return {sample:true,scope,width,actual_availability:'not_observed',preview,
    instances:(scope==='main'?draft.display.instances:draft.display.subagents.instances).map(node=>{
      const reasons=configurationReasons(draft,scope,node,facts);
      const add=(code:string,origin:ExplainReason['origin'])=>reasons.push({code,origin});
      if(!['text','spacer'].includes(node.type_id)) add('actual_not_observed','unknown');
      return {id:node.id,type_id:node.type_id,enabled:node.enabled,reasons,samples:trace.samples(scope,node.id)};
    }),
  };
}

export function configurationReasons(draft: Draft, scope: Scope, node: InstanceDraft, facts: ExplanationFacts): ExplainReason[] {
      const reasons: ExplainReason[]=[];
      const add=(code:string,origin:ExplainReason['origin'])=>reasons.push({code,origin});
      if (node.type_id === 'session-cost-rate') add('cost_rate_' + (node.options.cost_rate_basis ?? 'session'), 'configuration');
      if (node.options.presentation === 'bar') add('indicator_bar', 'configuration');
      add(node.enabled?'configured_on':'configured_off','configuration');
      if (['external-value','github-pr','github-ci'].includes(node.type_id)) add(node.source?.binding ? 'source_bound' : 'source_unbound','configuration');
      if(scope==='subagent'&&!draft.display.subagents.enabled) add('scope_disabled','configuration');
      add('installation_'+facts.installation[scope],facts.installation[scope]==='unknown'?'unknown':'local_configuration');
      const definition=BY_SCOPE[scope].get(node.type_id), requirements=definition?.guidance.requirements ?? [];
      const minimum=definition?.minimum_version ?? (scope==='subagent'?'2.1.205':null);
      if(facts.host_version===null) add('unknown_host_version','unknown');
      else if(minimum) add(atLeast(facts.host_version,minimum)?'host_supported':'unsupported_host','host_capability');
      else if(!['text','spacer'].includes(node.type_id)) add('host_requirement_unknown','unknown');
      for(const [requirement,field] of [['native_timing','native_timing'],['live_metrics','live_metrics']] as const) {
        if(!requirements.includes(requirement)) continue;
        add(facts.runtime===null?'collector_unknown':facts.runtime[field]?field+'_on':field+'_off',facts.runtime===null?'unknown':'local_configuration');
      }
      return reasons;
}
