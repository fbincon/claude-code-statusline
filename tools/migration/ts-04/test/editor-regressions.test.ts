import test from 'node:test';
import { fixture, assert, Session, frame } from './support.js';

for (const scope of ['main', 'subagent'] as const) {
    test(`external ${scope} text keys reach preview, preserve cancel bytes and survive save/reopen`, async t => {
        const f = await fixture(t), e = f.e, before = f.bytes();
        e.page = scope === 'main' ? 'main' : 'subagents';
        await f.session.key({ key: 'a', ctrl: true });
        e.selected[scope] = 'text';
        await f.session.key({ key: 'return' });
        const id = e.selected[scope];
        await f.session.key({ key: 'e', ctrl: true });
        await f.session.key({ key: 'return' });
        await f.session.key({ key: 'u', ctrl: true });
        const literal = '${model} 中文 日本語 한글 é 👩🏽‍💻';
        for (const key of literal) await f.session.key({ key });
        assert.equal(e.instance(scope, id)!.text, '');
        assert.deepEqual(f.bytes(), before);
        await f.session.key({ key: 'return' });
        const output = scope === 'main' ? f.state.preview!.main : f.state.preview!.subagents;
        assert.ok(output.some(row => row.map(span => span.text).join('').includes(literal)));
        assert.equal(e.instance(scope, id)!.options.label, null);
        assert.deepEqual(f.bytes(), before);
        await f.session.key({ key: 'g', ctrl: true });
        const cancelled = await f.session.key({ key: 'escape' });
        assert.equal(typeof cancelled === 'object' && cancelled?.outcome, 'cancelled');
        assert.deepEqual(f.bytes(), before);
        // Save the retained draft explicitly, then resolve the same instance identity.
        assert.equal((await f.session.save()).outcome, 'updated');
        const reopened = await Session.open(f.backend);
        assert.equal(reopened.state.editor.instance(scope, id)!.text, literal);
        assert.deepEqual(reopened.state.editor.draft, e.draft);
    });
}

test('picker guidance has no persistence or backend-preview side effects', async t => {
    const f = await fixture(t), before = f.bytes();
    await f.session.preview(80, 24);
    const previews = f.calls.filter(call => call.operation === 'preview').length;
    for (const scope of ['main', 'subagent'] as const) {
        f.e.page = scope === 'main' ? 'main' : 'subagents';
        await f.session.key({ key: 'a', ctrl: true });
        f.e.selected[scope] = scope === 'main' ? 'task-active-timer' : 'status';
        await f.session.key({ key: 'e', ctrl: true });
        frame(f.state, 80, 24);
        await f.session.key({ key: 'escape' });
        await f.session.key({ key: 'escape' });
    }
    assert.deepEqual(f.bytes(), before);
    assert.equal(f.calls.filter(call => call.operation === 'preview').length, previews);
    assert.equal(f.calls.some(call => call.operation === 'apply'), false);
});
