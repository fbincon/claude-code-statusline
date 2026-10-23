import test from 'node:test';
import assert from 'node:assert/strict';
import { runSourceProcess, sourceEnvironment } from '../src/source-process.js';
test('source processes pass literal Unicode arguments and omit credential environments',async()=>{
    const values=['中文 path','a"b','$(no execution)','`literal`','a&b','trailing\\'];
    const result=await runSourceProcess({executable:process.execPath,args:['-e','process.stdout.write(JSON.stringify({args:process.argv.slice(1),token:process.env.ANTHROPIC_API_KEY,input:require("fs").readFileSync(0,"utf8")}))',...values],cwd:process.cwd(),input:'{"project":"中文"}\n',timeoutMs:15000,environment:sourceEnvironment({...process.env,ANTHROPIC_API_KEY:'must-not-pass'})});
    assert.equal(result.reason,'completed');const parsed=JSON.parse(result.stdout);assert.deepEqual(parsed.args,values);assert.equal(parsed.token,undefined);assert.equal(parsed.input,'{"project":"中文"}\n');
});
test('deadline, cancellation, output limits and ordinary failure remain distinct',async()=>{
    const run=(script:string,extra={})=>runSourceProcess({executable:process.execPath,args:['-e',script],cwd:process.cwd(),input:'',timeoutMs:5000,...extra});
    assert.equal((await run('process.exit(2)')).reason,'exit');
    assert.equal((await run('process.stdout.write("x".repeat(1100000))')).reason,'output_limit');
    assert.equal((await run('setInterval(()=>{},100)',{timeoutMs:100})).reason,'timeout');
    const controller=new AbortController(), pending=run('setInterval(()=>{},100)',{signal:controller.signal});setTimeout(()=>controller.abort(),100);
    assert.equal((await pending).reason,'cancelled');
});
test('descendants retaining pipes cannot outlive a completed source',async()=>{
    const result=await runSourceProcess({executable:process.execPath,args:['-e','const c=require("child_process").spawn(process.execPath,["-e","setInterval(()=>{},100)"],{stdio:["ignore","inherit","inherit"]});process.stdout.write(String(c.pid));c.unref()'],cwd:process.cwd(),input:'',timeoutMs:15000});
    assert.equal(result.reason,'completed');const pid=Number(result.stdout);assert(pid>0);
    if(process.platform==='win32')assert.throws(()=>process.kill(pid,0));
    // On Unix a killed orphan can briefly remain as a zombie; it cannot hold pipes.
});
