/** Install only registry bytes pinned by this Action's own lock. Reuse one completed installation per runner/job. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { dirname, join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url));
export function npmCli(environment=process.env, executable=process.execPath, platform=process.platform) {
    const windows=platform==='win32', executables=windows?['node.exe','npm.cmd']:['node','npm'];
    // A Windows worker has a case-sensitive copy of process.env. setup-node prepends to Path.
    const values=key=>Object.entries(environment).filter(([name,value])=>name.toLowerCase()===key&&value).map(([,value])=>value);
    const dirs=[dirname(executable),...values('path').flatMap(value=>value.split(windows?';':delimiter))];
    for(const dir of dirs){
        if(!dir)continue;
        const roots=[dir];
        for(const file of executables){
            let real;try{real=fs.realpathSync.native(join(dir,file));}catch{continue;}
            if(real.endsWith('npm-cli.js'))return real;roots.push(dirname(real));
        }
        for(const root of roots)for(const path of [join(root,'node_modules/npm/bin/npm-cli.js'),join(root,'../lib/node_modules/npm/bin/npm-cli.js')])
            if(fs.existsSync(path))return path;
    }
    const error=new Error('Pinned npm CLI unavailable');error.code='CI_NPM_CLI_MISSING';throw error;
}
export function bootstrap(temp=process.env.RUNNER_TEMP, cache=process.env.npm_config_cache) {
    assert(temp);const pkg=fs.readFileSync(join(here,'package.json')),lock=fs.readFileSync(join(here,'package-lock.json'));
    const key=createHash('sha256').update(pkg).update(lock).digest('hex');
    const root=join(temp,'statusline-transfer-sdk-'+process.platform+'-'+process.arch+'-'+key);
    const marker=join(root,'complete.json');
    if (fs.existsSync(marker)){
        assert(fs.lstatSync(root).isDirectory()&&fs.lstatSync(marker).isFile());
        assert.equal(fs.readFileSync(marker,'utf8'),key,'SDK cache lock mismatch');assert(fs.readFileSync(join(root,'package-lock.json')).equals(lock),'SDK cache lock mismatch');
        return {root,key,cached:true};
    }
    const files=JSON.parse(lock).packages, declared=JSON.parse(pkg).dependencies;
    for(const [name,entry] of Object.entries(files))if(name){
        assert(typeof entry.resolved==='string'&&entry.resolved.startsWith('https://registry.npmjs.org/')&&/^sha512-[A-Za-z0-9+/]+=*$/u.test(entry.integrity),
            'Artifact tool dependency has no pinned public integrity');
    }
    for(const [name,version] of Object.entries(declared))assert.equal(files['node_modules/'+name]?.version,version,'SDK dependency lock mismatch');
    const stage=fs.mkdtempSync(join(temp,'statusline-sdk-install-'));
    try {
        fs.writeFileSync(join(stage,'package.json'),pkg);fs.writeFileSync(join(stage,'package-lock.json'),lock);
        const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(?:PATH|HOME|USERPROFILE|TEMP|TMP|SystemRoot|WINDIR|ComSpec|PATHEXT|LOCALAPPDATA|APPDATA|HOMEDRIVE|HOMEPATH|ProgramData|ProgramFiles|HTTP_PROXY|HTTPS_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS)$/iu.test(k)));
        // Registry tarballs stay in npm's integrity-checked content cache. No runner or API token reaches npm.
        const cli=npmCli(),start=performance.now();
        let npmVersion='unknown';try{npmVersion=JSON.parse(fs.readFileSync(join(dirname(cli),'../package.json'),'utf8')).version;}catch{}
        try{
            execFileSync(process.execPath,[cli,...(cache?['--cache',cache]:[]),'ci','--ignore-scripts','--no-audit','--no-fund','--prefer-offline','--fetch-retries=1','--fetch-timeout=25000'],{
                cwd:stage,env,timeout:90_000,stdio:['ignore','pipe','pipe'],maxBuffer:1024*1024,windowsHide:true});
        }catch(cause){
            const integrity=/\bEINTEGRITY\b/u.test(String(cause.stderr??''));
            const error=new Error('Isolated npm installation failed');
            error.code=integrity?'CI_NPM_BAD_INTEGRITY':cause.code==='ETIMEDOUT'?'CI_NPM_INSTALL_TIMEOUT':'CI_NPM_INSTALL_FAILED';
            error.exitCode=cause.status;error.elapsedMs=Math.round(performance.now()-start);error.npmVersion=npmVersion;throw error;
        }
        fs.writeFileSync(join(stage,'complete.json'),key,{flag:'wx'});
        fs.renameSync(stage,root);
        return {root,key,cached:false};
    } finally {fs.rmSync(stage,{recursive:true,force:true,maxRetries:3});}
}
