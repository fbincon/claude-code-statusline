/** Transfer recovery decisions do not depend on the SDK or the runner filesystem. */
import assert from 'node:assert/strict';
import { isTransient, recoveryDelay } from './ci-transfer-policy.ts';

export interface TransferObject { id:number; name:string; digest:string }
export interface ScopedObject extends TransferObject { own:boolean }
export interface TransferProgress { attempts:number; recovery:'none'|'retried'|'reconciled' }
export function normalizedDigest(value: string): string {
    assert.match(value,/^(?:sha256:)?[a-f0-9]{64}$/u,'Invalid artifact digest'); return 'sha256:'+value.replace(/^sha256:/u,'');
}
export function artifactName(name: string): string {
    assert.match(name,/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,239}$/u,'Invalid artifact name');return name;
}
export async function boundedUpload(io: {
    list():Promise<ScopedObject[]>; upload():Promise<TransferObject>; matches(object:TransferObject):Promise<void>;
    wait(ms:number):Promise<void>; progress(p:TransferProgress):void;
}):Promise<TransferObject> {
    const before = await io.list(); assert(!before.some(a=>a.own),'This job already owns an artifact of the same name');
    const prior = new Set(before.map(a=>a.id));
    const reconcile = async () => {
        const pending = (await io.list()).filter(a=>!prior.has(a.id));
        if (!pending.length) return null;
        assert.equal(pending.length,1,'Ambiguous artifacts after an unconfirmed upload');
        const item = pending[0]!;assert(item.own,'Unconfirmed artifact belongs to another Actions job or attempt');
        await io.matches(item);
        return {id:item.id,name:item.name,digest:item.digest};
    };
    let uncertain = false;
    for (let attempt=1;attempt<=2;attempt++) {
        io.progress({attempts:attempt,recovery:attempt===1?'none':'retried'});
        try {
            const uploaded=await io.upload();
            if(uncertain){
                // The first finalize may arrive while the retry is transmitting.
                // Trust only the single new original ID, even when the second call returns success.
                const found=await reconcile();
                assert(found,'Missing confirmed retry artifact');
                assert.deepEqual(found,uploaded,'Retry acknowledgment differs from the unique original artifact');
            }
            return uploaded;
        }
        catch (error) {
            // A conflict after a lost response can mean that the first upload finished late.
            // A conflict on the first call, a permission error, or any integrity failure is terminal.
            const conflict = (error as any)?.status===409 || /^Failed to CreateArtifact: Received non-retryable error: Failed request: \(409\)/u.test((error as any)?.message??'');
            if (!isTransient(error) && !(uncertain && conflict)) throw error;
            uncertain=true;
            const found = await reconcile();
            if (found) {io.progress({attempts:attempt,recovery:'reconciled'});return found;}
            const delay = recoveryDelay(error,attempt,10_000);
            if (attempt===2 || delay===null || conflict) throw error;
            await io.wait(delay);
            const late=await reconcile();
            if(late){io.progress({attempts:attempt,recovery:'reconciled'});return late;}
        }
    }
    throw new Error('Upload recovery exhausted');
}
export async function boundedDownload<T>(read:(attempt:number)=>Promise<T>,wait:(ms:number)=>Promise<void>,progress:(p:TransferProgress)=>void):Promise<T> {
    progress({attempts:1,recovery:'none'});
    try {return await read(1);}
    catch(error) {
        const delay=recoveryDelay(error,1,10_000); if(!isTransient(error)||delay===null)throw error;
        await wait(delay);progress({attempts:2,recovery:'retried'});return read(2);
    }
}
