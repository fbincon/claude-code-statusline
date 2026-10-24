// Diagnostic branch only. Exercise the immutable failed-run artifact unchanged.
import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {installCandidate} from '../../dist/typescript/tools/acceptance/install.js';
import {installedVersionManagement} from '../../dist/typescript/tools/acceptance/version-management.js';
const root=process.env.DIAGNOSTIC_ROOT,version=process.env.DIAGNOSTIC_HOST;
const output=join(root,'version-diagnostic');fs.mkdirSync(output,{recursive:true});
const host={executable:join(root,'claude-host/node_modules/@anthropic-ai/claude-code/bin/claude.exe'),args:[],version};
const artifact=join(root,'candidate/fbincon-claude-code-statusline-3.8.0.tgz');
const commit='e3029feed60d67ff7f2ccc1ac6e22bf6aa588a19';
for(let round=0;round<3;round++){
 const installed=installCandidate(artifact,commit);
 installed.env.NODE_OPTIONS='--import='+pathToFileURL(resolve('tools/testing/windows-process-trace.mjs')).href;
 installed.env.STATUSLINE_DIAGNOSTIC_TRACE=join(output,`process-${round}.jsonl`);
 try{
  const result=await installedVersionManagement(installed,host,join(output,`operations-${round}.jsonl`));
  fs.writeFileSync(join(output,`result-${round}.json`),JSON.stringify(result,null,2));
  console.log(JSON.stringify({round,status:'pass',operations:result.operation_timings.length}));
 }catch(error){
  fs.writeFileSync(join(output,`failure-${round}.txt`),String(error));
  for(const cache of ['update-cache','empty-npm-cache']){
   const logs=join(installed.temporary,cache,'_logs');
   if(fs.existsSync(logs))for(const file of fs.readdirSync(logs))if(file.endsWith('.log'))fs.copyFileSync(join(logs,file),join(output,`${round}-${cache}-${file}`));
  }
  throw error;
 }finally{installed.cleanup();}
}
