/** Installed product samples and actual wizard PTYs; no actual session or paid calls. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { installCandidate } from './install.js';
import { verifyDelivery } from '../build/verify.js';
import { sha256 } from '../build/files.js';
import { sourceHashes } from '../migration/ts-03/common.js';
import { openPty } from '../migration/ts-04/test/pty.js';
import { Capture } from '../migration/ts-04/capture.js';
import { renderCapture } from './render-capture.js';
import { LANGUAGES, t } from '@fbincon/statusline-core/i18n/messages';

const { values } = parseArgs({ options: { artifact:{type:'string'},commit:{type:'string'},output:{type:'string'},font:{type:'string',multiple:true} } });
if(!values.artifact||!values.commit||!values.output||!values.font?.length) throw new Error('Require --artifact TGZ --commit SHA --output NEW_DIRECTORY --font FILE');
if(process.platform==='win32') throw new Error('POSIX capture; Windows setup journeys use the installed console gate');
const artifact=verifyDelivery(resolve(values.artifact),values.commit);
assert.deepEqual(artifact.source.source_hashes,sourceHashes(),'Capture source differs from artifact');
const output=resolve(values.output),fonts=values.font.map(path=>resolve(path));fs.mkdirSync(output);
const installed=installCandidate(values.artifact,values.commit),records:Record<string,unknown>[]=[];
function capture(name:string,raw:Buffer,columns:number,rows:number,metadata:Record<string,unknown>) {
    const cells=new Capture(columns,rows);cells.feed(raw);
    const light=metadata.theme==='light',data={columns,rows,cells:cells.buffer,terminal_foreground:light?'#17191e':'#dedee7',terminal_background:light?'#ffffff':'#17191e'};
    const rendered=renderCapture(data,[0,0,columns,rows],fonts);
    fs.writeFileSync(join(output,name+'.ansi'),raw);fs.writeFileSync(join(output,name+'.json'),JSON.stringify(data));fs.writeFileSync(join(output,name+'.png'),rendered.png);
    records.push({name,...metadata,columns,rows,ansi_sha256:sha256(raw),png_sha256:sha256(rendered.png)});
}
try {
    const driver=join(installed.temporary,'scheme-capture.mjs'),samples=join(output,'samples.json');
    fs.copyFileSync(fileURLToPath(new URL('./setup-appearance-driver.js',import.meta.url)),driver);
    execFileSync(installed.node,[driver,installed.modules,samples],{cwd:installed.temporary,env:installed.env,timeout:120000});
    for(const sample of JSON.parse(fs.readFileSync(samples,'utf8'))) {
        const {main,subagents,...metadata}=sample,lines=[...main,...subagents];
        capture([sample.scheme,sample.language,sample.width,sample.theme,sample.scenario,sample.decorated?'powerline':'compact'].join('-'),Buffer.from(lines.join('\r\n')),sample.width,Math.max(1,lines.length),{...metadata,kind:'fixed sample through installed production renderer'});
    }
    const wizard=join(installed.temporary,'setup-capture.mjs');
    fs.writeFileSync(wizard,`import {pathToFileURL} from 'node:url';\nconst [entry,config,language]=process.argv.slice(2);\nconst {main}=await import(pathToFileURL(entry));\nprocess.exitCode=await main(['--language',language,'setup','--config-dir',config],{hostVersion:()=>[2,1,258]});\n`);
    for(const language of LANGUAGES) {
        const config=join(installed.temporary,'wizard-'+language);fs.mkdirSync(config);
        fs.writeFileSync(join(config,'claude-statusline-native.json'),'{"schema_version":1,"native_editor":false}');
        fs.writeFileSync(join(config,'claude-statusline-features.json'),'{"schema_version":1,"experimental_slash_tui":false}');
        const original=fs.readdirSync(config).sort();
        const pty=openPty(config,120,32,installed.env,language,{executable:installed.node,args:[wizard,join(installed.modules,'statusline-cli/dist/src/main.js'),config,language],cwd:installed.temporary});
        try {
            const key=async(bytes:string,label:string)=>{const start=pty.captured().length;pty.send(bytes);await pty.wait(text=>Buffer.byteLength(text)>start&&text.slice(text.lastIndexOf('\x1b[H')).includes(label));};
            const save = (page: string) => {
                const raw = pty.captured(), frame = raw.subarray(raw.lastIndexOf(Buffer.from('\x1b[H')));
                capture('setup-' + language + '-' + page, frame, 120, 32, {
                    language, page, theme: 'dark', kind: 'installed setup PTY', host_version: 'synthetic 2.1.258', sample: true,
                });
            };
            await pty.wait(text=>text.includes(t('setup.checks',language)));save('checks');
            await key('\r',t('setup.choice',language));save('choice');
            await key('\r',t('quick.purpose.daily-development',language));save('scenario');
            await key('\r',t('fields.global.theme.label',language));save('appearance');
            await key('\x1b[F\r',t('setup.review',language));save('review');
            pty.send('\x1b');await pty.exited();assert.equal(pty.child.exitCode,0);assert.deepEqual(pty.attributes(),pty.before);
            assert.deepEqual(fs.readdirSync(config).sort(),original,'Cancelled wizard wrote files');
        } finally {await pty.close();}
    }
    fs.writeFileSync(join(output,'receipt.json'),JSON.stringify({status:'pass',version:artifact.source.application_version,commit:values.commit,tarball_sha256:artifact.sha256,
        kind:'fixed samples and PTY terminal-cell reconstructions; not desktop or human acceptance',model_calls:0,records,
        fonts:Object.fromEntries(fonts.map(path=>[path,sha256(fs.readFileSync(path))]))},null,2)+'\n');
    console.log(JSON.stringify({status:'pass',captures:records.length,output}));
} finally {installed.cleanup();}
