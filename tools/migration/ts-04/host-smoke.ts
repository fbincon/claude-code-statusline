import * as fs from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { installCandidate, officialEnvironment } from './package.js';
import { openPty } from './test/pty.js';
import { Capture } from './capture.js';
if (process.platform === 'win32')
    throw new Error('This local host interaction probe uses the POSIX PTY; Windows has native console acceptance');
const reportPath = resolve(process.argv[2] ?? 'dist/validation/typescript-migration/ts-04/04-e/host-smoke.json');
fs.mkdirSync(dirname(reportPath), { recursive: true });
const f = installCandidate(), host = claudeLaunch(process.env.TS05_CLAUDE);
const hostVersion = spawnSync(host.executable, [...host.args, '--version'], { encoding: 'utf8', timeout: 10000 });
const version = hostVersion.status === 0 ? hostVersion.stdout.match(/(\d+)\.(\d+)\.(\d+)/u)?.slice(1).map(Number) : null;
const config = join(f.temporary, 'host-config'), project = join(f.temporary, 'project 中文 &'), receipt = join(f.temporary, 'backend.jsonl'), shim = join(f.temporary, 'backend-entry.mjs');
let p: ReturnType<typeof openPty> | undefined, report: Record<string, unknown> = { status: 'unverified', model_calls: 0 };
try {
    if (!version || version[2]! < 289)
        throw new Error('The free local host probe needs both supported Mods');
    fs.mkdirSync(config);
    fs.mkdirSync(project);
    fs.writeFileSync(join(config, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, theme: 'dark', projects: { [project]: { hasTrustDialogAccepted: true } } }));
    const main = pathToFileURL(join(f.modules, 'statusline-cli/dist/src/main.js')).href;
    fs.writeFileSync(shim, `import fs from 'node:fs';import {main} from ${JSON.stringify(main)};const args=process.argv.slice(2);const raw=['ui','runtime','render','render-subagents','hook','slash-hook'].includes(args[0])?fs.readFileSync(0,'utf8'):'';let operation=null;try{operation=JSON.parse(raw).operation??null}catch{}fs.appendFileSync(${JSON.stringify(receipt)},JSON.stringify({argv:args,operation,phase:'request'})+'\\n',{mode:0o600});process.exitCode=await main(args,{launch:{executable:process.execPath,args:[${JSON.stringify(shim)}]},hostVersion:()=>${JSON.stringify(version)},stdin:()=>raw});fs.appendFileSync(${JSON.stringify(receipt)},JSON.stringify({argv:args,operation,phase:'complete',status:process.exitCode})+'\\n',{mode:0o600});\n`);
    const request = join(f.temporary, 'host-request.json'), driver = join(f.temporary, 'prepare-host.mjs');
    fs.writeFileSync(request, JSON.stringify({ host, version, launch: { executable: f.node, args: [shim] } }));
    fs.copyFileSync(fileURLToPath(new URL('./test/installed-driver.js', import.meta.url)), driver);
    const env = { ...officialEnvironment(f), CLAUDE_CONFIG_DIR: config, HOME: f.temporary, USERPROFILE: f.temporary };
    delete (env as NodeJS.ProcessEnv).CLAUDECODE;
    const prepared = spawnSync(f.node, [driver, f.modules, 'prepare-host', config, join(f.temporary, 'prepared.json'), request], { cwd: project, env, encoding: 'utf8', timeout: 180000 });
    if (prepared.status !== 0)
        throw new Error(prepared.stderr);
    const sourceSpec = join(f.temporary, 'source-spec.json');
    fs.writeFileSync(sourceSpec, JSON.stringify({name:'Sample local source',kind:'json',settings:{path:join(project,'explicit.json')}}));
    const added = spawnSync(f.node,[shim,'source','add','sample','--file',sourceSpec],{cwd:project,env,encoding:'utf8',timeout:30000});
    if (added.status !== 0) throw new Error('Source fixture creation failed: '+added.stderr);
    p = openPty(config, 120, 36, env, 'en', { executable: host.executable, args: [...host.args, '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'], cwd: project });
    let offset = 0, confirmed = false, sent = false, manager = false, sourcesOpened = false, sourceReviewed = false, quickOpened = false, saved = false, taskOpened = false, taskRendered = false;
    const screen = new Capture(120, 36);
    let byteOffset = 0;
    const start = Date.now();
    let records: {
        argv: string[];
        operation: string | null;
        phase?: string;
        status?: number;
    }[] = [];
    while (Date.now() - start < 40000 && p.child.exitCode === null) {
        const bytes = p.captured(), output = bytes.toString('utf8'), next = output.slice(offset);
        screen.feed(bytes.subarray(byteOffset)); byteOffset = bytes.length;
        const visible = screen.buffer.map(row => row.map(cell => cell.data).join('')).join('\n');
        offset = output.length;
        if (next.includes('\x1b[6n'))
            p.send('\x1b[1;1R');
        if (!confirmed && output.includes('ANTHROPIC_API_KEY')) {
            p.send('\x1b[A\r');
            confirmed = true;
        }
        if (!sent && Date.now() - start > 5000) {
            p.send('/statusline-configure-native\r');
            sent = true;
        }
        records = fs.existsSync(receipt) ? fs.readFileSync(receipt, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
        if (!sourcesOpened && records.some(row => row.argv[0] === 'ui' && row.operation === 'preview') && output.includes('Click')) {
            // In this captured 120x36 frame the Client occupies columns 49-120;
            // its first item is on row 8. Focus that observed Client region.
            p.send('\x1b[<0;65;8M\x1b[<0;65;8m');
            await new Promise(resolve => setTimeout(resolve, 200));
            p.send('\x19');
            sourcesOpened = true;
        }
        if (sourcesOpened && !sourceReviewed && records.some(row => row.operation === 'sources_read' && row.phase === 'complete' && row.status === 0)) {
            await new Promise(resolve => setTimeout(resolve, 200));
            p.send('\r\x1b[B\r');
            sourceReviewed = true;
        }
        if (sourceReviewed && !manager && records.some(row => row.operation === 'source_review' && row.phase === 'complete' && row.status === 0)) {
            await new Promise(resolve => setTimeout(resolve, 300));
            const sourceScreen = new Capture(120,36); sourceScreen.feed(p.captured());
            fs.writeFileSync(reportPath.replace(/\.json$/u,'.sources.cells.json'),JSON.stringify({columns:120,rows:36,cells:sourceScreen.buffer,terminal_foreground:'#d8dee9',terminal_background:'#171a1f'}));
            p.send('\x07'); await new Promise(resolve => setTimeout(resolve, 150));
            p.send('\x07'); await new Promise(resolve => setTimeout(resolve, 150));
            p.send('\x0f'); manager = true;
        }
        if (manager && !quickOpened && records.some(row => row.operation === 'profiles_read' && row.phase === 'complete' && row.status === 0)) {
            // Escape releases the native Client focus; Ctrl+G closes its overlay.
            p.send('\x07');
            await new Promise(resolve => setTimeout(resolve, 200));
            p.send('\x10');
            await new Promise(resolve => setTimeout(resolve, 200));
            p.send('\x1b[F\r');
            quickOpened = true;
        }
        if (quickOpened && !saved && records.some(row => row.operation === 'preset' && row.phase === 'complete' && row.status === 0)) {
            // The last stable preset is quota-watch. Review, continue editing, save/close.
            await new Promise(resolve => setTimeout(resolve, 200));
            p.send('\x1b[F\r');
            await new Promise(resolve => setTimeout(resolve, 200));
            p.send('\r');
            await new Promise(resolve => setTimeout(resolve, 200));
            p.send('f');
            saved = true;
        }
        if (saved && !taskOpened && !visible.includes('Configure Status Line') &&
            records.some(row => row.operation === 'apply' && row.phase === 'complete' && row.status === 0)) {
            p.send('/statusline-task\r');
            taskOpened = true;
        }
        // Native redraws reuse cells; raw escape output need not contain whole words.
        taskRendered = taskOpened && visible.includes('Read-only') && visible.includes('Session:');
        if (taskRendered && records.some(row => row.argv[0] === 'runtime') && records.some(row => row.operation === 'task_details' && row.phase === 'complete' && row.status === 0))
            break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    const commands = [...new Set(records.map(row => row.argv[0]))], operations = [...new Set(records.filter(row => row.argv[0] === 'ui').map(row => row.operation))];
    const display = join(config, 'claude-statusline.json');
    const completed = (operation: string) => records.some(row => row.operation === operation && row.phase === 'complete' && row.status === 0);
    const savedDisplay = fs.existsSync(display) ? JSON.parse(fs.readFileSync(display, 'utf8')) : null;
    const completeSchemeSaved = savedDisplay?.schema_version === 16 && savedDisplay.theme === 'terminal'
        && JSON.stringify(savedDisplay.layout.rows[0]) === JSON.stringify(['context-used', 'five-hour-limit', 'weekly-limit']);
    report = { status: taskRendered && commands.includes('runtime') && ['apply','profiles_read','preset','task_details','sources_read','source_review'].every(completed) && completeSchemeSaved ? 'pass' : 'unverified', host: version, source: f.packed.source, tarball_sha256: f.packed.sha256, installed_resources: true, real_host_commands: commands, native_operations: operations, display_saved: fs.existsSync(display), complete_scheme_saved: completeSchemeSaved, task_pane_rendered: taskRendered, model_calls: 0, credentials: 'synthetic key and unreachable loopback API', physical_visual_acceptance: false };
    fs.writeFileSync(reportPath.replace(/\.json$/u, '.terminal.bin'), p.captured());
    fs.writeFileSync(reportPath.replace(/\.json$/u, '.cells.json'), JSON.stringify({ columns: 120, rows: 36, cells: screen.buffer,
        terminal_foreground: '#d8dee9', terminal_background: '#171a1f' }) + '\n');
    if (report.status !== 'pass')
        throw new Error('Installed host interaction is unverified; inspect private terminal capture');
}
catch (error) {
    report.error = String(error);
    process.exitCode = 1;
}
finally {
    if (p) {
        try {
            process.kill(-p.child.pid!, 'SIGTERM');
        }
        catch { /* Already ended. */ }
        const stop = Date.now() + 2000;
        while (p.child.exitCode === null && Date.now() < stop) {
            p.captured();
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        try {
            process.kill(-p.child.pid!, 'SIGKILL');
        }
        catch { /* Already ended. */ }
        await p.close();
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    f.cleanup();
}
console.log(JSON.stringify({ status: report.status, commands: report.real_host_commands, operations: report.native_operations, error: report.error }));
