/** Move persistent interactive editors away from native files npm may replace. */
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { productRoot, productIdentity } from '@fbincon/statusline-platform/npm';
import { copyPackage } from '@fbincon/statusline-platform/package-copy';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
export async function independentEditor(argv:readonly string[]):Promise<number|null>{
    const root=productRoot(fileURLToPath(import.meta.url));if(!root||!productIdentity(root))return null;
    const folder=fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(),'claude-statusline-editor-')));fs.chmodSync(folder,0o700);
    try{
        const runner=join(folder,'runner');copyPackage(root,runner);
        return await new Promise<number>((resolve,reject)=>{
            const child=spawn(process.execPath,[join(runner,'node_modules/@fbincon/statusline-cli/dist/src/integration/editor-worker-entry.js'),join(root,'node_modules/@fbincon/statusline-cli/dist/src/entry.js'),JSON.stringify(argv)],{stdio:'inherit',shell:false,env:process.env,cwd:process.cwd()});
            const stop=()=>child.kill('SIGTERM'),resize=()=>child.kill('SIGWINCH');process.on('SIGTERM',stop);if(process.platform!=='win32')process.on('SIGWINCH',resize);
            const detach=()=>{process.off('SIGTERM',stop);process.off('SIGWINCH',resize);};
            child.once('error',error=>{detach();reject(error);});child.once('exit',(code,signal)=>{detach();resolve(code??(signal?130:2));});
        });
    }finally{removeTree(folder);}
}
