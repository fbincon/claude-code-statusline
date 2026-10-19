import test from 'node:test';
import { setup, fs, join, assert, writeLines, allFiles } from './runtime-support.js';
import { UsageIndex } from '../src/runtime/usage-index.js';
import { UsageCollector } from '../src/runtime/usage.js';
import { runtimeIO } from '../src/runtime/io.js';
import { BASE, sessionTokenCounts, type UsageEntry } from '@fbincon/statusline-core/runtime/usage';
import { dictionary } from '@fbincon/statusline-core/runtime/values';

const entry = (): UsageEntry => ({ base: { ...BASE }, files: dictionary(), ids: dictionary() });
const counters = (i: bigint) => ({ ...BASE, i });
const assistant = (id: string, input_tokens = 1) => ({ type: 'assistant', message: { id, usage: { input_tokens } } });

test('one index transaction publishes only the final page and manifest while retaining per-field maxima', t => {
    const f = setup(t), io = runtimeIO(), writes: string[] = [], write = io.write;
    io.write = (path, bytes) => { writes.push(path); write(path, bytes); };
    const directory = join(f.root, 'index'), index = new UsageIndex(directory, f.root, io, null), state = entry();
    index.merge({ a: counters(1n) }, state);
    index.merge({ a: counters(3n), b: counters(2n) }, state);
    index.merge({ a: { ...counters(2n), o: 7n } }, state);
    assert.equal(writes.length, 0);
    const reference = index.publish();
    assert.equal(writes.filter(path => /\/b-/u.test(path)).length, 1);
    assert.equal(writes.filter(path => /\/m-/u.test(path)).length, 1);
    const reloaded = new UsageIndex(directory, f.root, io, reference);
    state.base.i = 3n; delete state.ids.a;
    reloaded.merge({ a: counters(4n) }, state);
    assert.equal(state.base.i, 0n);
    assert.deepEqual(state.ids.a, { ...counters(4n), o: 7n });
});

test('staging overflow flushes durable pages without changing the manifest, counters or reload behavior', t => {
    const f = setup(t), directory = join(f.root, 'bounded'), state = entry();
    const index = new UsageIndex(directory, f.root, runtimeIO(), null, 1);
    index.merge({ a: counters(9007199254740993n) }, state);
    assert.equal(fs.readdirSync(directory).some(name => name.startsWith('b-')), true);
    assert.equal(fs.readdirSync(directory).some(name => name.startsWith('m-')), false);
    const reference = index.publish();
    const next = entry(), reloaded = new UsageIndex(directory, f.root, runtimeIO(), reference);
    next.base.i = 9007199254740993n;
    reloaded.merge({ a: counters(9007199254740994n) }, next);
    assert.equal(next.base.i, 0n);
    assert.equal(next.ids.a!.i, 9007199254740994n);
});

test('buffered and immediate durable publication retain byte-identical page and manifest formats', t => {
    const f = setup(t);
    const run = (name: string, bound: number) => {
        const directory = join(f.root, name), index = new UsageIndex(directory, f.root, runtimeIO(), null, bound), state = entry();
        index.merge(Object.fromEntries(Array.from({ length: 5001 }, (_, i) => ['m-' + i, counters(BigInt(i))])), state);
        index.merge(Object.fromEntries(Array.from({ length: 100 }, (_, i) => ['m-' + i, counters(BigInt(i + 10))])), state);
        const reference = index.publish();
        index.prune();
        return { reference, files: allFiles(directory), state };
    };
    assert.deepEqual(run('buffered', 32 * 1024 * 1024), run('immediate', 0));
});

test('multi-agent cold collection writes each final identity page once and preserves restart/replay totals', t => {
    const f = setup(t), path = join(f.root, 'session.jsonl'), io = runtimeIO(), writes: string[] = [], write = io.write;
    io.write = (target, bytes) => { writes.push(target); write(target, bytes); };
    writeLines(path, Array.from({ length: 5001 }, (_, i) => assistant('main-' + i)));
    for (let i = 0; i < 8; i++) writeLines(join(f.root, 'session/subagents', `agent-${i}.jsonl`), Array.from({ length: 10 }, (_, n) => assistant(`agent-${i}-${n}`)));
    const data = { session_id: 's', transcript_path: path }, collector = new UsageCollector(f.context, io);
    assert.equal(sessionTokenCounts(collector.collect(data)![4])!.input_tokens, 5081n);
    const pages = writes.filter(target => /\/b-[a-f0-9]{64}\.json$/u.test(target));
    assert.equal(pages.length, new Set(pages).size);
    assert.equal(writes.filter(target => /\/m-[a-f0-9]{64}\.json$/u.test(target)).length, 1);
    assert.equal(fs.readdirSync(join(f.root, 'statusline_usage_v2'), { recursive: true }).map(String).filter(name => /b-[a-f0-9]{64}\.json$/u.test(name)).length, pages.length);
    writeLines(path, [assistant('main-0'), assistant('main-0', 2)], true);
    assert.equal(sessionTokenCounts(new UsageCollector(f.context).collect(data)![4])!.input_tokens, 5082n);
});

test('failed final page or manifest flush never commits a cursor, and retry uses the last committed reference', t => {
    const f = setup(t), path = join(f.root, 'session.jsonl'), data = { session_id: 's', transcript_path: path };
    writeLines(path, [assistant('before')]);
    const collector = new UsageCollector(f.context);
    collector.collect(data);
    const committed = fs.readFileSync(collector.path());
    writeLines(path, [assistant('after', 2)], true);
    for (const prefix of ['b-', 'm-']) {
        const io = runtimeIO(), write = io.write;
        io.write = (target, bytes) => {
            if (target.split(/[\\/]/u).at(-1)!.startsWith(prefix)) throw new Error('injected final flush failure');
            write(target, bytes);
        };
        assert.throws(() => new UsageCollector(f.context, io).collect(data), /injected/u);
        assert.deepEqual(fs.readFileSync(collector.path()), committed);
    }
    assert.equal(sessionTokenCounts(new UsageCollector(f.context).collect(data)![4])!.input_tokens, 3n);
});

test('failed transcript reads publish neither staged identities nor cursors', t => {
    const f = setup(t), path = join(f.root, 'session.jsonl'), data = { session_id: 's', transcript_path: path };
    writeLines(path, [assistant('before')]);
    const collector = new UsageCollector(f.context); collector.collect(data);
    const before = allFiles(f.root), io = runtimeIO(), lines = io.lines;
    writeLines(path, [assistant('after', 2)], true);
    const transcript = fs.readFileSync(path).toString('hex');
    io.lines = (...args) => { lines(...args); throw new Error('injected read failure'); };
    assert.equal(sessionTokenCounts(new UsageCollector(f.context, io).collect(data)![4])!.input_tokens, 1n);
    assert.deepEqual(allFiles(f.root), { ...before, 'session.jsonl': transcript });
});
