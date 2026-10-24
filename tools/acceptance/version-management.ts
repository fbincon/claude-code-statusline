import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join,dirname,delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn,spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { npmEntry,readTar } from '../build/files.js';
import { LEGACY_370_SHA256 } from '@fbincon/statusline-core/management/compatibility';
import type { installCandidate } from './install.js';
type Input=Pick<ReturnType<typeof installCandidate>,'temporary'|'node'|'root'|'entry'|'env'> & {artifact:string;npm:string;legacy:string;legacyManifest:any};
export async function installedVersionManagement(installed:ReturnType<typeof installCandidate>):Promise<Record<string,unknown>>{
    const legacy=join(installed.temporary,'historical-3.7.0.tgz');
    if(process.env.TS06_LEGACY_370_ARTIFACT)fs.copyFileSync(process.env.TS06_LEGACY_370_ARTIFACT,legacy);
    else{
        const response=await fetch('https://registry.npmjs.org/@fbincon/claude-code-statusline/-/claude-code-statusline-3.7.0.tgz',{signal:AbortSignal.timeout(60000)});
        assert(response.ok,'Cannot download the fixed historical release');
        const bytes=Buffer.from(await response.arrayBuffer());assert(bytes.length<64*1024*1024);fs.writeFileSync(legacy,bytes);
    }
    assert.equal(createHash('sha256').update(fs.readFileSync(legacy)).digest('hex'),LEGACY_370_SHA256);
    const input:Input={temporary:installed.temporary,node:installed.node,root:installed.root,entry:installed.entry,env:installed.env,artifact:installed.packed.tarball,npm:npmEntry(),legacy,legacyManifest:JSON.parse(readTar(legacy).get('package.json')!.toString('utf8'))};
    const program=`import {versionManagementChild} from ${JSON.stringify(import.meta.url)};console.log(JSON.stringify(await versionManagementChild(JSON.parse(process.argv[1]))));`;
    const result=spawnSync(installed.node,['--input-type=module','-e',program,JSON.stringify(input)],{cwd:installed.directory,encoding:'utf8',timeout:420000,windowsHide:true,maxBuffer:8*1024*1024});
    assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr+result.stdout);return JSON.parse(result.stdout);
}
export async function versionManagementChild(input:Input):Promise<Record<string,unknown>>{
    const manifest=JSON.parse(fs.readFileSync(join(input.root,'package.json'),'utf8')),targetVersion=manifest.version;
    assert.equal(targetVersion,'3.8.0','Update acceptance requires the planned exact target');
    const targetBytes=fs.readFileSync(input.artifact),legacyBytes=fs.readFileSync(input.legacy);
    const sri=(bytes:Buffer)=>'sha512-'+createHash('sha512').update(bytes).digest('base64');
    let registry='',badIntegrity=false;
    const server=createServer((request,response)=>{
        if(request.url==='/target.tgz' || request.url==='/legacy.tgz'){response.end(request.url==='/target.tgz'?targetBytes:legacyBytes);return;}
        if(decodeURIComponent(request.url??'').replace(/\/$/u,'')!=='/@fbincon/claude-code-statusline'){response.statusCode=404;response.end('{}');return;}
        const target={...manifest,dist:{tarball:registry+'target.tgz',integrity:badIntegrity?'sha512-'+Buffer.alloc(64).toString('base64'):sri(targetBytes)}};
        response.setHeader('content-type','application/json');response.end(JSON.stringify({name:manifest.name,'dist-tags':{latest:targetVersion},versions:{
            [targetVersion]:target,'3.7.0':{...input.legacyManifest,dist:{tarball:registry+'legacy.tgz',integrity:sri(legacyBytes)}},
            '3.9.0':{...target,version:'3.9.0',statuslineCompatibility:{...manifest.statuslineCompatibility,node:{'26':'26.0.0'}}},
        }}));
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));registry='http://127.0.0.1:'+(server.address() as {port:number}).port+'/';
    const prefix=join(input.temporary,'update prefix 中文'),configDir=join(input.temporary,'update-config'),hostBin=join(input.temporary,'version-only-host'),root=join(prefix,process.platform==='win32'?'node_modules':'lib/node_modules',manifest.name),entry=join(root,'node_modules/@fbincon/statusline-cli/dist/src/entry.js');
    fs.mkdirSync(hostBin);const hostRoot=join(hostBin,'node_modules/@anthropic-ai/claude-code');fs.mkdirSync(hostRoot,{recursive:true});
    fs.writeFileSync(join(hostRoot,'package.json'),JSON.stringify({bin:{claude:'cli.js'}}));
    const hostSource="#!/usr/bin/env node\nif(process.argv[2]!=='--version')process.exit(2);console.log('2.1.258 (version-only acceptance fixture)');\n";
    fs.writeFileSync(join(hostRoot,'cli.js'),hostSource);
    if(process.platform==='win32')fs.writeFileSync(join(hostBin,'claude.cmd'),'@echo off\r\n');else{fs.writeFileSync(join(hostBin,'claude'),hostSource);fs.chmodSync(join(hostBin,'claude'),0o700);}
    const userconfig=join(input.temporary,'update-user-npmrc'),globalconfig=join(input.temporary,'update-global-npmrc');fs.writeFileSync(userconfig,'');fs.writeFileSync(globalconfig,'');
    const env={...input.env,PATH:hostBin+delimiter+input.env.PATH,npm_execpath:input.npm,npm_config_registry:registry,npm_config_userconfig:userconfig,npm_config_globalconfig:globalconfig,npm_config_cache:join(input.temporary,'update-cache'),npm_config_prefer_online:'true',CLAUDE_CONFIG_DIR:configDir};
    const invoke=(args:string[],success=true)=>new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
        const child=spawn(input.node,args,{cwd:input.temporary,env,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
        const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Installed version operation timed out'));},150000);
        child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.stdin.end();
        child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);try{if(success)assert.equal(code,0,stderr+stdout);resolve({code,stdout,stderr});}catch(error){reject(error);}});
    });
    const command=(launch:string,action:string,version:string,extra:string[]=[])=>[launch,action,'--version',version,'--prefix',prefix,'--config-dir',configDir,'--yes',...extra];
    const version=async()=>{const result=await invoke([entry,'--version']);return result.stdout.trim();};
    const state=()=>JSON.parse(fs.readFileSync(join(configDir,'statusline_runtime/installation.json'),'utf8'));
    try{
        await invoke([input.npm,'install','--global','--prefix',prefix,'--offline','--ignore-scripts','--bin-links=true',input.legacy]);
        await invoke([entry,'install','--config-dir',configDir,'--no-native-editor','--no-experimental-slash-tui','--no-native-timing','--no-live-metrics']);
        await invoke([entry,'config','--config-dir',configDir,'set','colors','on']);
        await invoke([entry,'config','--config-dir',configDir,'profile','save','Before upgrade','--bind',input.temporary]);
        const display=fs.readFileSync(join(configDir,'claude-statusline.json')),profiles=fs.readFileSync(join(configDir,'claude-statusline-profiles.json'));
        const settingsPath=join(configDir,'settings.json'),settings=JSON.parse(fs.readFileSync(settingsPath,'utf8'));settings.env={KEEP:'unchanged'};fs.writeFileSync(settingsPath,JSON.stringify(settings),{mode:0o600});
        badIntegrity=true;
        const corrupt=await invoke(command(input.entry,'update',targetVersion),false);assert.equal(corrupt.code,2);assert.match(corrupt.stderr,/integrity/);assert.equal(await version(),'claude-statusline 3.7.0');badIntegrity=false;
        const incompatible=await invoke(command(input.entry,'update','3.9.0'),false);assert.equal(incompatible.code,2);assert.equal(await version(),'claude-statusline 3.7.0');
        const checked=await invoke([input.entry,'update','--check','--json','--prefix',prefix,'--config-dir',configDir]);assert.equal(JSON.parse(checked.stdout).target,targetVersion);
        await invoke(command(input.entry,'update',targetVersion));assert.equal(await version(),'claude-statusline '+targetVersion);assert.equal(state().backend_version,targetVersion);assert.equal(state().launch.args[0],entry);
        assert.deepEqual(fs.readFileSync(join(configDir,'claude-statusline.json')),display);assert.deepEqual(fs.readFileSync(join(configDir,'claude-statusline-profiles.json')),profiles);
        // This invocation starts in the directory that npm replaces. It must
        // leave that package before loading Koffi or Windows cannot replace it.
        await invoke(command(entry,'rollback','3.7.0'));assert.equal(await version(),'claude-statusline 3.7.0');assert.equal(state().backend_version,'3.7.0');
        assert.deepEqual(fs.readFileSync(join(configDir,'claude-statusline-profiles.json')),profiles);
        const historyRoot=join(configDir,'statusline_runtime/package-management/installations');const history=JSON.parse(fs.readFileSync(join(historyRoot,fs.readdirSync(historyRoot)[0]!),'utf8'));
        const recoveryRoot=join(configDir,'statusline_runtime/package-management/transactions',history.transaction,'recovery-runner'),recoveryEntry=join(recoveryRoot,'bin/claude-statusline.js');assert(fs.existsSync(recoveryEntry));
        const serviceURL=pathToFileURL(join(recoveryRoot,'node_modules/@fbincon/statusline-cli/dist/src/management/service.js')).href;
        const crash=`import {manage} from ${JSON.stringify(serviceURL)};await manage(${JSON.stringify(command(recoveryEntry,'update',targetVersion).slice(1))},{origin:${JSON.stringify(recoveryRoot)},stdout:s=>process.stdout.write(s),stderr:s=>process.stderr.write(s),checkpoint:stage=>{if(stage==='package_verified')process.kill(process.pid,'SIGKILL');}});`;
        const stopped=await invoke(['--input-type=module','-e',crash],false);assert.notEqual(stopped.code,0);assert.equal(await version(),'claude-statusline '+targetVersion);
        const markerPath=join(prefix,'.claude-statusline-operation.json'),marker=JSON.parse(fs.readFileSync(markerPath,'utf8'));const stamp=fs.statSync(entry).mtimeMs;
        await invoke(command(entry,'recover',targetVersion,['--package']));assert(!fs.existsSync(markerPath));assert.equal(fs.statSync(entry).mtimeMs,stamp);assert.equal(state().backend_version,targetVersion);
        await invoke([entry,'config','--config-dir',configDir,'set','colors','off']);
        await invoke([entry,'recover','--restore-config',marker.id,'--prefix',prefix,'--config-dir',configDir,'--yes']);
        assert.deepEqual(fs.readFileSync(join(configDir,'claude-statusline.json')),display);assert.deepEqual(fs.readFileSync(join(configDir,'claude-statusline-profiles.json')),profiles);
        assert.equal(JSON.parse(fs.readFileSync(join(configDir,'claude-statusline-native.json'),'utf8')).native_editor,false);assert.equal(JSON.parse(fs.readFileSync(settingsPath,'utf8')).env.KEEP,'unchanged');
        const render=await new Promise<string>((resolve,reject)=>{const child=spawn(input.node,[entry,'render'],{cwd:input.temporary,env,windowsHide:true,stdio:['pipe','pipe','pipe']});let text='';child.stdout.on('data',b=>text+=b);child.once('error',reject);child.once('exit',code=>code===0?resolve(text):reject(new Error('Render failed')));child.stdin.end(JSON.stringify({model:{display_name:'After version recovery'}}));});assert(render.includes('After version recovery'));
        return {cases:7,historical_version:'3.7.0',historical_sha256:LEGACY_370_SHA256,target_version:targetVersion,roundtrip:true,independent_runner:true,crash_recovery:true,configuration_restore:true,real_npm:true,registry:'controlled-loopback',host:'version-only-2.1.258',model_calls:0};
    }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
