import * as fs from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FORMATS, type PackageCompatibility } from '@fbincon/statusline-core/management/compatibility';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { readJson } from '@fbincon/statusline-core/json-read';
import { integer } from '@fbincon/statusline-core/json';
import { validateDisplay } from '@fbincon/statusline-core/config/display';
import { validateProfiles } from '@fbincon/statusline-core/config/profiles';
import { registry } from '@fbincon/statusline-core/extensions/model';
import { parseNative,parseFeature,parseRuntime } from '@fbincon/statusline-core/config/backend-preferences';
import { resolveLanguage } from '@fbincon/statusline-core/i18n/registry';
import { safeTarget } from '../integration/paths.js';
import { BINDING_FILE } from '../integration/ownership.js';
import { hash, readRegular } from '../recovery/journal.js';
import { atomicWrite } from '@fbincon/statusline-platform/files';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';

export const CONFIG_FILES=[...Object.keys(CONFIG_FORMATS),'settings.json',BINDING_FILE];
export type ConfigBytes=Record<string,Buffer|null>;
export type ConfigHashes=Record<string,string|null>;
export function configurationBytes(directory:string):ConfigBytes{
    const result:ConfigBytes={};let size=0;
    for(const name of CONFIG_FILES){
        const path=join(directory,name);safeTarget(directory,path);
        try{
            const stat=fs.lstatSync(path);
            if(!stat.isFile() || stat.size>32*1024*1024)throw new PackageError('configuration');
            result[name]=fs.readFileSync(path);size+=result[name]!.length;
            if(size>64*1024*1024)throw new PackageError('configuration');
        }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')result[name]=null;else throw error;}
    }
    return result;
}
export const configurationHashes=(bytes:ConfigBytes):ConfigHashes=>Object.fromEntries(CONFIG_FILES.map(name=>[name,hash(bytes[name]??null)]));
export function assertConfiguration(directory:string,expected:ConfigHashes):void{
    const actual=configurationHashes(configurationBytes(directory));
    if(CONFIG_FILES.some(name=>actual[name]!==expected[name]))throw new PackageError('conflict');
}
export function configurationCompatibility(bytes:ConfigBytes,target:PackageCompatibility):string[]{
    const reasons:string[]=[];
    for(const [name,format] of Object.entries(CONFIG_FORMATS)){
        const raw=bytes[name];if(raw===null || raw===undefined)continue;
        try{
            const value=readJson(decodeUtf8(raw),{duplicate(){throw new Error('duplicate');}}) as any;
            if(!value || typeof value!=='object' || Array.isArray(value))throw new Error();
            const version=Number(integer(format==='profiles' || format==='sources'?value.version:value.schema_version));
            const [minimum,maximum]=target.read[format];
            if(version<minimum || version>maximum)throw new Error();
            if(format==='display')validateDisplay(value);
            if(format==='profiles'){
                validateProfiles(value);
                for(const profile of value.profiles){
                    const schema=Number(integer(profile.display.schema_version));
                    if(schema<target.read.display[0] || schema>target.read.display[1])throw new Error();
                }
            }
            if(format==='sources')registry(value);
            if(format==='native_preferences')parseNative(decodeUtf8(raw));
            if(format==='external_preferences')parseFeature(decodeUtf8(raw));
            if(format==='runtime_preferences')parseRuntime(decodeUtf8(raw));
            if(format==='ui_preferences' && !resolveLanguage(value.ui_language))throw new Error();
        }catch{reasons.push(name);}
    }
    return reasons;
}
export function saveSnapshot(directory:string,transaction:string,bytes:ConfigBytes):ConfigHashes{
    const hashes=configurationHashes(bytes);
    for(const name of CONFIG_FILES){
        const raw=bytes[name];if(raw===null || raw===undefined)continue;
        const path=join(transaction,'snapshot',name);safeTarget(directory,path);atomicWrite(path,raw);
    }
    return hashes;
}
export function readSnapshot(directory:string,transaction:string,hashes:ConfigHashes):ConfigBytes{
    if(!hashes || Object.keys(hashes).sort().join('\0')!==[...CONFIG_FILES].sort().join('\0'))throw new PackageError('backup');
    const bytes:ConfigBytes={};
    for(const name of CONFIG_FILES){
        if(hashes[name]===null){bytes[name]=null;continue;}
        const path=join(transaction,'snapshot',name);safeTarget(directory,path);
        try{bytes[name]=readRegular(path);}catch{throw new PackageError('backup');}
        if(hash(bytes[name]!)!==hashes[name])throw new PackageError('backup');
    }
    return bytes;
}
