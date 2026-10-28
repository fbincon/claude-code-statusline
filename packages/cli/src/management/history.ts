/** Explicit cleanup of owned completed records; reviews never repair history. */
import * as fs from 'node:fs';
import { join } from 'node:path';
import type { PackageCleanupReview } from '@fbincon/statusline-core/contracts/ui';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { revision } from '@fbincon/statusline-platform/hash';
import { processAlive } from '@fbincon/statusline-platform/processes';
import { lock, isLinkOrReparse } from '@fbincon/statusline-platform/files';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { readRegular, pending } from '../recovery/journal.js';
import { safeTarget } from '../integration/paths.js';
import { createStorage } from '../config/storage.js';
import { MANAGEMENT_ROOT, readOperation, pendingPath } from './store.js';
import { readExecution, executionStatus, executionFolder } from './execution.js';
import type { InspectionContext } from './inspection.js';
function names(directory:string,folder:string):string[]{safeTarget(directory,folder);const result=fs.existsSync(folder)?fs.readdirSync(folder).sort():[];if(result.length>4096)throw new PackageError('journal');return result;}
export function reviewHistory(context:InspectionContext,prefix:string,offset=0,all=false):PackageCleanupReview {
    if(!Number.isSafeInteger(offset)||offset<0)throw new PackageError('arguments');
    const directory=context.configDir,root=join(directory,MANAGEMENT_ROOT),inputs:unknown[]=[prefix],rows:PackageCleanupReview['rows']=[];
    let uncertain=false;const referenced=new Set<string>(),previous=new Set<string>();
    try {
        if(pending(directory).length)uncertain=true;
        for(const name of names(directory,join(root,'installations'))){
            if(!/^[a-f0-9]{64}\.json$/u.test(name))throw new PackageError('journal');
            const path=join(root,'installations',name);safeTarget(directory,path);const value=JSON.parse(readRegular(path,1024*1024).toString('utf8'));inputs.push(value);
            if(value.schema_version!==1||typeof value.transaction!=='string'||!value.current?.version)throw new PackageError('journal');
            referenced.add(value.transaction);if(value.previous)previous.add(JSON.stringify([value.previous.prefix,value.previous.version,value.previous.inventory_sha256]));
        }
        // Queued workers can reference an existing snapshot before they create
        // their own package transaction. Protect that input under the same lock.
        for(const id of names(directory,join(root,'executions'))){
            const record=readExecution(directory,id),status=executionStatus(directory,id);
            if(status.state!=='complete'||status.running!==false){
                if(record.request.backup_id)referenced.add(record.request.backup_id);
                if(status.transaction_id)referenced.add(status.transaction_id);
            }
        }
        let selectedPending:string|null=null;
        if(fs.existsSync(pendingPath(prefix))){const path=pendingPath(prefix);safeTarget(prefix,path);const marker=JSON.parse(readRegular(path,65536).toString('utf8'));inputs.push(marker);if(marker.configDir!==directory||marker.prefix!==prefix)throw new PackageError('journal');selectedPending=marker.id;}
        for(const id of names(directory,join(root,'transactions'))){
            const path=join(root,'transactions',id,'operation.json');safeTarget(directory,path);
            const raw=JSON.parse(readRegular(path,1024*1024).toString('utf8')),operation=readOperation(directory,raw.prefix,id);inputs.push(operation);
            if(operation.prefix!==prefix)continue;
            const reasons:string[]=[];
            if(operation.stage!=='complete')reasons.push('pending');
            if(operation.executors?.some(p=>processAlive(p.pid,p.token)!==false))reasons.push('running');
            if(operation.id===selectedPending)reasons.push('pending');
            if(referenced.has(id))reasons.push('current');
            if(operation.after&&previous.has(JSON.stringify([operation.after.prefix,operation.after.version,operation.after.inventory_sha256])))reasons.push('previous');
            rows.push({id,version:operation.version,removable:!reasons.length,reasons});
        }
        for(const id of names(directory,join(root,'executions'))){
            const record=readExecution(directory,id),status=executionStatus(directory,id);inputs.push([record,status.running]);
            if(status.prefix!==prefix)continue;
            const reasons:string[]=[];
            if(status.running!==false)reasons.push('running');if(status.state!=='complete')reasons.push('pending');if(!record.detached)reasons.push('attached');
            rows.push({id,version:record.review.target,removable:!reasons.length,reasons});
        }
    }catch{uncertain=true;}
    if(uncertain)for(const row of rows){row.removable=false;row.reasons.push('uncertain');}
    return {version:1,revision:revision([inputs,uncertain]),prefix,offset,total:rows.length,uncertain,rows:all?rows:rows.slice(offset,offset+16)};
}
/** Never traverse a link, special file or an unrecognized top-level artifact. */
function ownedTree(directory:string,path:string,execution:boolean):void {
    const allowed=new Set(execution?['execution.json','detached.json','runner','.claim']:['operation.json','target.tgz','snapshot','recovery-runner']);
    const pending=[path];let entries=0;
    while(pending.length){const current=pending.pop()!;safeTarget(directory,current);if(isLinkOrReparse(current))throw new PackageError('journal');const stat=fs.lstatSync(current);if(!stat.isFile()&&!stat.isDirectory())throw new PackageError('journal');if(++entries>32768)throw new PackageError('journal');if(stat.isDirectory())for(const name of fs.readdirSync(current)){if(current===path&&!allowed.has(name))throw new PackageError('journal');pending.push(join(current,name));}}
}
export function cleanupHistory(context:InspectionContext,prefix:string,expected:unknown,ids:unknown):PackageCleanupReview {
    if(typeof expected!=='string'||!Array.isArray(ids)||!ids.length||ids.length>16||ids.some(id=>typeof id!=='string'||!/^(?:pkg|execution)-[0-9a-f-]{36}$/u.test(id)))throw new PackageError('arguments');
    const release=lock(join(prefix,'.claude-statusline-install.lock'),true);
    try{return createStorage().lock(context.configDir,()=>{
        const review=reviewHistory(context,prefix,0,true);
        if(review.revision!==expected||review.uncertain||ids.some(id=>!review.rows.some(row=>row.id===id&&row.removable)))throw new PackageError('conflict');
        const paths=ids.map(id=>id.startsWith('execution-')?executionFolder(context.configDir,id):join(context.configDir,MANAGEMENT_ROOT,'transactions',id));
        paths.forEach((path,i)=>ownedTree(context.configDir,path,ids[i].startsWith('execution-')));
        for(const path of paths)removeTree(path);
        return reviewHistory(context,prefix);
    });}finally{release();}
}
