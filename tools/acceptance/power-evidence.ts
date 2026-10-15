import { canonical, integer } from '@fbincon/statusline-core/json';
import { delta, trusted } from '@fbincon/statusline-core/timing/sample';
type RecordData = Record<string, any>;
const ns = (value: unknown) => typeof value === 'string' && /^-?\d+$/u.test(value) ? BigInt(value) : integer(value);
const seconds = (value: unknown) => Number(ns(value)) / 1e9;
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const abs = (n: bigint) => n < 0n ? -n : n;
function base(before: RecordData, after: RecordData, confirmed: boolean, commands: RecordData, names: string[]) {
    if (!['suspend', 'reboot'].includes(before.kind) || !before.node || !after.node)
        throw new Error('Invalid power evidence');
    return { action_confirmed: confirmed === true, source_unchanged: same(before.source_hashes, after.source_hashes), runtime_unchanged: same(before.runtimes, after.runtimes), event_collection_ok: names.every(name => Number(commands[name]?.exit_code) === 0) } as Record<string, boolean>;
}
function clocks(before: RecordData, after: RecordData, replays: RecordData, checks: Record<string, boolean>) {
    const values: Record<string, {
        wall_ns: bigint;
        boot_ns: bigint;
    }> = {};
    for (const side of ['node', 'python', 'reference'].filter(side => before[side] || after[side])) {
        const a = before[side], b = after[side];
        if (!a || !b || typeof a.boot_id !== 'string' || !a.boot_id || typeof b.boot_id !== 'string' || !b.boot_id)
            throw new Error('Missing power clock identity');
        const value = { wall_ns: ns(b.wall_ns) - ns(a.wall_ns), boot_ns: ns(b.boot_ns) - ns(a.boot_ns) };
        values[side] = value;
        if (before.kind === 'suspend') {
            checks[side + '_stable_boot'] = a.boot_id === b.boot_id;
            checks[side + '_includes_sleep'] = value.boot_ns > 0n && abs(value.boot_ns - value.wall_ns) < 2000000000n;
        }
        else
            checks[side + '_new_boot'] = a.boot_id !== b.boot_id;
        if (replays[side]) {
            const expected = before.kind === 'suspend' ? value.boot_ns : value.wall_ns;
            checks[side + '_elapsed'] = (expected < 0n ? replays[side].delta_ns === null : ns(replays[side].delta_ns) === expected) && replays[side].trusted === (before.kind === 'suspend');
        }
        else if (side === 'node')
            checks.node_elapsed = false;
    }
    return values;
}
export function replay(a: RecordData, b: RecordData) {
    const convert = (value: RecordData) => ({ wall_ns: ns(value.wall_ns), boot_ns: value.boot_ns === null ? null : ns(value.boot_ns), boot_id: value.boot_id });
    return { delta_ns: delta(convert(a), convert(b)), trusted: trusted(convert(a), convert(b)) };
}
export function sleepIntervals(text: string, start: number, end: number): [
    number[],
    string[]
] {
    const intervals: number[] = [], events: string[] = [];
    let entered: number | null = null;
    for (const line of text.split('\n')) {
        const m = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ([+-]\d{4})\s+(Sleep|Wake|DarkWake)\s+(.+)$/u.exec(line);
        if (!m)
            continue;
        const instant = Date.parse(`${m[1]}T${m[2]}${m[3]!.slice(0, 3)}:${m[3]!.slice(3)}`) / 1000;
        if (instant < start || instant > end)
            continue;
        if (m[4] === 'Sleep' && m[5]!.includes('Entering Sleep')) {
            entered = instant;
            events.push(line);
        }
        else if (['Wake', 'DarkWake'].includes(m[4]!) && /\b(?:Dark)?Wake from\b/u.test(m[5]!) && entered !== null) {
            intervals.push(instant - entered);
            events.push(line);
            entered = null;
        }
    }
    return [intervals, events];
}
export function rebootEvent(text: string, boot: number, start: number, end: number): boolean {
    if (!(start < boot && boot <= end))
        return false;
    const date = new Date(boot * 1000), days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const expected = `reboot time ${days[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    return text.split('\n').some(line => line.trim().replace(/\s+/gu, ' ') === expected);
}
export function macPower(before: RecordData, after: RecordData, pmset: string, last: string, replays: RecordData, human: boolean, commands: RecordData) {
    const checks = base(before, after, human, commands, ['pmset', 'last-reboot']);
    checks.human_confirmed = human === true;
    const start = seconds(before.node.wall_ns), end = seconds(after.node.wall_ns), [intervals, events] = sleepIntervals(pmset, start, end), values = clocks(before, after, replays, checks);
    const paused = Number(ns(after.mach.mach_continuous_time_ns) - ns(before.mach.mach_continuous_time_ns) - ns(after.mach.mach_absolute_time_ns) + ns(before.mach.mach_absolute_time_ns)) / 1e9;
    if (before.kind === 'suspend') {
        checks.system_sleep_wake_event = intervals.some(n => n >= 30);
        checks.absolute_clock_excluded_sleep = paused >= 28;
    }
    else {
        const boot = /sec\s*=\s*(\d+)/u.exec(after.kern_boottime)?.[1];
        checks.system_reboot_event = !!boot && rebootEvent(last, Number(boot), start, end);
    }
    const virtual = after.host.hypervisor === '1';
    return { status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', kind: before.kind, checks, deltas_ns: values, replays, sleep_intervals_seconds: intervals, mach_sleep_seconds: before.kind === 'suspend' ? paused : null, selected_events: events, scope: virtual ? 'macOS virtual guest only' : 'this macOS host only', physical_host_coverage: virtual ? false : null };
}
export function linuxPower(before: RecordData, after: RecordData, kernel: RecordData[], boots: RecordData[], replays: RecordData, confirmed: boolean, commands: RecordData) {
    const checks = base(before, after, confirmed, commands, ['kernel', 'boots']), start = ns(before.node.wall_ns), end = ns(after.node.wall_ns), bootId = after.proc_boot_id.replaceAll('-', '');
    const intervals: number[] = [], events: RecordData[] = [];
    let entered: bigint | null = null;
    for (const row of kernel) {
        const stamp = ns(String(row.__REALTIME_TIMESTAMP)) * 1000n;
        if (row._BOOT_ID !== bootId || stamp < start || stamp > end)
            continue;
        const message = row.MESSAGE ?? '';
        if (message.startsWith('PM: suspend entry')) {
            entered = stamp;
            events.push({ unix_ns: stamp, message });
        }
        else if (message === 'PM: suspend exit' && entered !== null) {
            intervals.push(Number(stamp - entered) / 1e9);
            events.push({ unix_ns: stamp, message });
            entered = null;
        }
    }
    const values = clocks(before, after, replays, checks), excluded = Number(ns(after.diagnostic.boottime_ns) - ns(before.diagnostic.boottime_ns) - ns(after.diagnostic.monotonic_ns) + ns(before.diagnostic.monotonic_ns)) / 1e9;
    if (before.kind === 'suspend') {
        checks.kernel_suspend_resume_pair = intervals.some(n => n >= 30);
        checks.monotonic_excluded_sleep = excluded >= 28;
    }
    else {
        checks.proc_boot_changed = before.proc_boot_id !== after.proc_boot_id;
        const time = ns(after.proc_btime) * 1000000000n;
        checks.proc_boot_time_in_window = start < time && time <= end;
        checks.journal_new_boot = boots.some(row => { const time = ns(row.first_entry) * 1000n; return row.boot_id === bootId && start < time && time <= end; });
    }
    const physical = after.host.virtualization === 'none' && Number(after.host.virtualization_exit) === 1;
    return { status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', kind: before.kind, checks, deltas_ns: values, replays, sleep_intervals_seconds: intervals, monotonic_excluded_seconds: before.kind === 'suspend' ? excluded : null, selected_events: events, scope: physical ? 'this physical Linux host' : 'this Linux guest only', physical_host_coverage: physical };
}
export function windowsPower(before: RecordData, after: RecordData, events: RecordData[], human: boolean, commands: RecordData) {
    const checks = base(before, after, human, commands, ['events']), start = seconds(before.node.wall_ns), end = seconds(after.node.wall_ns);
    const selected = events.filter(e => { const instant = Date.parse(e.time_utc) / 1000; return instant >= start && instant <= end; }).sort((a, b) => String(a.time_utc).localeCompare(String(b.time_utc)));
    const replays = { node: replay(before.node, after.node) }, values = clocks(before, after, replays, checks), intervals: number[] = [];
    let entered: number | null = null;
    for (const event of selected)
        if (event.provider === 'Microsoft-Windows-Kernel-Power') {
            const instant = Date.parse(event.time_utc) / 1000;
            if ([42, 506].includes(Number(event.id)))
                entered = instant;
            else if ([107, 507].includes(Number(event.id)) && entered !== null) {
                intervals.push(instant - entered);
                entered = null;
            }
        }
    if (before.kind === 'reboot')
        checks.node_changed_sequence = before.node.boot_id.split(':').at(-1) !== after.node.boot_id.split(':').at(-1);
    checks.physical_event = before.kind === 'suspend' ? intervals.some(n => n >= 30) : selected.some(e => e.provider === 'Microsoft-Windows-Kernel-General' && Number(e.id) === 12);
    return { status: Object.values(checks).every(Boolean) ? 'pass' : 'fail', kind: before.kind, checks, deltas_ns: values, replays, events: selected, sleep_intervals_seconds: intervals, scope: 'this Windows host and observed power mode only', physical_host_coverage: false };
}
