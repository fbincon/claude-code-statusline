import type { ConfigTarget, ReuseRequest, Scope } from '@fbincon/statusline-core/contracts/ui';
import { reuseDraft } from '@fbincon/statusline-core/editor/reuse';
import { ITEMS } from '@fbincon/statusline-core/config/catalog';
import { findProfile } from '@fbincon/statusline-core/config/profiles';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { revision } from '@fbincon/statusline-platform/hash';
import { explicitProjectPath } from '@fbincon/statusline-platform/project-paths';
import { randomUUID } from 'node:crypto';
import { ProfileService } from './profiles.js';
import { draft, type ConfigurationService } from './service.js';
import { importFile } from './transfer.js';
import { ArgumentError } from './arguments.js';

export const reuseFlags = (flags: Record<string, unknown>): boolean => ['style-from','style-to','style-fields','groups'].some(key=>flags[key]!==undefined);
function reference(value: unknown): { scope: Scope; id: string } {
  const match=typeof value==='string'?/^(main|subagent):([A-Za-z0-9][A-Za-z0-9_-]{0,95})$/u.exec(value):null;
  if(!match)throw new ArgumentError('Use scope:id (main or subagent)');return {scope:match[1] as Scope,id:match[2]!};
}
export function reuseImport(service:ConfigurationService,path:string,flags:Record<string,unknown>,profile=false):string{
  if(flags.select!==undefined||flags.name!==undefined||flags.overwrite!==undefined)throw new ArgumentError('Reuse cannot be combined with --select, --name or --overwrite');
  const targets=['user','profile','project'].filter(key=>flags[key]!==undefined);if(targets.length>1)throw new ArgumentError('Choose one target');
  const profiles=new ProfileService(service),target:ConfigTarget=flags.profile!==undefined?{kind:'profile',id:findProfile(profiles.read(),String(flags.profile)).id}:flags.project!==undefined?{kind:'project',path:explicitProjectPath(String(flags.project))}:{kind:'user'};
  const current=profiles.readTarget(target),base=draft(current),incoming=profile||flags['profile-file']?{display:profiles.import(path).display,host:base.host}:importFile(path,base);
  let request:ReuseRequest;
  if(flags.groups!==undefined){
    if(['style-from','style-to','style-fields'].some(k=>flags[k]!==undefined))throw new ArgumentError('Choose style or groups');
    const groups=String(flags.groups).split(',').map(reference),scope=groups[0]!.scope;
    if(groups.some(g=>g.scope!==scope)||!['review','expand','exclude'].includes(String(flags.references??'review')))throw new ArgumentError('Invalid group scope or --references');
    request={kind:'groups',scope,group_ids:groups.map(g=>g.id),references:(flags.references??'review') as 'review'|'expand'|'exclude',explicit:flags['explicit-layout']===true};
  }else{
    const origin=reference(flags['style-from']),destinations=String(flags['style-to']??'').split(',').map(reference),scope=destinations[0]!.scope;
    if(destinations.some(d=>d.scope!==scope)||typeof flags['style-fields']!=='string'||!flags['style-fields'].trim()||flags.references!==undefined||flags['explicit-layout']!==undefined)throw new ArgumentError('Style reuse requires compatible destinations and --style-fields');
    request={kind:'style',scope,from_scope:origin.scope,from_id:origin.id,to_ids:destinations.map(d=>d.id),fields:flags['style-fields'].split(',').map(f=>f.trim())};
  }
  let result;
  try{result=reuseDraft(base,incoming,request,()=>randomUUID().replaceAll('-',''),ITEMS);}catch(error){throw new ConfigError(error instanceof Error&&error.message==='reuse.incompatible'?'reuse.incompatible':'reuse.invalid');}
  const sourceRevision=revision(incoming),review={expected_revision:current.revision,source_revision:sourceRevision,configuration:current.configuration,...result};
  if(flags['dry-run'])return pythonJson(review,{ensureAscii:false,indent:2});
  if(result.blocked.length)throw new ConfigError(result.blocked[0]!);
  if(typeof flags['expected-revision']!=='string'||typeof flags['source-revision']!=='string')throw new ArgumentError('Review with --dry-run, then pass --expected-revision and --source-revision');
  if(flags['source-revision']!==sourceRevision)throw new ConfigError('review.stale',{},'configuration_conflict');
  const applied=profiles.applyTarget(result.draft,flags['expected-revision'],target);
  return pythonJson({...review,changed:applied.changed,backup_dir:applied.backup_dir},{ensureAscii:false,indent:2});
}
