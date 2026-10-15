import test from 'node:test';
import assert from 'node:assert/strict';
import { linuxPower, macPower, rebootEvent, sleepIntervals } from '../power-evidence.js';
const start = 1791936000000000000n;
const pmset = '2026-10-14 08:00:05 +0800 Sleep Entering Sleep state due to software\n2026-10-14 08:01:05 +0800 Wake Wake from Normal Sleep\n';
function fixture(kind = 'suspend', platform = 'linux') {
    const before: any = { kind, source_hashes: { file: 'hash' }, runtimes: { node: 'pinned' }, proc_boot_id: 'boot1', proc_btime: start / 1000000000n - 100n, diagnostic: { boottime_ns: 100000000000n, monotonic_ns: 100000000000n }, host: { virtualization: 'none', virtualization_exit: 1, hypervisor: '1' }, mach: { mach_absolute_time_ns: 100000000000n, mach_continuous_time_ns: 100000000000n } };
    for (const side of ['node', 'python', 'reference'])
        before[side] = { wall_ns: start, boot_ns: 100000000000n, boot_id: 'boot1' };
    const after = structuredClone(before);
    for (const side of ['node', 'python', 'reference']) {
        after[side].wall_ns += 70000000000n;
        after[side].boot_ns += 70000000000n;
        if (kind === 'reboot') {
            after[side].boot_id = 'boot2';
            after[side].boot_ns = 10000000000n;
        }
    }
    after.diagnostic = { boottime_ns: 170000000000n, monotonic_ns: 110000000000n };
    after.mach = { mach_absolute_time_ns: 110000000000n, mach_continuous_time_ns: 170000000000n };
    if (kind === 'reboot') {
        after.proc_boot_id = 'boot2';
        after.proc_btime = start / 1000000000n + 60n;
        after.kern_boottime = `{ sec = ${start / 1000000000n + 60n}, usec = 0 }`;
    }
    const kernel = [{ __REALTIME_TIMESTAMP: String(start / 1000n + 5000000n), _BOOT_ID: 'boot1', MESSAGE: 'PM: suspend entry (s2idle)' }, { __REALTIME_TIMESTAMP: String(start / 1000n + 65000000n), _BOOT_ID: 'boot1', MESSAGE: 'PM: suspend exit' }];
    const boots = [{ boot_id: 'boot2', first_entry: start / 1000n + 60000000n }], replays: any = Object.fromEntries(['node', 'python'].map(side => [side, { delta_ns: 70000000000n, trusted: kind === 'suspend' }])), commands: any = Object.fromEntries((platform === 'linux' ? ['kernel', 'boots'] : ['pmset', 'last-reboot']).map(name => [name, { exit_code: 0 }]));
    return { before, after, kernel, boots, replays, commands, human: true, pmset };
}
const linux = (f: ReturnType<typeof fixture>) => linuxPower(f.before, f.after, f.kernel, f.boots, f.replays, f.human, f.commands);
const mac = (f: ReturnType<typeof fixture>) => macPower(f.before, f.after, f.pmset, 'reboot time Wed Oct 14 00:01\n', f.replays, f.human, f.commands);
test('tests.integration.test_linux_clock_smoke.LinuxPowerEvidenceTests.test_sleep_requires_events_and_excluded_monotonic_time', () => { let f = fixture(); assert.equal(linux(f).status, 'pass'); f.kernel = []; assert.equal(linux(f).status, 'fail'); f = fixture(); f.after.diagnostic.monotonic_ns = 170000000000n; assert.equal(linux(f).status, 'fail'); });
test('tests.integration.test_linux_clock_smoke.LinuxPowerEvidenceTests.test_old_boot_events_and_unconfirmed_actions_do_not_pass', () => { let f = fixture(); f.kernel.forEach(e => e._BOOT_ID = 'older'); assert.equal(linux(f).status, 'fail'); f = fixture(); f.human = false; assert.equal(linux(f).status, 'fail'); });
test('tests.integration.test_linux_clock_smoke.LinuxPowerEvidenceTests.test_reboot_needs_new_identity_new_journal_and_wall_fallback', () => { let f = fixture('reboot'); assert.equal(linux(f).status, 'pass'); f.boots = []; assert.equal(linux(f).status, 'fail'); f = fixture('reboot'); f.replays.node.trusted = true; assert.equal(linux(f).status, 'fail'); f = fixture('reboot'); f.after.reference.boot_id = 'boot1'; assert.equal(linux(f).status, 'fail'); });
test('tests.integration.test_linux_clock_smoke.LinuxPowerEvidenceTests.test_changed_code_runtime_and_event_failures_are_rejected', () => { for (const change of [(f: any) => f.after.source_hashes.file = 'changed', (f: any) => f.after.runtimes.node = 'changed', (f: any) => f.commands.kernel.exit_code = 1]) {
    const f = fixture();
    change(f);
    assert.equal(linux(f).status, 'fail');
} });
test('tests.integration.test_linux_clock_smoke.LinuxPowerEvidenceTests.test_guest_result_never_claims_physical_host', () => { const f = fixture(); f.after.host.virtualization = 'kvm'; f.after.host.virtualization_exit = 0; assert.equal(linux(f).physical_host_coverage, false); });
test('tests.integration.test_macos_clock_smoke.MacOSPowerEvidenceTests.test_sleep_pairs_only_in_capture_window_and_respects_offset', () => { const s = Number(start / 1000000000n); assert.deepEqual(sleepIntervals(pmset, s, s + 70)[0], [60]); assert.equal(sleepIntervals(pmset, s, s + 70)[1].length, 2); assert.deepEqual(sleepIntervals(pmset, s + 10, s + 70)[0], []); });
test('tests.integration.test_macos_clock_smoke.MacOSPowerEvidenceTests.test_vm_pass_never_claims_physical_host', () => { const r = mac(fixture('suspend', 'darwin')); assert.equal(r.status, 'pass'); assert.equal(r.physical_host_coverage, false); assert.equal(r.scope, 'macOS virtual guest only'); });
test('tests.integration.test_macos_clock_smoke.MacOSPowerEvidenceTests.test_no_event_no_human_and_display_only_are_failures', () => { for (const change of [(f: any) => f.pmset = '', (f: any) => f.human = false, (f: any) => f.pmset = pmset.replace('Sleep Entering Sleep', 'Assertions Display Sleep')]) {
    const f = fixture('suspend', 'darwin');
    change(f);
    assert.equal(mac(f).status, 'fail');
} });
test('tests.integration.test_macos_clock_smoke.MacOSPowerEvidenceTests.test_short_sleep_does_not_meet_gate', () => { const f = fixture('suspend', 'darwin'); f.pmset = pmset.replace('08:01:05', '08:00:15'); assert.equal(mac(f).status, 'fail'); });
test('tests.integration.test_macos_clock_smoke.MacOSPowerEvidenceTests.test_monotonic_sleep_exclusion_is_independent_evidence', () => { const f = fixture('suspend', 'darwin'); f.after.mach.mach_absolute_time_ns = 170000000000n; assert.equal(mac(f).checks.absolute_clock_excluded_sleep, false); assert.equal(mac(f).status, 'fail'); });
test('tests.integration.test_macos_clock_smoke.MacOSPowerEvidenceTests.test_changed_source_runtime_or_unreadable_events_cannot_pass', () => { for (const change of [(f: any) => f.after.source_hashes.file = 'changed', (f: any) => f.after.runtimes.node = 'changed', (f: any) => f.commands.pmset.exit_code = 1]) {
    const f = fixture('suspend', 'darwin');
    change(f);
    assert.equal(mac(f).status, 'fail');
} });
test('tests.integration.test_macos_clock_smoke.MacOSPowerEvidenceTests.test_reboot_requires_new_domain_and_wall_fallback', () => { let f = fixture('reboot', 'darwin'); assert.equal(mac(f).status, 'pass'); f.after.node.boot_id = 'boot1'; assert.equal(mac(f).status, 'fail'); f = fixture('reboot', 'darwin'); f.replays.node.trusted = true; assert.equal(mac(f).status, 'fail'); });
test('tests.integration.test_macos_clock_smoke.MacOSPowerEvidenceTests.test_reboot_rejects_historical_or_missing_boot_events', () => { const s = Number(start / 1000000000n); assert.equal(rebootEvent('reboot time Wed Oct 14 00:01', s - 1, s, s + 70), false); assert.equal(rebootEvent('', s + 60, s, s + 70), false); assert.equal(rebootEvent('reboot time Wed Oct 14 00:02', s + 60, s, s + 70), false); });
