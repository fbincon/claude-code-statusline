import { detectClaudeVersion } from '@fbincon/statusline-platform/commands';
/** Durable editor handoff. Workers, controls and requests survive package replacement. */
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { PackageExecution, PackageReviewRequest, PackageReviewView } from '@fbincon/statusline-core/contracts/ui';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { productRoot, productIdentity, writablePrefix } from '@fbincon/statusline-platform/npm';
import { copyPackage } from '@fbincon/statusline-platform/package-copy';
import { startReviewWorker } from '@fbincon/statusline-platform/review-worker';
import { atomicWrite, privateDirectory, lock, durableUnlink } from '@fbincon/statusline-platform/files';
import { processToken, processAlive } from '@fbincon/statusline-platform/processes';
import { safeTarget } from '../integration/paths.js';
import { readPrivateState } from '@fbincon/statusline-platform/private-state';
import { inspectPackage, type InspectionContext, packageReason } from './inspection.js';
import { packageReviewJob } from './review-jobs.js';
import { MANAGEMENT_ROOT, type PackageOperation } from './store.js';
import { manage, type ManagementEnvironment } from './service.js';
export interface ExecutionRecord {
    schema_version: 1; owner: string; detached?: boolean; configDir: string; origin: string; request: PackageReviewRequest; review: PackageReviewView;
    pid: number | null; token: string | null; starter?: {pid:number;token:string}; value: PackageExecution;
}
export function executionFolder(configDir:string,id:string):string {
    if(!/^execution-[0-9a-f-]{36}$/u.test(id))throw new PackageError('arguments');
    const path=join(configDir,MANAGEMENT_ROOT,'executions',id);safeTarget(configDir,path);return path;
}
const markerPath=(prefix:string)=>join(prefix,'.claude-statusline-editor-operation.json');
export function writeExecution(record:ExecutionRecord):void {atomicWrite(join(executionFolder(record.configDir,record.value.id),'execution.json'),JSON.stringify(record)+'\n');}
export function readExecution(configDir:string,id:string):ExecutionRecord {
    const folder=executionFolder(configDir,id),path=join(folder,'execution.json');safeTarget(configDir,path);
    let record:ExecutionRecord;try{record=JSON.parse(readPrivateState(path,1024*1024).toString('utf8'));}catch{throw new PackageError('journal');}
    if(record.schema_version!==1||record.configDir!==configDir||record.value?.id!==id||record.request?.prefix!==record.value.prefix||record.value.control?.config_dir!==configDir||record.value.control.args.length!==1||record.value.control.args[0]!==join(folder,'runner','bin','claude-statusline.js')||record.value.version!==1||!['running','complete','failed','interrupted'].includes(record.value.state)||!(record.pid===null||Number.isSafeInteger(record.pid)&&record.pid>0)||!(record.token===null||typeof record.token==='string')||typeof record.value.started_at!=='string'||!Number.isFinite(Date.parse(record.value.started_at)))throw new PackageError('journal');
    const detached=join(folder,'detached.json');
    record.detached=fs.existsSync(detached)&&JSON.parse(readPrivateState(detached,65536).toString('utf8')).owner===record.owner;
    return record;
}
export function executionStatus(configDir:string,id:string):PackageExecution {
    const record=readExecution(configDir,id),value=record.value;
    const running=record.pid&&record.token?processAlive(record.pid,record.token):null;
    if(value.state==='running'&&(running===false||running===null&&Date.now()-Date.parse(value.started_at)>15000))return {...value,state:'interrupted',error:'interrupted',running};
    return {...value,running};
}
export function startExecution(context:InspectionContext,id:unknown,owner:unknown):PackageExecution {
    if(typeof id!=='string'||typeof owner!=='string')throw new PackageError('arguments');
    const job=packageReviewJob(context,id,owner),review=job.review,request=job.request;
    if(job.state!=='complete'||!review?.compatible||request.action==='check'||request.action!=='restore-config'&&!review.artifact_verified)throw new PackageError('integrity');
    if(inspectPackage(context,request.prefix).revision!==request.expected_revision)throw new PackageError('conflict');
    const origin=productRoot(context.origin);if(!origin||!productIdentity(origin))throw new PackageError('development');
    writablePrefix(request.prefix);
    const release=lock(join(request.prefix,'.claude-statusline-install.lock'),true);
    try {
        const marker=markerPath(request.prefix);safeTarget(request.prefix,marker);
        if(fs.existsSync(marker)){
            const prior=JSON.parse(readPrivateState(marker,65536).toString('utf8'));
            if(prior.configDir!==context.configDir||typeof prior.id!=='string')throw new PackageError('busy');
            const status=executionStatus(context.configDir,prior.id);
            if(status.running!==false)throw new PackageError('busy');
        }
        if(inspectPackage(context,request.prefix).revision!==request.expected_revision)throw new PackageError('conflict');
        const executionId='execution-'+randomUUID(),folder=executionFolder(context.configDir,executionId),runner=join(folder,'runner');privateDirectory(folder);copyPackage(origin,runner);
        if(!productIdentity(runner))throw new PackageError('identity');
        const stamp=new Date().toISOString();
        const value:PackageExecution={version:1,id:executionId,transaction_id:null,action:request.action,prefix:request.prefix,state:'running',stage:'queued',started_at:stamp,updated_at:stamp,finished_at:null,error:null,running:null,results:request.action==='restore-config'?{package:null,integration:null,configuration:false}:{package:false,integration:false,configuration:null},control:{executable:process.execPath,args:[join(runner,'bin','claude-statusline.js')],config_dir:context.configDir}};
        const record:ExecutionRecord={schema_version:1,owner,configDir:context.configDir,origin,request,review,pid:null,token:null,value};
        if(process.platform==='win32'&&productRoot(fileURLToPath(import.meta.url))===origin){const token=processToken(process.pid);if(!token)throw new PackageError('busy');record.starter={pid:process.pid,token};}
        writeExecution(record);atomicWrite(marker,JSON.stringify({owner:'claude-code-statusline',schema_version:1,configDir:context.configDir,id:executionId})+'\n');
        try{startReviewWorker(join(runner,'node_modules/@fbincon/statusline-cli/dist/src/management/execution-worker-entry.js'),[context.configDir,executionId],folder);}catch(error){record.value={...value,state:'failed',error:packageReason(error),running:false,finished_at:stamp};writeExecution(record);throw error;}
        return value;
    } finally{release();}
}
/** Injectable management boundary is shared by real installed and failure tests. */
export async function executeReviewed(record:ExecutionRecord,environment:Partial<ManagementEnvironment>={}):Promise<number> {
    const request=record.request,review=record.review,context:InspectionContext={configDir:record.configDir,origin:record.origin,hostVersion:environment.host??detectClaudeVersion};
    const check=()=>{if(inspectPackage(context,request.prefix).revision!==request.expected_revision)throw new PackageError('conflict');};
    check();
    const command=request.action==='recover-package'||request.action==='restore-config'?'recover':request.action;
    const args=[command,'--prefix',request.prefix,'--config-dir',record.configDir,'--yes'];
    if(request.action==='restore-config')args.push('--restore-config',request.backup_id!);else args.push('--version',review.target!);
    if(request.action==='recover-package')args.push('--package');
    const update=(stage:string,operation?:PackageOperation)=>{
        record.value.stage=stage;record.value.updated_at=new Date().toISOString();
        if(operation){record.value.transaction_id=operation.id;record.value.results.package=operation.results?.package??false;record.value.results.integration=operation.results?.integration??false;}
        writeExecution(record);
    };
    let active:PackageOperation|undefined;
    update('reviewing');
    const code=await manage(args,{...environment,origin:record.origin,host:context.hostVersion,tty:false,stdout:()=>{},stderr:()=>{},confirm:async()=>true,
        review(value){
            check();
            if(value.action==='restore-config'){if(value.backup_id!==review.backup_id)throw new PackageError('conflict');}
            else if(value.target!==review.target||value.integrity!==review.integrity||value.prefix!==review.prefix||value.registry!==review.registry)throw new PackageError('integrity');
            environment.review?.(value);
        },beforeMutation(){check();},operationStarted(operation){
            active=operation;
            if(record.pid&&record.token){operation.executors=[...(operation.executors??[]),{pid:record.pid,token:record.token}];}
            update(operation.stage,operation);environment.operationStarted?.(operation);
        },checkpoint(stage,operation){update(stage,operation);environment.checkpoint?.(stage,operation);},failure(reason){record.value.error=reason;environment.failure?.(reason);},
    });
    if(code===0){if(request.action==='restore-config')record.value.results.configuration=true;update('complete',active);}
    return code;
}
export async function executionWorker(configDir:string,id:string):Promise<void> {
    const record=readExecution(configDir,id),token=processToken(process.pid);
    if(!token||record.value.state!=='running'||Date.now()-Date.parse(record.value.started_at)>15000)throw new PackageError('busy');
    const folder=executionFolder(configDir,id),claim=join(folder,'.claim');fs.mkdirSync(claim,{mode:0o700});
    record.pid=process.pid;record.token=token;writeExecution(record);
    let code=2;
    try {
        if(record.starter){const end=Date.now()+15000;while(processAlive(record.starter.pid,record.starter.token)!==false&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,50));if(processAlive(record.starter.pid,record.starter.token)!==false)throw new PackageError('busy');}
        code=await executeReviewed(record);
    }catch(error){record.value.error=packageReason(error);}
    finally{
        record.value.state=code===0?'complete':code===130?'interrupted':'failed';record.value.finished_at=new Date().toISOString();record.value.updated_at=record.value.finished_at;
        if(code===0){record.value.stage='complete';if(record.request.action==='restore-config')record.value.results.configuration=true;else{record.value.results.package=true;record.value.results.integration=true;}}
        writeExecution(record);
        try {const marker=markerPath(record.request.prefix),value=JSON.parse(readPrivateState(marker,65536).toString('utf8'));if(value.id===id&&value.configDir===configDir)durableUnlink(marker);}catch{/* Preserve an uncertain reservation. */}
        try{fs.rmdirSync(claim);}catch{/* Never erase recovery data on failed cleanup. */}
    }
}

export function detachExecution(configDir:string,id:string,owner:string):PackageExecution{
    const record=readExecution(configDir,id);if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/u.test(owner))throw new PackageError('identity');atomicWrite(join(executionFolder(configDir,id),'detached.json'),JSON.stringify({owner:record.owner,viewer:owner})+'\n');return executionStatus(configDir,id);
}

export function activeExecution(configDir:string,prefix:string):PackageExecution|null{
    const marker=markerPath(prefix);safeTarget(prefix,marker);
    if(!fs.existsSync(marker))return null;
    const data=JSON.parse(readPrivateState(marker,65536).toString('utf8'));
    if(data.owner!=='claude-code-statusline'||data.configDir!==configDir||typeof data.id!=='string')throw new PackageError('identity');
    const value=executionStatus(configDir,data.id);if(value.prefix!==prefix)throw new PackageError('identity');return value;
}
