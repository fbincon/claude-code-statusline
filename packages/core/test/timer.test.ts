import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readJson } from '../src/json-read.js';
import { delta, type Sample } from '../src/timing/sample.js';
import { StatusTimer, loadSample, taskElapsed } from '../src/timing/timer.js';
const sample = (wall: number, boot: number | null = null, domain: string | null = null): Sample => ({ wall_ns: BigInt(wall), boot_ns: boot === null ? null : BigInt(boot), boot_id: domain });
test('tests.runtime.timing.test_clock.StatusTimerTests.test_overlapping_waits_and_duplicate_events', () => {
    let timer = StatusTimer.start(sample(0)).pause('approval', sample(2)).pause('question', sample(3));
    assert.equal(timer.elapsed(sample(100)), 2n);
    assert.equal(timer.pause('approval', sample(200)), timer);
    timer = timer.resume('approval', sample(7));
    assert.equal(timer.elapsed(sample(100)), 2n);
    timer = timer.resume('question', sample(10));
    assert.equal(timer.elapsed(sample(12)), 4n);
    assert.equal(timer.resume('missing', sample(30)), timer);
});
test('tests.runtime.timing.test_clock.StatusTimerTests.test_reset_preserves_an_open_modal_and_freezing_survives_restart', () => {
    let timer = StatusTimer.start(sample(0)).pause('question', sample(2)).reset(sample(10), 5n);
    assert.equal(timer.elapsed(sample(99)), 5n);
    timer = timer.resume('question', sample(100)).finish(sample(103));
    assert.equal(StatusTimer.load(timer.toDict())!.elapsed(sample(1000)), 8n);
});
test('tests.runtime.timing.test_clock.StatusTimerTests.test_uptime_ignores_wall_clock_adjustment_and_includes_suspend', () => {
    assert.equal(delta(sample(100, 10, 'boot'), sample(500, 20, 'boot')), 10n);
    assert.equal(delta(sample(100, 10, 'boot'), sample(80, 20, 'boot')), 10n);
    assert.equal(delta(sample(100, 10, 'boot'), sample(105, 5, 'new')), 5n);
    assert.equal(delta(sample(100), sample(80)), null);
});
test('tests.runtime.timing.test_clock.StatusTimerTests.test_confirmed_resume_reopens_the_same_clock_origin', () => {
    assert.equal(StatusTimer.start(sample(1)).finish(sample(3)).reopen().finish(sample(9)).elapsed(sample(99)), 8n);
});
test('tests.runtime.timing.test_clock.StatusTimerTests.test_clock_loss_during_a_wait_survives_restore_and_hides_precision', () => {
    const timer = StatusTimer.start(sample(0, 0, 'boot')).pause('question', sample(2, 2, 'boot')).resume('question', sample(5)).finish(sample(8, 8, 'boot'));
    assert.equal(StatusTimer.load(timer.toDict())!.degraded, true);
});
test('tests.runtime.timing.test_clock.StatusTimerTests.test_reboot_and_backwards_uptime_cannot_claim_execution_coverage', () => {
    const timer = StatusTimer.start(sample(100, 10, 'boot'));
    assert.equal(timer.trustedSample(sample(110, 5, 'reboot')), false);
    assert.equal(timer.trustedSample(sample(110, 9, 'boot')), false);
    assert.equal(timer.finish(sample(110, 5, 'reboot')).degraded, true);
});
test('tests.runtime.timing.test_clock.StatusTimerTests.test_a_wait_ending_before_its_start_invalidates_precision', () => {
    assert.equal(StatusTimer.start(sample(0, 0, 'boot')).pause('q', sample(5, 5, 'boot')).resume('q', sample(3, 3, 'boot')).degraded, true);
});
test('post-baseline Windows GUID reuse degrades even after uptime catches up', () => {
    const path = fileURLToPath(new URL('../../../../tools/migration/ts-02/fixtures/windows-reboot.json', import.meta.url));
    const fixture = readJson(readFileSync(path, 'utf8')) as Record<string, unknown>, start = loadSample(fixture.before)!, end = loadSample(fixture.after)!;
    assert.equal(delta(start, end), end.wall_ns - start.wall_ns);
    assert.equal(StatusTimer.start(start).trustedSample(end), false);
    assert.equal(StatusTimer.start(start).finish(end).degraded, true);
    const later = { ...end, boot_ns: start.boot_ns! + 1n };
    assert.equal(StatusTimer.start(start).trustedSample(later), false);
});
test('versioned Windows domains preserve clock adjustments and lossless frozen durations', () => {
    const id = 'windows:v2:a37ac4ce-5dc5-11ee-ba22-d380a9a2ae53:41', start = sample(1000, 100, id), timer = StatusTimer.start(start);
    assert.equal(delta(start, sample(1, 130, id)), 30n);
    assert.equal(timer.trustedSample(sample(1, 130, id)), true);
    const reboot = sample(2000, 5, id.slice(0, -2) + '42');
    assert.equal(delta(start, reboot), 1000n);
    assert.equal(timer.trustedSample(reboot), false);
    const legacy = sample(1000, 100, 'windows:a37ac4ce-5dc5-11ee-ba22-d380a9a2ae53');
    assert.equal(delta(legacy, start), 0n);
    const restored = StatusTimer.load({ accumulated_ns: 0n, last_resume: legacy, frozen_ns: 9007199254740993n })!;
    assert.equal(restored.elapsed(reboot), 9007199254740993n);
    assert.equal(taskElapsed({ status: 'complete', duration_ns: 9007199254740993n }, reboot), 9007199254740993n);
});
