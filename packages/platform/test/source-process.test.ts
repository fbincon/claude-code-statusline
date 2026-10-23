import test from 'node:test';
import assert from 'node:assert/strict';
import { runSourceProcess, sourceEnvironment } from '../src/source-process.js';
test('POSIX executable text cannot silently fall back to a shell',{skip:process.platform==='win32'},async t=>{
    const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
    const {tmpdir}=await import('node:os'),{join}=await import('node:path');
    const root=mkdtempSync(join(tmpdir(),'source interpreter '));t.after(()=>rmSync(root,{recursive:true,force:true}));
    const file=join(root,'plain executable');writeFileSync(file,"printf 'explicit interpreter only'\n",{mode:0o700});
    const options={executable:file,args:[],cwd:root,input:'',timeoutMs:5000};
    const rejected=await runSourceProcess(options);assert.equal(rejected.reason,'exit');assert.equal(rejected.stdout,'');
    const explicit=await runSourceProcess({...options,executable:'/bin/sh',args:[file],environment:{...sourceEnvironment(),NODE_OPTIONS:'--not-a-node-flag'}});
    assert.equal(explicit.reason,'completed');assert.equal(explicit.stdout,'explicit interpreter only');
});
test('source lookup uses the selected PATH including Windows mixed-case names',async()=>{
    const {basename,dirname}=await import('node:path');
    const environment=Object.fromEntries(Object.entries(sourceEnvironment()).filter(([key])=>key.toUpperCase()!=='PATH'));
    environment[process.platform==='win32'?'Path':'PATH']=dirname(process.execPath);
    const result=await runSourceProcess({executable:basename(process.execPath),args:['-p','String(42)'],cwd:process.cwd(),input:'',timeoutMs:15000,environment});
    assert.equal(result.reason,'completed');assert.equal(result.stdout.trim(),'42');
});
test('source processes pass literal Unicode arguments and omit credential environments',async()=>{
    const values=['中文 path','a"b','$(no execution)','`literal`','a&b','trailing\\'];
    const result=await runSourceProcess({executable:process.execPath,args:['-e','process.stdout.write(JSON.stringify({args:process.argv.slice(1),token:process.env.ANTHROPIC_API_KEY,home:process.env.HOME,profile:process.env.USERPROFILE,input:require("fs").readFileSync(0,"utf8")}))',...values],cwd:process.cwd(),input:'{"project":"中文"}\n',timeoutMs:15000,environment:sourceEnvironment({...process.env,ANTHROPIC_API_KEY:'must-not-pass',HOME:'literal isolated home',USERPROFILE:'literal isolated profile'})});
    assert.equal(result.reason,'completed');const parsed=JSON.parse(result.stdout);assert.deepEqual(parsed.args,values);assert.equal(parsed.token,undefined);assert.equal(parsed.home,'literal isolated home');assert.equal(parsed.profile,'literal isolated profile');assert.equal(parsed.input,'{"project":"中文"}\n');
});
test('deadline, cancellation, output limits and ordinary failure remain distinct',async()=>{
    const run=(script:string,extra={})=>runSourceProcess({executable:process.execPath,args:['-e',script],cwd:process.cwd(),input:'',timeoutMs:5000,...extra});
    assert.equal((await run('process.exit(2)')).reason,'exit');
    assert.equal((await run('process.stdout.write("x".repeat(1100000))')).reason,'output_limit');
    assert.equal((await run('process.stdout.write(Buffer.from([0xff]))')).reason,'invalid_output');
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

test('Windows bootstrap folder recovery does not change the selected command environment',async()=>{
    const {windowsSourceEnvironment}=await import('../src/windows-source-environment.js');
    const child={HOME:'C:/isolated',USERPROFILE:'C:/isolated',PATH:'C:/node-only',PSModulePath:'C:/wrong-version'};
    const bootstrap=windowsSourceEnvironment(child,{USERPROFILE:'C:/Users/loaded',APPDATA:'C:/Users/loaded/AppData/Roaming',LOCALAPPDATA:'C:/Users/loaded/AppData/Local',GH_TOKEN:'must-not-copy'});
    assert.equal(bootstrap.USERPROFILE,'C:/Users/loaded');assert.equal(bootstrap.HOME,undefined);
    assert.equal(bootstrap.PSModulePath,undefined);assert.equal(bootstrap.GH_TOKEN,undefined);assert.equal(bootstrap.PATH,child.PATH);
    assert.equal(child.HOME,'C:/isolated');assert.equal(child.USERPROFILE,'C:/isolated');
});

test('an explicitly selected PowerShell interpreter receives its Windows runtime folders',{skip:process.platform!=='win32'},async()=>{
    const {join}=await import('node:path');
    const result=await runSourceProcess({executable:join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),args:['-NoLogo','-NoProfile','-NonInteractive','-Command',"[Console]::Write('explicit interpreter')"],cwd:process.cwd(),input:'',timeoutMs:15000});
    assert.equal(result.reason,'completed');assert.equal(result.stdout,'explicit interpreter');
});
