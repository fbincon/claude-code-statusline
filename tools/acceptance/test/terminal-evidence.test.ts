import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { assessTerminal, stopHost } from '../terminal-evidence.js';
function fixture(t: {
    after: (f: () => void) => void;
}) {
    const dir = fs.mkdtempSync(join(tmpdir(), 'terminal-evidence-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const save = (name: string, value: any) => fs.writeFileSync(join(dir, name), JSON.stringify(value));
    const record = { human: { automatic_focus: 'yes', unicode_display: 'yes', restored_display: 'yes' }, echo: 'TS02-RESTORED', runs: [0, 130, 1].map(exit_code => ({ exit_code, restored_without_harness_repair: true })) };
    const focus = { nonce: 'fixture', input_tty: true, output_tty: true, status: 0, frontmost: 'Terminal' }, saved = [{ event: 'key', data: '\x1b[A\x1b[B\x1b[C\x1b[D中文 é 👩🏽‍💻' }, { event: 'resize', data: [32, 12] }, { event: 'resize', data: [80, 24] }, { event: 'restored', data: 'save' }];
    save('launch.json', { prepared: { request: { nonce: 'fixture' } } });
    save('source.json', { files: {} });
    save('popup-parent.json', { exit_code: 0, echo: 'TS02-PARENT', human_visual: 'yes' });
    const result = (platform: 'linux' | 'darwin' = 'linux', mode: 'direct' | 'popup' = 'direct') => { save('interaction.json', record); save('handshake.json', focus); save('focus.json', focus); fs.writeFileSync(join(dir, 'save.jsonl'), saved.map(x => JSON.stringify(x)).join('\n')); fs.writeFileSync(join(dir, 'cancel.jsonl'), JSON.stringify({ event: 'restored', data: 'cancel' })); return assessTerminal(dir, mode, platform); };
    return { record, focus, saved, save, result };
}
test('tests.integration.test_ts02_linux_terminal_smoke.LinuxManualEvidenceTests.test_complete_fixture_uses_human_focus_without_claiming_os_query', t => { const f = fixture(t), r = f.result(); assert.equal(r.status, 'pass'); assert.ok(r.focus_evidence.includes('no OS active-window query')); });
test('tests.integration.test_ts02_linux_terminal_smoke.LinuxManualEvidenceTests.test_unconfirmed_focus_wrong_nonce_and_terminal_repair_fail', t => { const f = fixture(t); f.record.human.automatic_focus = 'skip'; assert.equal(f.result().status, 'fail'); f.record.human.automatic_focus = 'yes'; f.focus.nonce = 'wrong'; assert.equal(f.result().status, 'fail'); f.focus.nonce = 'fixture'; f.record.runs[0]!.restored_without_harness_repair = false; assert.equal(f.result().status, 'fail'); });
test('tests.integration.test_ts02_linux_terminal_smoke.LinuxManualEvidenceTests.test_popup_needs_parent_input_and_visual_confirmation', t => { const f = fixture(t); assert.equal(f.result('linux', 'popup').status, 'pass'); f.save('popup-parent.json', { exit_code: 0, echo: '', human_visual: 'yes' }); assert.equal(f.result('linux', 'popup').status, 'fail'); });
test('tests.integration.test_ts02_macos_terminal_smoke.TerminalEvidenceGates.test_complete_synthetic_fixture_passes_evaluator', t => { assert.equal(fixture(t).result('darwin').status, 'pass'); });
test('tests.integration.test_ts02_macos_terminal_smoke.TerminalEvidenceGates.test_unconfirmed_visual_and_repaired_terminal_are_not_passes', t => { const f = fixture(t); f.record.human.unicode_display = 'skip'; assert.equal(f.result('darwin').status, 'fail'); f.record.human.unicode_display = 'yes'; f.record.runs[0]!.restored_without_harness_repair = false; assert.equal(f.result('darwin').status, 'fail'); });
test('tests.integration.test_ts02_macos_terminal_smoke.TerminalEvidenceGates.test_wrong_nonce_or_wrong_focus_cannot_pass', t => { const f = fixture(t); f.focus.nonce = 'wrong'; assert.equal(f.result('darwin').status, 'fail'); f.focus.nonce = 'fixture'; f.focus.frontmost = 'Finder'; assert.equal(f.result('darwin').status, 'fail'); });
test('tests.integration.test_ts02_macos_terminal_smoke.TerminalEvidenceGates.test_missing_unicode_directions_and_small_size_are_rejected', t => { const f = fixture(t); f.saved[0]!.data = 'ordinary typing'; f.saved[1]!.data = [80, 24]; const r = f.result('darwin'); for (const name of ['arrows', 'unicode_input', 'small_and_large_resize'])
    assert.equal(r.checks[name], false); assert.equal(r.status, 'fail'); });
test('tests.integration.test_ts02_mod_smoke.HostCleanupTests.test_busy_host_ignoring_sigterm_is_drained_closed_and_reaped', { skip: process.platform === 'win32' }, async () => {
    const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});process.stdout.write("READY");setInterval(()=>process.stdout.write("x".repeat(4096)),1)'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let bytes = 0;
    child.stdout.on('data', chunk => { bytes += chunk.length; });
    await once(child.stdout, 'data');
    let closed = false;
    await stopHost({ signal: s => { child.kill(s); }, exited: () => child.exitCode !== null || child.signalCode !== null, drain: () => child.stdout.resume(), close: () => { closed = true; child.stdout.destroy(); } }, 100);
    assert.equal(child.signalCode, 'SIGKILL');
    assert.ok(bytes > 5);
    assert.equal(closed, true);
});
test('tests.integration.test_ts02_mod_smoke.HostCleanupTests.test_unreapable_child_has_bounded_wait_and_master_is_closed', async () => {
    let closed = false, drained = false;
    const started = performance.now();
    await assert.rejects(() => stopHost({ signal: () => { }, exited: () => false, drain: () => { drained = true; }, close: () => { closed = true; } }, 0, 0));
    assert.equal(closed, true);
    assert.equal(drained, true);
    assert.ok(performance.now() - started < 1000);
});
