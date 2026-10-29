import type { Draft, ProfilesResult, ReuseRequest, ReuseReviewResult, Scope } from '../contracts/ui.js';
import type { Editor } from './draft.js';
import type { ReviewBackend } from './change-review.js';
import { targetIdentity } from './change-review.js';
import { clip } from '../unicode/index.js';
import { clone } from './history.js';
import { STYLE_FIELDS, styleFields, reuseDraft } from './reuse.js';
import { createReview, navigateReview, reviewRows, type ReviewState } from './import-review.js';
import { newInstance } from './instances.js';
import { openSources } from './source-manager.js';
import { inputKey, inputView, textInput, type TextInput, type TextKey } from './text-input.js';
import { text, t, renderMessage, type Language, type LocalizedText } from '../i18n/messages.js';

export interface ReuseManager {
  kind: 'style' | 'groups'; page: 'source' | 'path' | 'profiles' | 'select' | 'fields' | 'review' | 'complete';
  generation: number; target: string; scope: Scope; fromScope: Scope; destination: string; incoming: Draft; local: boolean;
  from: string; groups: string[]; fields: string[]; references: 'review' | 'expand' | 'exclude'; explicit: boolean;
  cursor: number; scroll: number; details: boolean; input: TextInput; profileFile: boolean; library: ProfilesResult | null;
  result: ReuseReviewResult | null; review: ReviewState | null; message: LocalizedText | null; effect: 'file' | 'profiles' | null;
}
export function openReuse(e: Editor, kind: ReuseManager['kind']): void {
  const scope = e.detail?.scope ?? (e.page === 'subagents' ? 'subagent' : 'main');
  e.reuse = { kind, page: 'source', generation: e.mutationGeneration, target: targetIdentity(e.baseline), scope, fromScope: scope, destination: e.detail?.id ?? e.selected[scope],
    incoming: clone(e.draft), local: true, from: '', groups: [], fields: [], references: 'review', explicit: false, cursor: 0, scroll: 0, details: false,
    input: textInput('statusline.json'), profileFile: false, library: null, result: null, review: null, message: null, effect: null };
}
function source(e: Editor) { const m=e.reuse!; return m.fromScope === 'main' ? m.incoming.display : m.incoming.display.subagents; }
function request(m: ReuseManager): ReuseRequest {
  return m.kind === 'style' ? { kind:'style',scope:m.scope,from_scope:m.fromScope,from_id:m.from,to_ids:[m.destination],fields:[...m.fields] }
    : {kind:'groups',scope:m.scope,group_ids:[...m.groups],references:m.references,explicit:m.explicit};
}
function refresh(e: Editor): void {
  const m=e.reuse!;
  try {
    m.result = reuseDraft(e.draft,m.incoming,request(m),()=>newInstance('text',[]).id,e.description.catalog,m.local);
    m.review = createReview(m.result); m.details = m.result.blocked.length > 0; m.scroll=0; m.message = m.result.blocked.length ? text(m.result.blocked[0]!) : null;
  } catch (error) { m.result=null;m.review=null;m.message=text(error instanceof Error && error.message==='reuse.incompatible'?'reuse.incompatible':'reuse.invalid'); }
}
function reviewCapacity(m: ReuseManager,height:number):number {
  const headers=1+Number(height>=4)+Number(m.kind==='style'&&height>=5)+Number(m.kind==='groups'&&height>=6)+Number(m.kind==='groups'&&height>=7);
  return Math.max(1,height-headers-1);
}
function rows(e: Editor, language: Language): string[] {
  const m=e.reuse!,tr=(key:string)=>t('reuse.'+key,language);
  if(m.page==='source')return ['current','portable','profile_file','profiles'].map(tr);
  if(m.page==='profiles')return m.library?.profiles.map(p=>p.name)??[];
  if(m.page==='complete')return [tr('accepted'),...(m.result?.unresolved.map(u=>`${u.id} · ${u.hint} · ${tr('unbound')}`)??[]),tr('bind_help')];
  if(m.page==='select'){
    const values=m.kind==='style'?source(e).instances.filter(n=>n.type_id!=='spacer').map(n=>`${n.id} · ${n.options.label??t('items.'+m.fromScope+'.'+n.type_id+'.label',language)}`)
      :source(e).groups.map(g=>`[${m.groups.includes(g.id)?'x':' '}] ${g.id} · ${g.member_ids.join(', ')}`);
    return [tr('scope')+': '+m.fromScope,...values,...(m.kind==='groups'?[tr('review')]:[])];
  }
  if(m.page==='fields'){
    const origin=source(e).instances.find(n=>n.id===m.from),destination=e.instance(m.scope,m.destination);
    const available=origin&&destination?styleFields(origin,m.fromScope,e.description.catalog).filter(f=>styleFields(destination,m.scope,e.description.catalog).includes(f)):[];
    return [...STYLE_FIELDS.map(f=>`[${m.fields.includes(f)?'x':' '}] ${t('reuse.field.'+f,language)}${available.includes(f)?'':' · '+tr('unsupported')}`),tr('review')];
  }
  return [];
}
export function reuseKey(e: Editor,event:TextKey,language:Language,width:number,height:number):'reuse'|'sources'|null {
  const m=e.reuse!,key=event.key==='enter'?'return':event.key;
  if(event.overflow)return null;
  if(!event.text&&!event.paste&&(key==='escape'||event.ctrl&&key.toLowerCase()==='g')){e.reuse=null;return null;}
  if(m.page==='path'){
    if(key==='return'&&!event.text&&!event.paste){m.effect='file';return 'reuse';}
    m.input=inputKey(m.input.value,m.input,event,4096).state;return null;
  }
  if(event.text||event.paste||event.ctrl||event.meta)return null;
  if(key.toLowerCase()==='q'){e.reuse=null;return null;}
  if(m.page==='complete'){if(key.toLowerCase()==='b'){e.reuse=null;openSources(e);return 'sources';}const total=rows(e,language).length;if(['up','down','pageup','pagedown','home','end'].includes(key))m.cursor=Math.max(0,Math.min(total-1,key==='home'?0:key==='end'?total-1:m.cursor+(key==='up'?-1:key==='down'?1:key==='pageup'?-Math.max(1,height-3):Math.max(1,height-3))));return null;}
  if(m.generation!==e.mutationGeneration||m.target!==targetIdentity(e.baseline)||!e.canMutateDraft()){m.message=text('history.stale');return null;}
  if(m.page==='review'){
    if(key==='tab'&&m.kind==='groups'){m.details=!m.details;m.scroll=0;return null;}
    if(m.details&&['up','down','pageup','pagedown','home','end'].includes(key)) {const capacity=reviewCapacity(m,height),maximum=Math.max(0,detailRows(m,language).length-capacity);m.scroll=Math.max(0,Math.min(maximum,key==='home'?0:key==='end'?maximum:m.scroll+(key==='up'?-1:key==='down'?1:key==='pageup'?-capacity:capacity)));return null;}
    if(key.toLowerCase()==='a'){
      if(m.result&&!m.result.blocked.length&&e.commitDraft(m.result.draft,text('reuse.action'))){m.page='complete';m.cursor=0;m.scroll=0;}
    }else if(key.toLowerCase()==='x'&&m.kind==='groups'){m.references=m.references==='review'?'expand':m.references==='expand'?'exclude':'review';refresh(e);}
    else if(key.toLowerCase()==='l'&&m.kind==='groups'){m.explicit=!m.explicit;refresh(e);}
    else if(key==='backspace'){m.page=m.kind==='style'?'fields':'select';m.cursor=0;}
    else if(m.review)navigateReview(m.review,key,language,width,reviewCapacity(m,height));
    return null;
  }
  const values=rows(e,language),length=values.length;
  if(['up','down','pageup','pagedown','home','end'].includes(key))m.cursor=Math.max(0,Math.min(length-1,key==='home'?0:key==='end'?length-1:m.cursor+(key==='up'?-1:key==='down'?1:key==='pageup'?-Math.max(1,height-3):Math.max(1,height-3))));
  if(!['return',' ','space','left','right'].includes(key))return null;
  if(m.page==='source'){
    if(m.cursor===0){m.page='select';m.cursor=0;}
    else if(m.cursor===3){m.effect='profiles';return 'reuse';}
    else {m.profileFile=m.cursor===2;m.page='path';}
  }else if(m.page==='profiles'){
    const profile=m.library?.profiles[m.cursor];if(profile){m.incoming={display:clone(profile.display),host:clone(e.draft.host)};m.local=false;m.page='select';m.cursor=0;}
  }else if(m.page==='select'){
    if(m.cursor===0){m.fromScope=m.fromScope==='main'?'subagent':'main';if(m.kind==='groups'){m.scope=m.fromScope;m.groups=[];}return null;}
    if(m.kind==='style'){
      const node=source(e).instances.filter(n=>n.type_id!=='spacer')[m.cursor-1];
      if(node){m.from=node.id;const destination=e.instance(m.scope,m.destination);m.fields=destination?STYLE_FIELDS.slice(0,6).filter(f=>styleFields(node,m.fromScope,e.description.catalog).includes(f)&&styleFields(destination,m.scope,e.description.catalog).includes(f)):[];m.page='fields';m.cursor=0;}
    }else{
      const group=source(e).groups[m.cursor-1];
      if(group)m.groups=m.groups.includes(group.id)?m.groups.filter(id=>id!==group.id):[...m.groups,group.id];
      else if(m.groups.length){refresh(e);m.page='review';m.cursor=0;}
    }
  }else if(m.page==='fields'){
    const field=STYLE_FIELDS[m.cursor];
    if(!field){refresh(e);m.page='review';m.cursor=0;}
    else {const origin=source(e).instances.find(n=>n.id===m.from)!,destination=e.instance(m.scope,m.destination);if(destination&&styleFields(origin,m.fromScope,e.description.catalog).includes(field)&&styleFields(destination,m.scope,e.description.catalog).includes(field))m.fields=m.fields.includes(field)?m.fields.filter(f=>f!==field):[...m.fields,field];else m.message=text('reuse.incompatible');}
  }
  return null;
}
function detailRows(m:ReuseManager,language:Language):{text:string;heading:boolean;section:string}[]{
  const tr=(key:string)=>t('reuse.'+key,language);
  return [
    ...(m.kind==='groups'?[
      {text:tr(m.references)+' · '+tr('reference_policy'),heading:false,section:''},
      {text:t('values.'+(m.explicit?'on':'off'),language)+': '+tr('layout'),heading:false,section:''}
    ]:[]),
    ...(m.result?.dependencies.map(id=>({text:tr('dependency')+': '+id,heading:false,section:''}))??[]),
    ...Object.entries(m.result?.mappings??{}).flatMap(([kind,map])=>Object.entries(map).map(([a,b])=>({text:kind+': '+a+' → '+b,heading:false,section:''}))),
    ...(m.result?.unresolved.map(u=>({text:tr('unbound')+': '+u.id+' · '+u.hint,heading:false,section:''}))??[])
  ];
}
export function reuseView(e:Editor,language:Language,width:number,height:number):{text:string;selected?:boolean}[]{
  const m=e.reuse!,tr=(key:string)=>t('reuse.'+key,language),header=tr(m.kind==='style'?'style':'groups');
  if(m.page==='path')return [{text:header},{text:tr('path')},{text:inputView({...m.input},width)},{text:tr('path_help')}].slice(0,height).map(row=>({...row,text:clip(row.text,width)}));
  if(m.page==='review'){
    const capacity=reviewCapacity(m,height),review=m.review;
    const values=m.details?detailRows(m,language):review?reviewRows(review,language,width):[];
    const offset=m.details?Math.max(0,Math.min(m.scroll,values.length-capacity)):Math.max(0,Math.min(review?.scroll??0,values.length-capacity));
    return [{text:header},...(height>=4?[{text:m.message?renderMessage(m.message,language):tr('draft_only')}]:[]),
      ...(m.kind==='groups'&&height>=6?[{text:tr(m.references)+' · '+tr('reference_policy')}]:[]),
      ...(m.kind==='groups'&&height>=7?[{text:t('values.'+(m.explicit?'on':'off'),language)+': '+tr('layout')}]:[]),
      ...(m.kind==='style'&&height>=5?[{text:tr('scope')+': '+m.fromScope+' · '+m.from+' → '+m.destination}]:[]),
      ...values.slice(offset,offset+capacity).map(r=>({text:r.text,selected:r.heading&&r.section===review?.selected})),{text:tr(m.kind==='groups'?'review_groups_help':'review_style_help')}].slice(0,height).map(row=>({...row,text:clip(row.text,width)}));
  }
  const values=rows(e,language),capacity=Math.max(1,height-3);let start=Math.max(0,Math.min(m.scroll,m.cursor));if(m.cursor>=start+capacity)start=m.cursor-capacity+1;
  return [{text:header},{text:m.message?renderMessage(m.message,language):tr('help')},...values.slice(start,start+capacity).map((value,index)=>({text:(start+index===m.cursor?'› ':'  ')+value,selected:start+index===m.cursor})),{text:tr('cancel_help')}].slice(0,height).map(row=>({...row,text:clip(row.text,width)}));
}
export async function performReuse(e:Editor,backend:ReviewBackend):Promise<void>{
  const m=e.reuse,effect=m?.effect;if(!m||!effect)return;m.effect=null;
  try{
    if(!e.canMutateDraft(m.generation)||m.target!==targetIdentity(e.baseline))throw new Error('history.stale');
    if(effect==='profiles'){
      const library=await backend.request('profiles_read',{});if(e.reuse!==m||m.generation!==e.mutationGeneration)return;m.library=library;m.page='profiles';m.cursor=0;
    }else{
      const incoming=m.profileFile?{display:(await backend.request('profile_import',{path:m.input.value})).display,host:clone(e.draft.host)}:(await backend.request('review_import',{draft:e.draft,path:m.input.value})).draft;
      if(e.reuse!==m||m.generation!==e.mutationGeneration)return;m.incoming=clone(incoming);m.local=false;m.page='select';m.cursor=0;m.groups=[];
    }
    m.message=null;
  }catch(error){if(e.reuse===m)m.message=text('history.failed',{detail:error instanceof Error?error.message:String(error)});}
}
