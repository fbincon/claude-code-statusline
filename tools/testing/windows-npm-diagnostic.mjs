// Diagnostic branch only: never release evidence and never merged into main.
import fs from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {installCandidate} from '../../dist/typescript/tools/acceptance/install.js';
import {installedFirstEntry} from '../../dist/typescript/tools/acceptance/first-entry.js';
const root=process.env.DIAGNOSTIC_ROOT,output=join(root,'npm-diagnostic');
fs.mkdirSync(output,{recursive:true});
process.env.NODE_OPTIONS='--import='+pathToFileURL(join(process.cwd(),'tools/testing/no-python.mjs')).href;
const artifact=join(root,'candidate/fbincon-claude-code-statusline-3.7.0.tgz');
const commit='69b0dc232d6329920202a15581a742c6c1681a04';
for(let round=1;round<=10;round++){
    let installed;
    try{
        installed=installCandidate(artifact,commit);
        const cases=await installedFirstEntry(installed);
        console.log(JSON.stringify({round,status:'pass',cases,node:process.version}));
    }catch(error){
        console.error(String(error));fs.writeFileSync(join(output,'failure.json'),JSON.stringify({round,node:process.version,error:String(error)},null,2));process.exitCode=1;break;
    }finally{
        if(installed){const trace=join(installed.temporary,'first-entry-trace.jsonl');if(fs.existsSync(trace))fs.copyFileSync(trace,join(output,'round-'+round+'.jsonl'));installed.cleanup();}
    }
}
