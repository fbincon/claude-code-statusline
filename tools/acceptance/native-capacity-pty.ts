import { taskFixture } from './task-fixture.js';
/** Installed, real Claude PTYs for #154/#155; no model calls; one explicitly reviewed controlled-command journey. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { release } from 'node:os';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { installCandidate, officialEnvironment } from './install.js';
import { verifyDelivery } from '../build/verify.js';
import { sourceHashes } from '../migration/ts-03/common.js';
import { sha256 } from '../build/files.js';
import { nativeCapacityData } from '../generation/native-capacity.js';
import { openPty } from '../migration/ts-04/test/pty.js';
import { Capture } from '../migration/ts-04/capture.js';
import type { Draft } from '@fbincon/statusline-core/contracts/ui';
import { t } from '@fbincon/statusline-core/i18n/messages';

const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, output: { type: 'string' }, claude: { type: 'string', default: 'claude' } } });
if (!values.artifact || !values.commit || !values.output) throw new Error('Require --artifact TGZ --commit SHA --output NEW_DIRECTORY [--claude EXECUTABLE]');
if (process.platform !== 'linux') throw new Error('This receipt covers Linux PTYs only');
const artifact = verifyDelivery(resolve(values.artifact), values.commit);
assert.deepEqual(artifact.source.source_hashes, sourceHashes(), 'PTY collector differs from the candidate source');
const output = resolve(values.output); fs.mkdirSync(output);
const installed = installCandidate(values.artifact, values.commit), host = claudeLaunch(values.claude);
const versionRun = spawnSync(host.executable, [...host.args, '--version'], { encoding: 'utf8', timeout: 10000 });
const version = versionRun.stdout.match(/(\d+)\.(\d+)\.(\d+)/u)?.slice(1).map(Number);
assert(versionRun.status === 0 && version?.[2]! >= 289, 'An official host with both Mods is required');
const matrix = nativeCapacityData(), reports: Record<string, unknown>[] = [];
const project = join(installed.temporary, 'project 中文 &'), template = join(installed.temporary, 'template'), shim = join(installed.temporary, 'backend-entry.mjs');
fs.mkdirSync(project); fs.mkdirSync(template);
const main = pathToFileURL(join(installed.modules, 'statusline-cli/dist/src/main.js')).href;
fs.writeFileSync(shim, `import fs from 'node:fs';import path from 'node:path';import {main} from ${JSON.stringify(main)};const args=process.argv.slice(2);const raw=['ui','runtime','render','render-subagents','hook','slash-hook'].includes(args[0])?fs.readFileSync(0,'utf8'):'';let operation=null;try{operation=JSON.parse(raw).operation??null}catch{}const log=path.join(process.env.CLAUDE_CONFIG_DIR,'backend.jsonl');fs.appendFileSync(log,JSON.stringify({command:args[0],operation,phase:'request'})+'\\n');process.exitCode=await main(args,{launch:{executable:process.execPath,args:[${JSON.stringify(shim)}]},hostVersion:()=>${JSON.stringify(version)},stdin:()=>raw});fs.appendFileSync(log,JSON.stringify({command:args[0],operation,phase:'complete',status:process.exitCode})+'\\n');\n`);
const env = officialEnvironment(installed);
function command(executable: string, args: string[], environment = env, timeout = 180000) {
    const result = spawnSync(executable, args, { cwd: project, env: environment, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
    if (result.status !== 0 || result.error) throw new Error('Acceptance command failed: ' + JSON.stringify({ args, status: result.status, error: result.error?.message, stderr: result.stderr, stdout: result.stdout.slice(-3000) }));
    return result.stdout;
}
const record = (path: string, value: unknown) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
function caseData(name: string): any {
    const row = matrix.cases.find(row => row.name === name); assert(row, 'Unknown fixture ' + name);
    return Object.fromEntries(Object.entries(row.editor).map(([key, index]) => [key, structuredClone(matrix.values[index])]));
}
const failures = /props serializes to more than|a tree serializing to more than|too many nodes|too deep|a hook returned a tree that does not validate|instance unmounted|returned a tree that does not validate/u;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function runCase(name: string, fixtureName: string, action: string, external = false) {
    const directory = join(output, name); fs.mkdirSync(directory);
    const config = join(installed.temporary, name); fs.cpSync(template, config, { recursive: true });
    const data = caseData(fixtureName), draft = (fixtureName === 'import-four-gradients' ? data.review.result.draft : data.draft) as Draft;
    record(join(config, '.claude.json'), { hasCompletedOnboarding: true, theme: 'dark', projects: { [project]: { hasTrustDialogAccepted: true } } });
    record(join(config, 'claude-statusline.json'), draft.display);
    record(join(config, 'statusline-ui.json'), { schema_version: 1, ui_language: 'en' });
    if (data.profiles?.library) { const { revision: _, ...library } = data.profiles.library; record(join(config, 'claude-statusline-profiles.json'), library); }
    if (data.sources?.library) { const { revision: _, ...library } = data.sources.library; record(join(config, 'claude-statusline-sources.json'), library); }
    const importPath = join(config, 'identical-display.json'); record(importPath, draft.display);
    const diagnosticPath=join(config,'explicit input 中文.json');record(diagnosticPath,{session_id:'explicit-file',version:'2.1.310',model:{id:'File-input-model'},context_window:{used_percentage:95,remaining_percentage:5}});
    const taskEvidence=taskFixture(config,'task-pty');
    if(action==='live-command'){
        const spec=join(config,'controlled-command.json');record(spec,{name:'Controlled active-session command',kind:'command',scope:{project,session:null,agent:null},ttl_seconds:300,settings:{executable:installed.node,args:['-e','process.stdout.write("live-session-command")'],cwd:project,input:{session:'session'},output:'text',timeout_ms:5000}});
        const cli=(args:string[])=>command(installed.node,[installed.entry,'source','--config-dir',config,...args],{...env,CLAUDE_CONFIG_DIR:config});
        cli(['add','pty-command','--file',spec]);const review=JSON.parse(cli(['review','pty-command','--json'])).review_revision;
        cli(['enable','pty-command','--review',review]);cli(['auto-on','pty-command','--review',review,'--interval','300']);
    }
    const before = fs.readFileSync(join(config, 'claude-statusline.json'));
    fs.writeFileSync(join(config, 'backend.jsonl'), '');
    const hostLog = join(directory, 'host.log'), environment = { ...env, CLAUDE_CONFIG_DIR: config, COLORTERM: 'truecolor' };
    const columns = external ? 120 : 200; let rows = action === 'tall' ? 220 : external ? 32 : 50;
    const p = openPty(config, columns, rows, environment, 'en', external
        ? { executable: installed.node, args: [shim, 'configure', '--config-dir', config], cwd: project }
        : { executable: host.executable, args: [...host.args, '--debug-file', hostLog, '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'], cwd: project });
    let screen = new Capture(columns, rows), offset = 0, accepted = false;
    const steps: { name: string; elapsed_ms: number }[] = [], start = Date.now();
    const records = () => fs.readFileSync(join(config, 'backend.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    const completed = (operation: string) => records().some(row => row.operation === operation && row.phase === 'complete' && row.status === 0);
    const read = () => {
        const bytes = p.captured(), next = bytes.subarray(offset); offset = bytes.length; screen.feed(next);
        if (next.includes(Buffer.from('\x1b[6n'))) p.send('\x1b[1;1R');
        const text = screen.buffer.map(row => row.map(cell => cell.data).join('')).join('\n');
        if (!accepted && !external && text.includes('ANTHROPIC_API_KEY')) { p.send('\x1b[A\r'); accepted = true; }
        if (fs.existsSync(hostLog)) assert(!failures.test(fs.readFileSync(hostLog, 'utf8')), 'Host refused a presentation');
        return text;
    };
    const until = async (predicate: (text: string) => boolean, label: string, timeout = 15000) => {
        const stop = Date.now() + timeout;
        while (Date.now() < stop && p.child.exitCode === null) {
            if (predicate(read())) { steps.push({ name: label, elapsed_ms: Date.now() - start }); return; }
            await delay(50);
        }
        throw new Error('PTY condition failed: ' + label + '\n' + read().slice(-3000));
    };
    const key = async (bytes: string, label: string) => { p.send(bytes); await delay(180); read(); steps.push({ name: label, elapsed_ms: Date.now() - start }); };
    const capture = (label: string) => { read(); record(join(directory, label + '.cells.json'), { columns, rows, cells: screen.buffer, terminal_foreground: '#dedee7', terminal_background: '#17191e' }); fs.writeFileSync(join(directory, label + '.txt'), screen.buffer.map(row => row.map(cell => cell.data).join('')).join('\n')); };
    let status = 'fail', error: string | null = null;
    try {
        if (!external) {
            await until(text => text.includes('❯') && fs.existsSync(hostLog) && fs.readFileSync(hostLog, 'utf8').includes('$.command.register (statusline-native): /statusline-configure-native listed'), 'host command ready', 30000);
            await key('/statusline-configure-native\r', 'open native command');
        }
        await until(text => text.includes('Configure Status Line') && text.includes('[x]') && (external || completed('preview')), 'main and preview visible');
        if (!external) {
            let clicked = false;
            for (let y = 0; y < screen.buffer.length && !clicked; y++) {
                const row = screen.buffer[y]!, x = row.findIndex((cell, i) => cell.data === '[' && row[i + 1]?.data === 'x' && row[i + 2]?.data === ']');
                if (x >= 0) { await key(`\x1b[<0;${x + 2};${y + 1}M\x1b[<0;${x + 2};${y + 1}m`, 'focus Client'); clicked = true; }
            }
            assert(clicked, 'No observed Client item to focus');
        }
        capture('before');
        if(['version-status','package-cleanup','external-task'].includes(action)) {
            await key(external?'\x04':'d','unsaved copy');
            await key(external?'\t\t':'3','settings');await key('\x1b[H','first setting');
            const label=action==='version-status'?'Version and installation':'Task details';
            for(let i=0;i<90&&!read().split('\n').some(line=>line.includes('›')&&line.includes(label));i++)await key('\x1b[B','select read-only entry');
            await until(text=>text.split('\n').some(line=>line.includes('›')&&line.includes(label)),'read-only entry selected');
            await key('\r','open read-only view');
            if(action==='external-task'){
                await key('task-pty\r','read explicit task');await until(text=>text.includes('captured-task'),'task identity visible');
                await key('/agent-alpha\r','search agent');await key('e','show evidence');await key('r','manual refresh');
                await until(text=>text.includes('captured-task'),'task retained');capture('after');await key('q','return to editor');
                assert.deepEqual(fs.readFileSync(taskEvidence.path),taskEvidence.bytes);
            }else{
                await until(text=>text.includes('Local status'),'local status boundary visible');
                if(action==='package-cleanup'){
                    await key('\x1b[H','first package row');for(let i=0;i<50&&!read().split('\n').some(line=>line.includes('›')&&line.includes(t('package.ui.cleanup_review','en')));i++)await key('\x1b[B','find cleanup');
                    await key('\r','review local cleanup');await until(()=>completed('package_cleanup_review'),'cleanup read completed');capture('after');await key('q','return from cleanup');
                }else capture('after');await key('q','return to editor');
                assert(!records().some(row=>row.operation==='package_review_start'),'Page entry started a network review');
            }
            await until(text=>text.includes('Configure Status Line *'),'unsaved draft retained');
        } else if(action==='live-command'){
            const jobs=()=>{const folder=join(config,'statusline_runtime/sources/jobs');return fs.existsSync(folder)?fs.readdirSync(folder).filter(name=>name.endsWith('.json')).map(name=>JSON.parse(fs.readFileSync(join(folder,name),'utf8'))).filter(job=>job.source_id==='pty-command'):[];};
            await until(()=>jobs().some(job=>job.state==='completed'),'actual runtime lease dispatched the controlled command',25000);
            const observed=jobs();assert.equal(observed.length,1);assert.equal(observed[0].result.summary,'live-session-command');assert.equal(observed[0].result.exit_code,0);assert.equal(typeof observed[0].context.session,'string');
            await key('\x19','show controlled source');await until(text=>text.includes('Controlled active-session command'),'controlled source visible');await key('\r','controlled source actions');await key('\x1b[B'.repeat(7)+'\r','read execution summary');await until(()=>completed('source_inspect'),'saved controlled result read');capture('after');await key('\x07','return to source library');await key('\x07','return to retained editor');
        } else if(action==='native-task'){
            await key('q','close configuration');await until(text=>!text.includes('Configure Status Line'),'configuration closed');
            await key('/statusline-task\r','open native task');await until(text=>/Session: [^\s]+/u.test(text),'session identity visible');
            const session=read().match(/Session: ([a-zA-Z0-9-]+)/u)?.[1];assert(session,'Missing observed session');const evidence=taskFixture(config,session);
            await key('r','read published task');await until(text=>text.includes('captured-task'),'native task report visible');capture('after');
            assert.deepEqual(fs.readFileSync(evidence.path),evidence.bytes);
        } else if(action==='colors') {
            await key(external?'\t\t':'3','settings');await key('\x1b[H','first setting');
            for(let i=0;i<80&&!/›.*Statusline theme/u.test(read());i++)await key('\x1b[B','find theme');
            await until(text=>/›.*Statusline theme/u.test(text),'theme selected');await key('\r','open color selector');
            await until(text=>text.includes('Colors and gradients'),'color selector visible');
            await key('\x1b[B'.repeat(4)+'\r','preview ocean theme');await until(text=>text.includes('Ocean'),'new theme candidate visible');capture('after');await key('\x07','cancel candidate');
        } else if(action==='scenarios') {
            await key('\x16','warning sample');await until(text=>text.includes('Warning'),'sample identity visible');
            await key('\x17','40-column sample');await until(text=>text.includes('40c'),'sample width visible');capture('after');
        } else if(action==='diagnose-file') {
            await key('\x0c','open file diagnosis');await until(text=>text.includes('Diagnose input file'),'file form visible');
            await key('\r','edit file path');await key(diagnosticPath,'insert explicit input path');await key('\r','accept path');
            await key('\x1b[B'.repeat(4)+'\r','diagnose input only');await until(text=>(external||completed('diagnose_file'))&&text.includes('File diagnosis output')&&text.includes('File-input-model')&&text.includes('Evidence: supplied input only'),'file result visible');capture('after');
            await key('\x07','back to form');await key('\x07','back to retained editor');
        } else if (action === 'quick') {
            await key('\x10', 'quick setup'); await until(text => text.includes(t('quick.title', 'en')) && text.includes(t('quick.scenario', 'en')), 'quick setup visible');
            await key('\r', 'choose scenario'); await until(text => /appearance/iu.test(text), 'candidate appearance visible'); capture('after');
            await key(external ? '\x1b' : '\x07', 'cancel quick setup');
        } else if (action === 'import') {
            await key(external ? '\t\t' : '3', 'settings'); await key('\x1b[F', 'last setting');
            for (let i = 0; i < 8 && !/›.*Import file/u.test(read()); i++) await key('\x1b[A', 'find import setting');
            await until(text => /›.*Import file/u.test(text), 'import field selected');
            await key('\r', 'edit import path'); await key('\x15', 'clear path'); await key(importPath, 'insert literal path'); await key('\r', 'review import');
            await until(text => /no (changes|differences)/iu.test(text), 'identical import review visible'); capture('after');
            await key('\x07', 'cancel import');
        } else if (action === 'profiles' || action === 'profile-actions') {
            await key('\x0f', 'profile library'); await until(text => text.includes('Capacity profile 0'), 'profile list visible');
            if (action === 'profile-actions') { await key('\x1b[B', 'select profile'); await key('\r', 'profile actions'); await until(text => text.includes('Edit') || text.includes('Activate'), 'profile actions visible'); }
            capture('after');
            await key(external ? '\x1b' : '\x07', 'cancel profile page');
            if (action === 'profile-actions') await key(external ? '\x1b' : '\x07', 'cancel library');
        } else if (['sources','source-review','source-inspect','source-bindings'].includes(action)) {
            await key('\x19', 'source library'); await until(text => text.includes('Local sample 0'), 'source list visible');
            if (action === 'source-review') { await key('\r', 'source actions'); await key('\x1b[B', 'select review'); await key('\r', 'review disabled command'); await until(text => completed('source_review') && text.includes('Review all fields'), 'source review completed'); }
            if(action==='source-inspect'){await key('\r','source actions');await key('\x1b[B'.repeat(6)+'\r','inspect saved source');await until(()=>completed('source_inspect'),'readable source inspection');}
            if(action==='source-bindings'){await key('\x1b[B'.repeat((data.sources?.library?.sources.length??0)+1)+'\r','binding inventory');await until(()=>completed('source_bindings_review'),'bindings read completed');}
            capture('after'); await key('\x07', 'cancel source page');
            if (['source-review','source-inspect','source-bindings'].includes(action)) await key('\x07', 'cancel source library');
        } else if (action === 'save') {
            for (let i = 0; i < 14; i++) await key('d', 'copy ' + (i + 1));
            await key('s', 'save 24 instances'); await until(text => completed('apply') && /saved/iu.test(text), 'save outcome visible');
            assert.equal(JSON.parse(fs.readFileSync(join(config, 'claude-statusline.json'), 'utf8')).instances.length, 24);
            assert.equal(records().filter(row => row.operation === 'apply' && row.phase === 'request').length, 1); capture('after');
        } else if (action === 'explain') {
            await key('\x05', 'item format'); await key('\x1b[H', 'explanation setting'); await key('\r', 'open explanation');
            await until(text => text.includes('Configuration and sample explanation') && completed('explain'), 'explanation result visible'); capture('after');
            await key('\x07', 'back from explanation'); await key('\x07', 'back from format');
        } else if (action === 'tall') {
            await key('d', 'unsaved copy before resize'); capture('after');
            rows = 50; offset = p.captured().length; screen = new Capture(columns, rows); p.resize(columns, rows);
            await until(text => text.includes('Configure Status Line *') && text.includes('Preview'), 'draft retained after safe resize'); capture('resized');
        } else { await key('2', 'subagent page'); await key('1', 'main page'); capture('after'); }
        if (external) { p.send('\x1b'); await p.exited(); assert.equal(p.child.exitCode, 0); assert.deepEqual(p.attributes(), p.before); }
        else { await key('q', 'close without another save'); await until(text => !text.includes(action==='native-task'?t('task.title','en'):'Configure Status Line'), 'pane closed'); }
        if (action !== 'save') assert.deepEqual(fs.readFileSync(join(config, 'claude-statusline.json')), before, 'Cancelled journey changed display configuration');
        assert(!records().some(row => row.operation === 'source_refresh'), 'A disabled source was executed');
        status = 'pass';
    } catch (failure) { error = String(failure); capture('failure'); }
    finally {
        fs.writeFileSync(join(directory, 'terminal.ansi'), p.captured());
        fs.copyFileSync(join(config, 'backend.jsonl'), join(directory, 'backend.jsonl'));
        try { process.kill(-p.child.pid!, 'SIGTERM'); } catch { /* Already ended. */ }
        await delay(100); try { process.kill(-p.child.pid!, 'SIGKILL'); } catch { /* Already ended. */ }
        await p.close();
        const report = { name, status, error, external, host: version!.join('.'), terminal_columns: columns, initial_rows: action === 'tall' ? 220 : external ? 32 : 50,
            model_calls: 0, source_commands: action==='live-command'?1:0, source_commit: artifact.source.commit, tarball_sha256: artifact.sha256, display_before_sha256: sha256(before),
            display_after_sha256: sha256(fs.readFileSync(join(config, 'claude-statusline.json'))), steps };
        record(join(directory, 'result.json'), report); reports.push(report); console.log(JSON.stringify({ name, status, error }));
    }
}
try {
    const request = join(installed.temporary, 'prepare.json'), driver = join(installed.temporary, 'prepare-host.mjs');
    record(request, { host, version, launch: { executable: installed.node, args: [shim] } });
    fs.copyFileSync(fileURLToPath(new URL('../migration/ts-04/test/installed-driver.js', import.meta.url)), driver);
    command(installed.node, [driver, installed.modules, 'prepare-host', template, join(installed.temporary, 'prepared.json'), request], { ...env, CLAUDE_CONFIG_DIR: template });
    for (const [name, fixture, action] of [
        ['quick-opening','plain-main-w72','quick'], ['import-identical','plain-main-w72','import'],
        ['profiles-two','profiles-list-2','profiles'], ['profiles-select-one','profiles-list-1','profile-actions'],
        ['sources-thirty','sources-list-30','sources'], ['source-review-command','sources-list-command-arg-4096','source-review'],
        ['disabled-main-extra-16','disabled-main-extra-16','pages'], ['save-after-copies','plain-main-w72','save'],
        ['background-gradient-2','background-gradient-2','pages'], ['agent-gradient-all','agent-gradient-all','pages'],
        ['gradient-text-128','gradient-text-128','pages'], ['tall-minimal','minimal-main','tall'],
        ['foreground-gradients','import-four-gradients','pages'], ['explanation','plain-main-w72','explain'],
        ['native-version-status','plain-main-w72','version-status'],['native-task-viewer','plain-main-w72','native-task'],
        ['theme-selector','plain-main-w72','colors'],['sample-scenarios','plain-main-w72','scenarios'],['input-file-diagnosis','plain-main-w72','diagnose-file'],
    ]) await runCase(name!, fixture!, action!);
    for (const [name, fixture, action] of [['external-quick','plain-main-w72','quick'], ['external-profiles','profiles-list-2','profiles'], ['external-import','plain-main-w72','import'],['external-colors','plain-main-w72','colors'],['external-scenarios','plain-main-w72','scenarios'],['external-file-diagnosis','plain-main-w72','diagnose-file'],['external-version-status','plain-main-w72','version-status'],['external-task-viewer','plain-main-w72','external-task']]) await runCase(name!, fixture!, action!, true);
    for(const external of [false,true])for(const [name,fixture,action]of [['source-summary','sources-list-30','source-inspect'],['source-bindings','sources-list-30','source-bindings'],['package-cleanup','plain-main-w72','package-cleanup']])await runCase((external?'external-':'native-')+name!,fixture!,action!,external);
    await runCase('native-live-command','plain-main-w72','live-command');
    assert.equal(reports.length, 34); assert(reports.every(report => report.status === 'pass'), 'Native or external PTY journey failed');
} catch (error) { console.error(String(error)); process.exitCode = 1; }
finally {
    record(join(output, 'report.json'), { status: reports.length === 34 && reports.every(row => row.status === 'pass') ? 'pass' : 'fail', commit: artifact.source.commit, tarball_sha256: artifact.sha256,
        platform: process.platform, arch: process.arch, os: release(), host: version?.join('.'), model_calls: 0, physical_visual_acceptance: false, journeys: reports });
    installed.cleanup();
}
