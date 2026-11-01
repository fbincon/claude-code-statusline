import {parentPort,workerData} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {join} from 'node:path';
const require=createRequire(join(workerData.sdk,'package.json'));
try {
    const {DefaultArtifactClient}=require('@actions/artifact');
    const {name,files,root,retentionDays,compressionLevel}=workerData;
    const result=await new DefaultArtifactClient().uploadArtifact(name,files,root,{retentionDays,compressionLevel});
    parentPort.postMessage({result});
} catch (error) {
    // Keep the original SDK classification inside the worker boundary; the outer Action prints only safe categories.
    parentPort.postMessage({error:{message:String(error.message),name:error.name,code:error.code,status:error.statusCode??error.status}});
}
