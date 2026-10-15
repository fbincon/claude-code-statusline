import * as fs from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { repoRoot } from '../migration/ts-03/common.js';
const read = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
export function assessTerminal(folder: string, mode: 'direct' | 'popup', platform: 'linux' | 'darwin', root = repoRoot) {
    const record = read(join(folder, 'interaction.json')), load = (name: string) => fs.existsSync(join(folder, name)) ? fs.readFileSync(join(folder, name), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    const saved = load('save.jsonl'), cancelled = load('cancel.jsonl'), keys = saved.filter(row => row.event === 'key').map(row => row.data).join(''), sizes: number[][] = saved.filter(row => row.event === 'resize').map(row => row.data);
    const launch = read(join(folder, 'launch.json')), focus = read(join(folder, platform === 'linux' ? 'handshake.json' : 'focus.json')), source = read(join(folder, 'source.json'));
    const checks: Record<string, boolean> = {
        human_answers: ['automatic_focus', 'unicode_display', 'restored_display'].every(name => record.human?.[name] === 'yes'), restored_echo: record.echo === 'TS02-RESTORED',
        arrows: [...'ABCD'].every(code => keys.includes('\x1b[' + code) || keys.includes('\x1bO' + code)), unicode_input: ['中文', 'é', '👩🏽‍💻'].every(text => keys.includes(text)),
        ctrl_s: saved.some(row => row.event === 'restored' && row.data === 'save'), ctrl_c: cancelled.some(row => row.event === 'restored' && row.data === 'cancel'),
        exit_codes: JSON.stringify(record.runs.map((row: any) => row.exit_code)) === '[0,130,1]', termios_restored: record.runs.every((row: any) => row.restored_without_harness_repair === true),
        nonce_tty_handshake: typeof launch.prepared?.request?.nonce === 'string' && focus.nonce === launch.prepared.request.nonce && focus.input_tty === true && focus.output_tty === true,
        source_unchanged: Object.entries(source.files).every(([name, hash]) => { const path = resolve(root, name), rel = relative(root, path); if (rel.startsWith('..') || isAbsolute(rel) || fs.lstatSync(path).isSymbolicLink())
            return false; return createHash('sha256').update(fs.readFileSync(path)).digest('hex') === hash; }),
    };
    if (platform === 'darwin')
        checks.os_observed_focus = focus.status === 0 && focus.frontmost === 'Terminal';
    if (mode === 'direct')
        checks.small_and_large_resize = sizes.some(([c, r]) => c! < 64 || r! < 18) && sizes.some(([c, r]) => c! >= 80 && r! >= 24);
    else {
        const parent = read(join(folder, 'popup-parent.json'));
        checks.popup_closed_to_parent = parent.exit_code === 0 && parent.echo === 'TS02-PARENT';
        checks.popup_visual = parent.human_visual === 'yes';
    }
    return { status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', checks, mode, sizes, input_origin: 'operator keyboard input; automated fixtures are not human acceptance', focus_evidence: platform === 'linux' ? 'operator confirmation; no OS active-window query claimed on Wayland' : 'Terminal frontmost query and operator confirmation', scope: 'this observed desktop only' };
}
export interface StoppableHost {
    signal(signal: NodeJS.Signals): void;
    exited(): boolean;
    drain(): void;
    close(): void;
}
export async function stopHost(host: StoppableHost, grace = 500, killDeadline = 2000) {
    const wait = async (ms: number) => { const end = performance.now() + ms; while (!host.exited() && performance.now() < end) {
        host.drain();
        await new Promise(resolve => setTimeout(resolve, 10));
    } };
    try {
        if (!host.exited()) {
            host.signal('SIGTERM');
            await wait(grace);
        }
        if (!host.exited()) {
            host.signal('SIGKILL');
            await wait(killDeadline);
        }
        host.drain();
        if (!host.exited())
            throw new Error('Host could not be reaped within its deadline');
    }
    finally {
        host.close();
    }
}
