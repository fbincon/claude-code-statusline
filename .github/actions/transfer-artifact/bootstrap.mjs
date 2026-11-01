/** Install only registry bytes pinned by this Action's own lock. Reuse one completed installation per runner/job. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { dirname, join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url));
function npmCli() {
    const executables=process.platform==='win32'?['node.exe','npm.cmd']:['node','npm'];
    for(const dir of [dirname(process.execPath),...(process.env.PATH??'').split(delimiter)]){
        if(!dir)continue;
        for(const file of executables){
            let real;try{real=fs.realpathSync.native(join(dir,file));}catch{continue;}
            const home=dirname(real);
            for(const path of [real.endsWith('npm-cli.js')?real:'',join(home,'node_modules/npm/bin/npm-cli.js'),join(home,'../lib/node_modules/npm/bin/npm-cli.js')])
                if(path&&fs.existsSync(path))return path;
        }
    }
    throw new Error('Cannot locate npm CLI for the pinned artifact toolchain');
}
export function bootstrap(temp=process.env.RUNNER_TEMP, cache=process.env.npm_config_cache) {
    assert(temp);const pkg=fs.readFileSync(join(here,'package.json')),lock=fs.readFileSync(join(here,'package-lock.json'));
    const key=createHash('sha256').update(pkg).update(lock).digest('hex');
    const root=join(temp,'statusline-transfer-sdk-'+process.platform+'-'+process.arch+'-'+key);
    const marker=join(root,'complete.json');
    if (fs.existsSync(marker)){
        assert(fs.lstatSync(root).isDirectory()&&fs.lstatSync(marker).isFile());
        assert.equal(fs.readFileSync(marker,'utf8'),key);assert(fs.readFileSync(join(root,'package-lock.json')).equals(lock));
        return {root,key,cached:true};
    }
    const files=JSON.parse(lock).packages, declared=JSON.parse(pkg).dependencies;
    for(const [name,entry] of Object.entries(files))if(name){
        assert(typeof entry.resolved==='string'&&entry.resolved.startsWith('https://registry.npmjs.org/')&&/^sha512-[A-Za-z0-9+/]+=*$/u.test(entry.integrity),
            'Artifact tool dependency has no pinned public integrity');
    }
    for(const [name,version] of Object.entries(declared))assert.equal(files['node_modules/'+name]?.version,version);
    const stage=fs.mkdtempSync(join(temp,'statusline-sdk-install-'));
    try {
        fs.writeFileSync(join(stage,'package.json'),pkg);fs.writeFileSync(join(stage,'package-lock.json'),lock);
        const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(?:PATH|HOME|USERPROFILE|TEMP|TMP|SystemRoot|ComSpec|LOCALAPPDATA|APPDATA|HTTP_PROXY|HTTPS_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS)$/iu.test(k)));
        // Registry tarballs stay in npm's integrity-checked content cache. No runner or API token reaches npm.
        execFileSync(process.execPath,[npmCli(),...(cache?['--cache',cache]:[]),'ci','--ignore-scripts','--no-audit','--no-fund','--prefer-offline','--fetch-retries=1','--fetch-timeout=25000'],{
            cwd:stage,env,timeout:90_000,stdio:'ignore',windowsHide:true});
        fs.writeFileSync(join(stage,'complete.json'),key,{flag:'wx'});
        fs.renameSync(stage,root);
        return {root,key,cached:false};
    } finally {fs.rmSync(stage,{recursive:true,force:true,maxRetries:3});}
}
