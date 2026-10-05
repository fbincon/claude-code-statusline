import { test, expect } from 'claude-code/testing';
import { checklist } from '../lib/checklists.ts';

test('structured checklist results preserve empty snapshots and reject malformed records', () => {
  expect(checklist('TaskList', {}, { tasks: [] })).toEqual({ kind: 'task_snapshot', payload: { provider: 'tasks', tasks: [] } });
  expect(checklist('TaskList', {}, { tasks: [{ id: '1', status: 'pending' }, { id: '1', status: 'completed' }] })).toBe(null);
  expect(checklist('TaskList', {}, { tasks: [{ id: '1', status: 'unknown' }] })).toBe(null);
  expect(checklist('TaskUpdate', { taskId: '1', status: 'completed' }, { success: false })).toBe(null);
  expect(checklist('TaskUpdate', { taskId: '1', status: 'completed' }, { success: true })).toEqual({
    kind: 'task_update', payload: { provider: 'tasks', id: '1', status: 'completed' },
  });
  expect(checklist('TodoWrite', {}, { newTodos: [{ content: 'private text', status: 'completed' }] })).toEqual({
    kind: 'task_snapshot', payload: { provider: 'todos', tasks: [{ id: '0', status: 'completed' }] },
  });
});
