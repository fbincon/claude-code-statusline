import { manage } from './service.js';
const [origin,argv]=process.argv.slice(2);
process.exitCode=await manage(JSON.parse(argv!),{origin:origin!,stdout:text=>{process.stdout.write(text);},stderr:text=>{process.stderr.write(text);}});
