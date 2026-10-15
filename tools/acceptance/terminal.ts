/** Explicit operator-only desktop probes; no synthetic input is sent to the terminal. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { randomUUID, createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { terminal } from '@fbincon/statusline-platform/terminal/session';
import { library } from '@fbincon/statusline-platform/native';
import { processToken, processMatches } from '@fbincon/statusline-platform/processes';
import { shellQuote } from '@fbincon/statusline-platform/terminal/launchers';
import { clip } from '@fbincon/statusline-core/unicode/index';
import { sourceHashes } from '../migration/ts-03/common.js';
import { assessTerminal } from './terminal-evidence.js';
const entry = fileURLToPath(import.meta.url);
const write = (path: string, value: unknown) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
async function question(text: string) { const io = createInterface({ input: process.stdin, output: process.stdout }); try {
    return (await io.question(text)).trim();
}
finally {
    io.close();
} }
function attributes() { const raw = Buffer.alloc(256); const lib = library(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6'); if (lib.func('int tcgetattr(int fd, _Out_ void *attrs)')(0, raw))
    throw new Error('Terminal attributes unavailable'); return raw.toString('hex'); }
async function observe(path: string) {
    const record = (event: string, data: unknown = null) => fs.appendFileSync(path, JSON.stringify({ event, data }) + '\n');
    let inputFailure: unknown;
    const input = (chunk: Buffer) => { try {
        record('key', chunk.toString('utf8'));
    }
    catch (error) {
        inputFailure = error;
    } };
    process.stdin.on('data', input);
    try {
        const result = await terminal({ guard() { if (inputFailure)
                throw inputFailure; }, draw(columns, rows) { record('resize', [columns, rows]); record('ready'); return '\x1b[H\x1b[2J' + clip(columns < 64 || rows < 18 ? 'Need 64x18; Ctrl+C exits' : 'TS-05 中文 é 👩🏽‍💻 | Ctrl+S save | Ctrl+C cancel', Math.max(0, columns - 1)); }, key(key) { if (key.ctrl && key.key === 's')
                return { reason: 'save', code: 0 }; if (key.ctrl && key.key === 'c')
                return { reason: 'cancel', code: 130 }; return null; }, interrupted(signal) { return { reason: signal, code: 130 }; }, timeout() { return { reason: 'timeout', code: 1 }; } }, { deadline: performance.now() + 1800000 });
        record('restored', result.reason);
        process.exitCode = result.code;
    }
    catch (error) {
        try {
            record('error', String(error));
        }
        catch { }
        process.exitCode = 1;
    }
    finally {
        process.stdin.off('data', input);
    }
}
async function exercise(config: any) {
    if (!process.stdin.isTTY || !process.stdout.isTTY || !processMatches(config.parent_pid, config.parent_token))
        throw new Error('Live parent and real terminal required');
    write(join(config.output, 'handshake.json'), { nonce: config.nonce, input_tty: true, output_tty: true });
    console.log('Human terminal check / 真人终端验收\nPress all four arrows and enter 中文 é 👩🏽‍💻. Resize below 64×18 and above 80×24 in direct mode. Finish with Ctrl+S. The second screen uses Ctrl+C.');
    await question('Press Enter when ready / 准备后按 Enter: ');
    const runs = [];
    for (const [name, log] of [['save', 'save.jsonl'], ['cancel', 'cancel.jsonl'], ['log-failure', 'missing/events.jsonl']]) {
        if (name === 'cancel')
            await question('Next screen: Ctrl+C / 下一屏按 Ctrl+C，准备后按 Enter: ');
        const before = attributes(), result = spawnSync(process.execPath, [entry, 'observe', '--output', join(config.output, log!)], { stdio: 'inherit' }), after = attributes();
        runs.push({ name, exit_code: result.status, before, after, restored_without_harness_repair: before === after });
    }
    let echo = '';
    while (!['TS02-RESTORED', 'SKIP'].includes(echo))
        echo = await question('Type TS02-RESTORED to verify restored input, or SKIP: ');
    const human: Record<string, string> = {};
    for (const [name, prompt] of [['automatic_focus', 'Did the window/popup open and take input focus?'], ['unicode_display', 'Were 中文 é 👩🏽‍💻 and their widths correct?'], ['restored_display', 'Were screen, cursor and input restored after every exit?']])
        human[name!] = (await question(prompt + ' yes/no/skip: ')).toLowerCase();
    write(join(config.output, 'interaction.json'), { runs, echo, human });
}
async function main() {
    if (!['linux', 'darwin'].includes(process.platform))
        throw new Error('Use the installed native Windows-console acceptance on Windows');
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { output: { type: 'string' }, mode: { type: 'string', default: 'direct' }, config: { type: 'string' }, nonce: { type: 'string' } } }), phase = positionals[0];
    if (phase === 'observe') {
        if (!values.output)
            throw new Error('Missing output');
        return observe(values.output);
    }
    if (phase === 'launch') {
        if (!values.output || !['direct', 'popup'].includes(values.mode!))
            throw new Error('launch requires --output NEW_DIRECTORY --mode direct|popup');
        const output = resolve(values.output), nonce = randomUUID(), configPath = join(output, 'config.json');
        fs.mkdirSync(output, { mode: 0o700 });
        const config = { output, nonce, mode: values.mode, parent_pid: process.pid, parent_token: processToken(process.pid), socket: 'statusline-' + randomUUID() };
        write(configPath, config);
        write(join(output, 'source.json'), { files: sourceHashes(), node_sha256: createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex') });
        write(join(output, 'launch.json'), { prepared: { request: { nonce } } });
        const argv = [process.execPath, entry, 'child', '--config', configPath, '--nonce', nonce];
        if (process.platform === 'linux') {
            const child = spawnSync('gnome-terminal', ['--tab', '--active', '--wait', '--title=Statusline terminal acceptance', '--', ...argv], { stdio: 'inherit' });
            if (child.status !== 0)
                throw new Error('GNOME Terminal acceptance did not complete');
        }
        else {
            const script = join(output, 'acceptance.command');
            fs.writeFileSync(script, '#!/bin/sh\nexec ' + argv.map(shellQuote).join(' ') + '\n', { mode: 0o700, flag: 'wx' });
            const opened = spawnSync('/usr/bin/open', ['-a', 'Terminal', script], { encoding: 'utf8', timeout: 10000 });
            if (opened.status !== 0)
                throw new Error(opened.stderr);
            const until = performance.now() + 1800000;
            let focused = false;
            while (performance.now() < until && !fs.existsSync(join(output, 'done.json'))) {
                if (!focused && fs.existsSync(join(output, 'handshake.json'))) {
                    const focus = spawnSync('/usr/bin/osascript', ['-e', 'tell application "System Events" to get name of first application process whose frontmost is true'], { encoding: 'utf8', timeout: 10000 });
                    write(join(output, 'focus.json'), { ...JSON.parse(fs.readFileSync(join(output, 'handshake.json'), 'utf8')), status: focus.status, frontmost: focus.stdout.trim() });
                    focused = true;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (!fs.existsSync(join(output, 'done.json')))
                throw new Error('Human terminal acceptance timed out');
        }
        const report = assessTerminal(output, config.mode as 'direct' | 'popup', process.platform as 'linux' | 'darwin');
        write(join(output, 'manual-evidence.json'), report);
        console.log(JSON.stringify(report));
        if (report.status !== 'pass')
            process.exitCode = 1;
        return;
    }
    if (!values.config || !values.nonce)
        throw new Error('Require nonce-bound --config');
    const config = JSON.parse(fs.readFileSync(values.config, 'utf8'));
    if (values.nonce !== config.nonce || !processMatches(config.parent_pid, config.parent_token))
        throw new Error('Stale or mismatched terminal invocation');
    if (phase === 'child' && config.mode === 'popup') {
        const argv = [process.execPath, entry, 'popup-host', '--config', values.config, '--nonce', values.nonce];
        const r = spawnSync('tmux', ['-L', config.socket, '-f', '/dev/null', 'new-session', argv.map(shellQuote).join(' ')], { stdio: 'inherit' });
        if (r.status !== 0)
            throw new Error('Popup host failed');
    }
    else if (phase === 'popup-host') {
        const argv = [process.execPath, entry, 'exercise', '--config', values.config, '--nonce', values.nonce];
        const r = spawnSync('tmux', ['display-popup', '-E', '-w', '90%', '-h', '95%', argv.map(shellQuote).join(' ')], { stdio: 'inherit' });
        const echo = await question('Returned to parent. Type TS02-PARENT: '), human_visual = (await question('Popup border/focus and parent screen restored? yes/no/skip: ')).toLowerCase();
        write(join(config.output, 'popup-parent.json'), { exit_code: r.status, echo, human_visual });
        return;
    }
    else if (phase === 'child' || phase === 'exercise')
        await exercise(config);
    else
        throw new Error('Unknown terminal phase');
    if (phase === 'child') {
        write(join(config.output, 'done.json'), { completed: true });
        await question('Evidence captured. Press Enter to close: ');
    }
}
await main();
