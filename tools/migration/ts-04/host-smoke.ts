import * as fs from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { installCandidate, officialEnvironment } from './package.js';
import { openPty } from './test/pty.js';
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
    p = openPty(config, 120, 36, env, 'en', { executable: host.executable, args: [...host.args, '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'], cwd: project });
    let offset = 0, confirmed = false, sent = false, manager = false, saved = false, taskOpened = false;
    const start = Date.now();
    let records: {
        argv: string[];
        operation: string | null;
        phase?: string;
        status?: number;
    }[] = [];
    while (Date.now() - start < 40000 && p.child.exitCode === null) {
        const output = p.captured().toString('utf8'), next = output.slice(offset);
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
        if (!manager && records.some(row => row.argv[0] === 'ui' && row.operation === 'preview') && output.includes('Click')) {
            // In this captured 120x36 frame the Client occupies columns 49-120;
            // its first item is on row 8. Focus that observed Client region.
            p.send('\x1b[<0;65;8M\x1b[<0;65;8m');
            await new Promise(resolve => setTimeout(resolve, 200));
            p.send('\x0f');
            manager = true;
        }
        if (manager && !saved && records.some(row => row.operation === 'profiles_read' && row.phase === 'complete' && row.status === 0)) {
            // Escape releases the native Client focus; Ctrl+G closes its overlay.
            p.send('\x07');
            await new Promise(resolve => setTimeout(resolve, 200));
            p.send(' ');
            await new Promise(resolve => setTimeout(resolve, 200));
            p.send('s');
            saved = true;
        }
        if (!taskOpened && records.some(row => row.operation === 'apply' && row.phase === 'complete' && row.status === 0)) {
            p.send('q');
            await new Promise(resolve => setTimeout(resolve, 400));
            p.send('/statusline-task\r');
            taskOpened = true;
        }
        if (records.some(row => row.argv[0] === 'runtime') && records.some(row => row.operation === 'task_details' && row.phase === 'complete' && row.status === 0))
            break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    const commands = [...new Set(records.map(row => row.argv[0]))], operations = [...new Set(records.filter(row => row.argv[0] === 'ui').map(row => row.operation))];
    const display = join(config, 'claude-statusline.json');
    const completed = (operation: string) => records.some(row => row.operation === operation && row.phase === 'complete' && row.status === 0);
    report = { status: commands.includes('runtime') && ['apply','profiles_read','task_details'].every(completed) && fs.existsSync(display) ? 'pass' : 'unverified', host: version, source: f.packed.source, tarball_sha256: f.packed.sha256, installed_resources: true, real_host_commands: commands, native_operations: operations, display_saved: fs.existsSync(display), model_calls: 0, credentials: 'synthetic key and unreachable loopback API', physical_visual_acceptance: false };
    fs.writeFileSync(reportPath.replace(/\.json$/u, '.terminal.bin'), p.captured());
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
