import { expect, test } from 'claude-code/testing';
import { setup, START, RUN, PANE, reply, keys, output, visibleText } from '../fixtures.ts';
import type { SourceDefinition, SourceInspection, SourceJob, SourcesResult } from '../../lib/generated-contracts.ts';

const context = { project: null, session: null, agent: null, branch: null, head: null };
const local: SourceDefinition = {
  id: 'local', name: 'Local', kind: 'json', scope: { project: null, session: null, agent: null },
  ttl_seconds: 300, settings: { path: '/value.json', pointer: '/value', observed_at_pointer: '/observed_at', unit: '' },
  enabled: true, revision: 'r1',
};
const library: SourcesResult = {
  version: 2, automatic: [], revision: '1'.repeat(64), bindings: [{ id: 'binding', source_id: 'local' }], sources: [local],
};
const back = { key: 'g', ctrl: true } as const;
const open = { key: 'y', ctrl: true } as const;

function report(job: SourceJob | null): SourceInspection {
  const completed = job?.state === 'completed';
  return {
    source: local, jobs: job ? [job] : [], last_success: null,
    checks: [], checks_observed_at: null, checks_context: null, offset: 0, total: 0,
    view: { source_id: 'local', name: 'Local', state: completed ? 'valid' : 'missing',
      reason: completed ? 'valid' : 'not_refreshed', value: completed ? 42 : null, observed_at: null,
      freshness: 'unknown', unit: null },
    automatic: { state: 'off', reason: 'off', next_at: null, last_attempt: null, last_success: null, interval_seconds: 300 },
  };
}

function refreshJob(owner: string, id: string): SourceJob {
  const deadline = '2026-10-28T00:00:05Z';
  return {
    version: 4, consumers: [{ owner, expires_at: deadline }], trigger: 'manual', identity: 'a'.repeat(64),
    id, source_id: local.id, source_revision: local.revision, owner, context, started_at: '2026-10-28T00:00:00Z',
    deadline_at: deadline, state: 'running', reason: 'running', result: null,
  };
}

test('unknown native save keeps source inspection and refresh available while blocking binding changes', async ($, on) => {
  const f = setup(on);
  const binding = { binding: 'binding', hint: 'Local' };
  f.store.draft.display.instances.push({
    ...JSON.parse(JSON.stringify(f.store.draft.display.instances[0]!)), id: 'external',
    type_id: 'external-value', source: binding,
  });
  let job: SourceJob | null = null;
  f.behavior.process = (request, next) => {
    if (request.operation === 'sources_read') return { value: reply(library) };
    if (request.operation === 'source_context') return { value: reply(context) };
    if (request.operation === 'source_inspect') return { value: reply(report(job)) };
    if (request.operation === 'source_refresh') {
      job = refreshJob(request.payload.owner, 'pending-refresh');
      return { value: reply(job) };
    }
    if (request.operation === 'source_release') return { value: reply({ ...job, state: 'cancelled', reason: 'no_consumers' }) };
    const result = next();
    return request.operation === 'apply' ? { value: output('{') } : result;
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, '4', ' ', 's', open, 'return');
  expect(f.calls.some(call => call.operation === 'source_draft' && call.payload.close === false && call.payload.bindings.includes(binding.binding))).toBe(true);
  expect(await visibleText(ui)).toContain('Check the display save before changing bindings.');
  expect(await visibleText(ui)).not.toContain('Bind to a component');
  await keys(ui, 'down', 'return');
  expect(await visibleText(ui)).toContain('No value');
  expect(f.calls.filter(call => call.operation === 'sources_apply').length).toBe(0);
  await keys(ui, back, 'home', 'return');
  expect(f.calls.filter(call => call.operation === 'source_refresh').length).toBe(1);
  await ui.press({ key: 'close' });
  expect(f.calls.filter(call => call.operation === 'source_release').length).toBe(0);
  await keys(ui, back, back, back, 'k');
  expect(f.calls.filter(call => call.operation === 'source_release').length).toBe(1);
  expect(f.calls.filter(call => call.operation === 'apply').length).toBe(1);
  expect(f.store.draft.display.instances.find(node => node.id === 'external')!.source).toEqual(binding);
  await ui.unmount();
});

test('native source management follows an explicit refresh and reads it again on demand', async ($, on) => {
  const f = setup(on);
  const before = JSON.stringify(f.store.draft);
  let job: SourceJob | null = null;
  f.behavior.process = (request, next) => {
    if (request.operation === 'sources_read') return { value: reply(library) };
    if (request.operation === 'source_context') return { value: reply(context) };
    if (request.operation === 'source_inspect') return { value: reply(report(job)) };
    if (request.operation === 'source_refresh') {
      job = refreshJob(request.payload.owner, 'local-refresh');
      return { value: reply(job) };
    }
    if (request.operation === 'source_status') {
      job = { ...job!, state: 'completed', reason: 'valid' };
      return { value: reply(job) };
    }
    if (request.operation === 'source_release') return { value: reply({ ...job, state: 'cancelled', reason: 'cancelled' }) };
    return next();
  };
  await $.session.start(START);
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, open, 'return');
  expect(f.calls.some(call => call.operation === 'source_refresh')).toBe(false);
  await keys(ui, 'return');
  expect(await visibleText(ui)).toContain('Value 42');
  const reads = f.calls.filter(call => call.operation === 'source_status').length;
  expect(reads).toBe(1);
  await keys(ui, 'r');
  expect(await visibleText(ui)).toContain('Value 42');
  expect(await visibleText(ui)).toContain('Refresh completed');
  expect(await visibleText(ui)).not.toContain('Refresh is running.');
  expect(f.calls.filter(call => call.operation === 'source_status').length).toBe(reads + 1);
  await keys(ui, back, back, back);
  expect(f.calls.filter(call => call.operation === 'source_release').length).toBe(0);
  expect(JSON.stringify(f.store.draft)).toBe(before);
  await ui.unmount();
});

test('native source inspection uses the confirmed host project and session without refreshing', async ($, on) => {
  const f = setup(on);
  await $.session.start(START);
  f.behavior.process = (request, next) => {
    if (request.operation === 'sources_read')
      return { value: reply({ version: 3, sources: [], bindings: [], automatic: [], revision: 'a'.repeat(64) }) };
    if (request.operation === 'source_context')
      return { value: reply({ project: START.cwd, session: request.payload.session, agent: null, branch: null, head: null }) };
    if (request.operation === 'source_draft') return { value: reply({ revision: 'pins' }) };
    return next();
  };
  await $.command.run(RUN);
  const ui = await $.ui.mount(PANE);
  await keys(ui, open);
  const observed = f.calls.find(call => call.operation === 'source_context')?.payload;
  expect(observed.project).toBe(START.cwd);
  expect(typeof observed.session).toBe('string');
  expect(observed.session.length > 0).toBe(true);
  expect(observed.agent).toBe(null);
  expect(f.calls.some(call => call.operation === 'source_refresh')).toBe(false);
  await ui.unmount();
});
