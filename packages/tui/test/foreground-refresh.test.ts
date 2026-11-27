import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ACTIVE_REFRESH_MS, MAX_REFRESH_BACKOFF_MS, ForegroundRefresh, type RefreshReason, type RefreshTarget,
} from '../src/foreground-refresh.js';

type Apply = () => boolean;
type Page = Pick<RefreshTarget, 'owner' | 'key' | 'interval' | 'rereadOnManualJoin'>;
const turn = () => new Promise<void>(resolve => setImmediate(resolve));

function fixture(interval: number | null = ACTIVE_REFRESH_MS) {
    const page: Page = { owner: {}, key: 'a', interval };
    const state = { page: page as Page | null, now: 0 };
    const queued: Apply[] = [];
    const failures: unknown[] = [];
    const reads: { reason: RefreshReason; signal: AbortSignal; resolve(apply: Apply): void; reject(error: Error): void }[] = [];
    const scheduler = new ForegroundRefresh(() => state.page && {
        ...state.page,
        read(signal, reason) {
            return new Promise<Apply>((resolve, reject) => reads.push({ signal, reason, resolve, reject }));
        },
        failed(error) { failures.push(error); return true; },
    }, () => state.now);
    scheduler.bind(apply => queued.push(apply));
    const apply = async () => {
        await turn();
        assert.equal(queued.length, 1);
        return queued.shift()!();
    };
    return { scheduler, state, page, reads, queued, failures, apply };
}

test('entry and manual refresh work for a page without periodic reads', async () => {
    const f = fixture(null);
    f.scheduler.tick();
    f.scheduler.immediate();
    assert.deepEqual(f.reads.map(read => read.reason), ['entry']);
    f.reads[0]!.resolve(() => false);
    assert.equal(await f.apply(), false);
    f.state.now += 1_000_000;
    f.scheduler.tick();
    assert.equal(f.reads.length, 1);
    f.scheduler.immediate();
    f.scheduler.immediate();
    assert.deepEqual(f.reads.map(read => read.reason), ['entry', 'manual']);
    f.reads[1]!.resolve(() => true);
    assert.equal(await f.apply(), true);
    f.page.interval = ACTIVE_REFRESH_MS;
    f.state.now += ACTIVE_REFRESH_MS - 1;
    f.scheduler.tick();
    assert.equal(f.reads.length, 2);
    f.state.now++;
    f.scheduler.tick();
    assert.equal(f.reads[2]!.reason, 'automatic');
    f.scheduler.close();
    assert(f.reads[2]!.signal.aborted);
    f.reads[2]!.resolve(() => assert.fail('late apply'));
    await turn();
    assert.deepEqual(f.queued, []);
});

test('a task can coalesce one preference reread when manual refresh joins a periodic read', async () => {
    for (const reread of [true, false]) {
        const f = fixture();
        f.page.rereadOnManualJoin = reread;
        f.scheduler.tick();
        f.reads[0]!.resolve(() => true);
        await f.apply();
        f.state.now += ACTIVE_REFRESH_MS;
        f.scheduler.tick();
        f.scheduler.immediate();
        f.scheduler.immediate();
        f.reads[1]!.resolve(() => false);
        await turn();
        f.scheduler.immediate(); // The completed read still awaits the terminal queue.
        assert.equal(f.reads.length, 2);
        assert.equal(f.queued.shift()!(), false);
        assert.deepEqual(f.reads.map(read => read.reason), reread ? ['entry', 'automatic', 'manual'] : ['entry', 'automatic']);
        if (reread) {
            f.scheduler.immediate();
            f.reads[2]!.resolve(() => true);
            await f.apply();
            assert.equal(f.reads.length, 3);
        }
        f.scheduler.close();
    }
});

test('navigation and explicit invalidation discard returned snapshots even on a round trip to the same page', async () => {
    const f = fixture();
    f.scheduler.tick();
    f.reads[0]!.resolve(() => assert.fail('old page was applied'));
    await turn();
    f.state.page = { ...f.page, key: 'b' };
    f.scheduler.tick();
    f.state.page = f.page;
    f.scheduler.tick();
    assert(f.reads[0]!.signal.aborted);
    assert.equal(f.reads.length, 1);
    assert.equal(f.queued.shift()!(), false);
    assert.equal(f.reads[1]!.reason, 'entry');
    f.scheduler.invalidate();
    f.reads[1]!.reject(new Error('aborted request'));
    await turn();
    assert.equal(f.reads.length, 2, 'explicit invalidation waits for the foreground action to finish');
    f.scheduler.tick();
    assert.equal(f.reads[2]!.reason, 'entry');
    assert.deepEqual(f.failures, []);
    // A newly opened copy with the same key has a different owner. No tick is
    // needed between the last input change and rechecking the queued result.
    f.state.page = { ...f.page, owner: {} };
    f.reads[2]!.resolve(() => assert.fail('old owner was applied'));
    assert.equal(await f.apply(), false);
    assert.equal(f.reads[3]!.reason, 'entry');
    f.state.page = null;
    f.scheduler.tick();
    f.reads[3]!.resolve(() => assert.fail('hidden page was applied'));
    await turn();
    assert.deepEqual(f.queued, []);
    assert.equal(f.reads.length, 4);
});

test('read and apply failures back off to the cap, manual retry bypasses the delay and success restores cadence', async () => {
    const f = fixture();
    f.scheduler.tick();
    const failure = new Error('no snapshot');
    for (const [index, delay] of [4000, 8000, 16000, MAX_REFRESH_BACKOFF_MS, MAX_REFRESH_BACKOFF_MS].entries()) {
        if (index % 2) f.reads[index]!.resolve(() => { throw failure; });
        else f.reads[index]!.reject(failure);
        assert.equal(await f.apply(), true);
        assert.equal(f.failures.at(-1), failure);
        f.state.now += delay - 1;
        f.scheduler.tick();
        assert.equal(f.reads.length, index + 1);
        f.state.now++;
        f.scheduler.tick();
        assert.equal(f.reads.length, index + 2);
    }
    f.reads[5]!.reject(failure);
    await f.apply();
    f.scheduler.immediate();
    assert.equal(f.reads[6]!.reason, 'manual');
    f.reads[6]!.resolve(() => false);
    assert.equal(await f.apply(), false);
    f.state.now += ACTIVE_REFRESH_MS;
    f.scheduler.tick();
    assert.equal(f.reads[7]!.reason, 'automatic');
    f.scheduler.close();
    f.reads[7]!.reject(failure);
    await turn();
    assert.deepEqual(f.queued, []);
    assert.equal(f.failures.length, 6);
});
