/** A flush handshake collects every hook event before the child exits. */
export function traceScript(main: string, args: string[], input: string): string {
  const loader = new URL('./trace-loader.js', import.meta.url).href;
  return `import {register} from 'node:module';
import {MessageChannel} from 'node:worker_threads';
const {port1,port2}=new MessageChannel(), modules=[];
port1.on('message',value=>{if(typeof value==='string')modules.push(value);});
register(${JSON.stringify(loader)},{parentURL:import.meta.url,data:{port:port2},transferList:[port2]});
const {main}=await import(${JSON.stringify(main)});
const status=await main(${JSON.stringify(args)},{stdin:()=>${JSON.stringify(input)}});
await new Promise(resolve=>{port1.on('message',value=>{if(value===null)resolve();});port1.postMessage(null);});
port1.close(); process.stderr.write(JSON.stringify({status,modules}));`;
}
