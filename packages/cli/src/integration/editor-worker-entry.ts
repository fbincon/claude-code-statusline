import { main } from '../main.js';
const [origin,argv]=process.argv.slice(2);
process.exitCode=await main(JSON.parse(argv!),{launch:{executable:process.execPath,args:[origin!]}});
