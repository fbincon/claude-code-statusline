import { test, expect } from 'claude-code/testing';
import { WaitCoverage } from '../lib/timing.ts';
import { reportAgent } from '../lib/identity.ts';

test('unknown waits invalidate only their loop and reports retain agent identity', () => {
  const coverage = new WaitCoverage();
  coverage.mark('child', 't');
  coverage.mark('child', 't');
  expect(coverage.finish('main', 't')).toBe(true);
  expect(coverage.finish('child', 't')).toBe(false);
  expect(reportAgent('<task-notification><task-id>agent-1</task-id>')).toBe('agent-1');
  expect(reportAgent('ordinary human prompt')).toBe(null);
});
