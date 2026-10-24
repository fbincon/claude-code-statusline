// Diagnostic branch only. The fixture contains no real credentials.
import fs from 'node:fs';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const destination=process.env.STATUSLINE_DIAGNOSTIC_TRACE;
const clean=args=>args.includes('-e')?['<inline fixture program>']:args;
const trace=value=>{if(destination)fs.appendFileSync(destination,JSON.stringify({at:new Date().toISOString(),pid:process.pid,...value})+'\n');};
trace({phase:'node-start',argv:clean(process.argv.slice(1))});
const original=cp.spawn;
cp.spawn=function(executable,args,options){
 const started=performance.now();
 let launch;
 try{launch=JSON.parse(options?.env?.STATUSLINE_SOURCE_LAUNCH??'null');}catch{}
 const command={executable:launch?.executable??executable,args:clean(launch?.args??args??[]),supervised:!!launch};
 trace({phase:'spawn-start',...command});
 const child=original.call(this,executable,args,options);
 child.once('spawn',()=>trace({phase:'spawn-ready',child:child.pid,...command,elapsed_ms:performance.now()-started}));
 child.once('error',error=>trace({phase:'spawn-error',error:error.message,...command,elapsed_ms:performance.now()-started}));
 child.once('close',(code,signal)=>trace({phase:'spawn-close',child:child.pid,code,signal,...command,elapsed_ms:performance.now()-started}));
 return child;
};
syncBuiltinESMExports();
