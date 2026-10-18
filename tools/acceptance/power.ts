/** Read-only OS observation. The operator, never this tool, initiates sleep/reboot. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { sample } from '@fbincon/statusline-platform/clocks';
import { library } from '@fbincon/statusline-platform/native';
import { architecture } from '@fbincon/statusline-platform/architecture';
import { decode, encode } from '@fbincon/statusline-core/json';
import { sourceHashes } from '../migration/ts-03/common.js';
import { linuxPower, macPower, windowsPower, replay } from './power-evidence.js';
import { artifactOptions, artifactEvidence } from './artifact.js';
import assert from 'node:assert/strict';
const sha = (raw: Buffer) => createHash('sha256').update(raw).digest('hex');
function command(executable: string, args: string[], input = '') {
    const result = spawnSync(executable, args, { input, encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' }, windowsHide: true });
    return { command: [executable, ...args], exit_code: result.status ?? 124, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error?.message ?? null };
}
function exactCommand(executable: string, args: string[]): string { const r = command(executable, args); if (r.exit_code !== 0)
    throw new Error(r.stderr || r.error || 'OS query failed'); return r.stdout.trim(); }
export function diagnosticClocks(): Record<string, bigint> {
    if (process.platform === 'linux') {
        const lib = library('libc.so.6'), clock = lib.func('int clock_gettime(int clock, _Out_ void *value)');
        const get = (id: number) => { const raw = Buffer.alloc(16); if (clock(id, raw))
            throw new Error('clock_gettime unavailable'); return raw.readBigInt64LE() * 1000000000n + raw.readBigInt64LE(8); };
        return { boottime_ns: get(7), monotonic_ns: get(1) };
    }
    if (process.platform === 'darwin') {
        const lib = library('/usr/lib/libSystem.B.dylib'), raw = Buffer.alloc(8);
        if (lib.func('int mach_timebase_info(_Out_ void *value)')(raw) || !raw.readUInt32LE() || !raw.readUInt32LE(4))
            throw new Error('Mach timebase unavailable');
        const get = (name: string) => BigInt(lib.func(`uint64_t ${name}()`)()) * BigInt(raw.readUInt32LE()) / BigInt(raw.readUInt32LE(4));
        return { mach_absolute_time_ns: get('mach_absolute_time'), mach_continuous_time_ns: get('mach_continuous_time') };
    }
    return {};
}
export function capturePower(kind: string) {
    if (process.version !== 'v24.21.0' || !['suspend', 'reboot'].includes(kind))
        throw new Error('Use pinned Node and --kind suspend|reboot');
    const node = sample();
    if (node.boot_ns === null || !node.boot_id)
        throw new Error('Suspend-aware clock or boot identity unavailable');
    const record: any = { schema_version: 1, kind, platform: process.platform, captured_utc: new Date(Number(node.wall_ns / 1000000n)).toISOString(), node, source_hashes: sourceHashes(), runtimes: { node: process.version, node_sha256: sha(fs.readFileSync(process.execPath)) }, host: architecture(), diagnostic: diagnosticClocks() };
    if (process.platform === 'linux') {
        record.proc_boot_id = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
        record.proc_btime = BigInt(/^btime (\d+)$/mu.exec(fs.readFileSync('/proc/stat', 'utf8'))![1]!);
        const virtual = command('systemd-detect-virt', []);
        Object.assign(record.host, { virtualization: virtual.stdout.trim(), virtualization_exit: virtual.exit_code });
    }
    else if (process.platform === 'darwin') {
        record.mach = record.diagnostic;
        record.kern_boottime = exactCommand('/usr/sbin/sysctl', ['-n', 'kern.boottime']);
        record.host.hypervisor = command('/usr/sbin/sysctl', ['-n', 'kern.hv_vmm_present']).stdout.trim();
        record.host.sw_vers = exactCommand('/usr/bin/sw_vers', []);
    }
    else if (process.platform !== 'win32')
        throw new Error('Unsupported power platform');
    return record;
}
const windowsScript = `$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$since=[datetime]::Parse([Console]::In.ReadLine(),[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)
try{$events=@(Get-WinEvent -FilterHashtable @{LogName='System';StartTime=$since;Id=@(12,13,27,42,107,506,507)} -ErrorAction Stop)}catch{if($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*'){$events=@()}else{throw}}
$result=@($events|ForEach-Object{[xml]$x=$_.ToXml();[ordered]@{time_utc=[string]$x.Event.System.TimeCreated.SystemTime;id=$_.Id;provider=$_.ProviderName}})
ConvertTo-Json -InputObject $result -Depth 5 -Compress`;
export function collectPowerEvents(platform: string, start: string): Record<string, ReturnType<typeof command>> {
    if (platform === 'linux')
        return { kernel: command('journalctl', ['--no-pager', '-k', '-o', 'json', '--since', start]), boots: command('journalctl', ['--no-pager', '--list-boots', '--output=json']) };
    if (platform === 'darwin')
        return { pmset: command('/usr/bin/pmset', ['-g', 'log']), 'last-reboot': command('/usr/bin/last', ['reboot']) };
    if (platform === 'win32')
        return { events: command(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', windowsScript], start + '\n') };
    throw new Error('Unsupported event source');
}
function write(path: string, value: unknown) { fs.writeFileSync(path, encode(value) + '\n', { flag: 'wx', mode: 0o600 }); }
export function powerMain(args = process.argv.slice(2)) {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { ...artifactOptions, output: { type: 'string' }, kind: { type: 'string' }, 'human-confirmed': { type: 'boolean' } } });
    if (positionals.length !== 1 || !['before', 'after'].includes(positionals[0]!) || !values.output)
        throw new Error('Usage: power before|after --output DIRECTORY [--kind suspend|reboot] [--human-confirmed]');
    const output = resolve(values.output);
    if (positionals[0] === 'before') {
        const record = { ...capturePower(values.kind ?? ''), installed_artifact: artifactEvidence(values) };
        fs.mkdirSync(output, { mode: 0o700 });
        write(join(output, 'before.json'), record);
        write(join(output, 'before-events.json'), collectPowerEvents(record.platform, record.captured_utc));
        console.log('Captured before snapshot; no power action performed: ' + output);
        return;
    }
    const before = decode(fs.readFileSync(join(output, 'before.json'), 'utf8')) as any, after = { ...capturePower(before.kind), installed_artifact: artifactEvidence(values) };
    assert.equal(encode(before.installed_artifact ?? null), encode(after.installed_artifact), 'Installed artifact changed across the power event');
    if (before.platform !== after.platform)
        throw new Error('Power evidence platform changed');
    write(join(output, 'after.json'), after);
    const commands = collectPowerEvents(after.platform, before.captured_utc);
    write(join(output, 'after-events.json'), commands);
    const replays = { node: replay(before.node, after.node) }, human = values['human-confirmed'] === true;
    const report = after.platform === 'linux' ? linuxPower(before, after, commands.kernel!.stdout.split('\n').filter(Boolean).map(line => decode(line) as any), decode(commands.boots!.stdout || '[]') as any, replays, human, commands) : after.platform === 'darwin' ? macPower(before, after, commands.pmset!.stdout, commands['last-reboot']!.stdout, replays, human, commands) : windowsPower(before, after, JSON.parse(commands.events!.stdout || '[]'), human, commands);
    write(join(output, 'evidence.json'), report);
    console.log(encode(report));
    if (report.status !== 'pass')
        process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
    powerMain();
