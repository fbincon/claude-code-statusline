/** Revision-bound binding inventory. Unreadable references prevent deletion. */
import { join, dirname } from 'node:path';
import * as fs from 'node:fs';
import type { BindingReview } from '@fbincon/statusline-core/contracts/ui';
import { sourceId, sourceError } from '@fbincon/statusline-core/extensions/model';
import { object, integer, isSchema } from '@fbincon/statusline-core/config/validation';
import { validateDisplay } from '@fbincon/statusline-core/config/display';
import { validateProfiles } from '@fbincon/statusline-core/config/profiles';
import { readJson } from '@fbincon/statusline-core/json-read';
import { atomicWrite, privateDirectory } from '@fbincon/statusline-platform/files';
import { revision } from '@fbincon/statusline-platform/hash';
import { readSourceFile } from '@fbincon/statusline-platform/source-files';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { safeTarget } from '../integration/paths.js';
import { configurationBytes, readSnapshot } from '../management/configuration.js';
import { MANAGEMENT_ROOT, readOperation } from '../management/store.js';
import { pending, readJournal, readRegular, hash } from '../recovery/journal.js';
import { commit } from '../recovery/files.js';
import { artifact, jsonBytes } from '../config/storage.js';
import { SOURCE_FILENAME } from '@fbincon/statusline-core/extensions/model';
import type { SourceService } from './service.js';
interface Pins { version: 1; owners: Record<string, string[]>; closed?: string[] }
export class SourceBindings {
    constructor(readonly service: SourceService) {}
    private get path() { return join(this.service.root,'drafts.json'); }
    private pins(): Pins {
        safeTarget(this.service.configuration.context.configDir,this.path);
        const bytes=fs.existsSync(this.path)?readRegular(this.path,1024*1024):null;
        if(!bytes)return {version:1,owners:{}};
        const data=readJson(decodeUtf8(bytes));
        if(!object(data)||!isSchema(data.version,1)||!object(data.owners)||Object.keys(data.owners).length>128)sourceError('invalid');
        for(const [owner,ids] of Object.entries(data.owners)) {
            sourceId(owner);if(!Array.isArray(ids)||ids.length>4096)sourceError('invalid');ids.forEach(sourceId);
        }
        if(data.closed!==undefined&&(!Array.isArray(data.closed)||data.closed.length>512))sourceError('invalid');
        if(Array.isArray(data.closed))data.closed.forEach(sourceId);
        return {...data,version:1} as unknown as Pins;
    }
    pin(ownerValue: unknown, bindings: unknown, close=false): {revision:string} {
        const owner=sourceId(ownerValue);
        if(!Array.isArray(bindings)||bindings.length>4096)sourceError('invalid');
        const ids=bindings.map(sourceId);
        return this.service.configuration.io.lock(this.service.configuration.context.configDir,()=>this.reserve(owner,ids,close));
    }
    /** Caller already owns the configuration lock, including the bind publication. */
    reserve(owner:string, ids:string[], close=false): {revision:string} {
        const pins=this.pins();
        if(close){delete pins.owners[owner];pins.closed=[...(pins.closed??[]).filter(id=>id!==owner),owner].slice(-512);}
        else {if(pins.closed?.includes(owner))sourceError('conflict');const previous=Object.hasOwn(pins.owners,owner)?pins.owners[owner]!:[];const combined=[...new Set([...previous,...ids])].sort();if(combined.length)pins.owners[owner]=combined;else delete pins.owners[owner];}
        if(Object.keys(pins.owners).length>128)sourceError('busy');
        safeTarget(this.service.configuration.context.configDir,this.path);privateDirectory(dirname(this.path));
        const raw=jsonBytes(pins);if(raw.length>1024*1024)sourceError('output_limit');atomicWrite(this.path,raw);
        return {revision:revision(pins)};
    }
    review(offsetValue:unknown=0,complete=false): BindingReview {
        const offset=integer(offsetValue,0,Number.MAX_SAFE_INTEGER,'offset'), registry=this.service.read(), directory=this.service.configuration.context.configDir;
        const refs=new Map<string,string[]>(), inputs:unknown[]=[registry.revision];let uncertain=false;
        const scan=(value:unknown,label:string):void=>{
            if(Array.isArray(value)){value.forEach(v=>scan(v,label));return;}
            if(!object(value))return;
            if(typeof value.binding==='string') {const labels=refs.get(value.binding)??[];if(!labels.includes(label))labels.push(label);refs.set(value.binding,labels);}
            Object.values(value).forEach(v=>{if(v!==value)scan(v,label);});
        };
        const document=(bytes:Buffer|null,name:string,label:string)=>{
            inputs.push([label,hash(bytes)]);if(!bytes)return;
            const value=readJson(decodeUtf8(bytes));
            scan(name==='claude-statusline.json'?validateDisplay(value):validateProfiles(value),label);
        };
        try {
            const bytes=configurationBytes(directory);
            for(const name of ['claude-statusline.json','claude-statusline-profiles.json'])document(bytes[name]??null,name,name);
            const pins=this.pins();inputs.push(pins);
            for(const [owner,ids]of Object.entries(pins.owners))for(const id of ids){const labels=refs.get(id)??[];labels.push('draft:'+owner);refs.set(id,labels);}
            for(const path of pending(directory)) {
                const journal=readJournal(directory,path);inputs.push(journal);
                if(journal.kind==='files')for(const entry of journal.entries)if(entry.snapshot&&['claude-statusline.json','claude-statusline-profiles.json'].includes(entry.path)) {
                    const bytes=readRegular(join(directory,entry.snapshot));if(hash(bytes)!==entry.before)throw new Error('Changed snapshot');
                    document(bytes,entry.path,'recovery:'+journal.id);
                }
            }
            const folder=join(directory,MANAGEMENT_ROOT,'transactions');safeTarget(directory,folder);
            const entries=fs.existsSync(folder)?fs.readdirSync(folder).sort():[];
            if(entries.length>4096)throw new Error('Too many retained transactions');
            inputs.push(entries);
            for(const id of entries) {
                if(!/^pkg-[0-9a-f-]{36}$/u.test(id))throw new Error('Unknown transaction');
                const path=join(folder,id,'operation.json');safeTarget(directory,path);
                const raw=JSON.parse(decodeUtf8(readRegular(path,1024*1024)));
                const operation=readOperation(directory,raw.prefix,id);inputs.push(operation);
                if(operation.snapshot){const snapshot=readSnapshot(directory,join(folder,id),operation.snapshot);for(const name of ['claude-statusline.json','claude-statusline-profiles.json'])document(snapshot[name]??null,name,'package:'+id);}
            }
        } catch {uncertain=true;}
        const rows=registry.bindings.map(binding=>({id:binding.id,source_id:binding.source_id,references:(refs.get(binding.id)??[]).slice(0,16),duplicate:registry.bindings.some(b=>b.id!==binding.id&&b.source_id===binding.source_id),removable:!uncertain&&!refs.has(binding.id)}));
        return {revision:revision([inputs,uncertain]),rows:complete?rows:rows.slice(offset,offset+16),offset,total:rows.length,uncertain};
    }
    cleanup(expected:unknown, selected:unknown):BindingReview {
        if(typeof expected!=='string'||!Array.isArray(selected)||!selected.length||selected.length>16)sourceError('invalid');
        const ids=selected.map(sourceId);
        return this.service.configuration.io.lock(this.service.configuration.context.configDir,()=>{
            const registry=this.service.read(), first=this.review(0,true), all=first.rows;
            if(first.revision!==expected||first.uncertain)sourceError('conflict');
            if(ids.some(id=>!all.some(row=>row.id===id&&row.removable)))sourceError('referenced');
            const path=join(this.service.configuration.context.configDir,SOURCE_FILENAME),raw=readSourceFile(path);
            const {revision:_,...value}=registry;value.bindings=value.bindings.filter(b=>!ids.includes(b.id));
            commit(this.service.configuration.context.configDir,'source-bindings-cleanup',[{...artifact(path,raw),desired:jsonBytes(value)}],this.service.configuration.io);
            return this.review();
        });
    }
}
