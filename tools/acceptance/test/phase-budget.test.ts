import test from 'node:test';
import assert from 'node:assert/strict';
import { VersionPhaseBudget } from '../phase-budget.js';

test('acceptance phases retain independent elapsed receipts and cannot restart', t => {
    let now = 0;
    const budget = new VersionPhaseBudget(1000, 2000, () => assert.fail('Unexpected expiry'), () => now);
    t.after(() => budget.close());
    now = 900; budget.beginEditor();
    assert.throws(() => budget.beginEditor(), /already started/);
    now = 2800;
    assert.deepEqual(budget.finish(), [{ phase: 'baseline', budget_ms: 1000, elapsed_ms: 900, status: 'pass' }, { phase: 'editor_execution', budget_ms: 2000, elapsed_ms: 1900, status: 'pass' }]);
    assert.throws(() => budget.finish());
});

test('an overdue baseline cannot borrow the new editor allowance even before its timer fires', t => {
    let now = 0;
    const budget = new VersionPhaseBudget(1000, 2000, () => {}, () => now);
    t.after(() => budget.close()); now = 1001;
    assert.throws(() => budget.beginEditor(), /expired: baseline/);
    assert.throws(() => budget.finish(), /expired: baseline/);
});

test('the hard phase timer stops pending asynchronous work from yielding passing evidence', async t => {
    const expired: string[] = [], budget = new VersionPhaseBudget(10, 1000, phase => expired.push(phase));
    t.after(() => budget.close());
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.deepEqual(expired, ['baseline']);
    assert.throws(() => budget.beginEditor(), /expired: baseline/);
    assert.throws(() => budget.finish(), /expired: baseline/);
});
