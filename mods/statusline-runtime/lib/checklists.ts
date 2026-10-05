/** Only successful structured tool records contribute; no text heuristics. */
type Task = { id: string; status: string };
type Change = { kind: 'task_snapshot' | 'task_update'; payload: Record<string, unknown> };
const statuses = new Set(['pending', 'in_progress', 'completed', 'deleted']);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function task(value: unknown): Task | null {
  const row = record(value);
  if (!row || (typeof row.id !== 'string' && typeof row.id !== 'number') ||
      typeof row.status !== 'string' || !statuses.has(row.status)) return null;
  return { id: String(row.id), status: row.status };
}

export function checklist(tool: string, input: unknown, result: unknown): Change | null {
  const args = record(input);
  const output = record(result);
  if (!args || !output) return null;
  if (tool === 'TodoWrite' || tool === 'TaskList') {
    const rows = tool === 'TodoWrite' ? output.newTodos : output.tasks;
    if (!Array.isArray(rows) || rows.length > 1000) return null;
    const tasks: Task[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = record(rows[i]);
      const parsed = task(tool === 'TodoWrite' && row ? { ...row, id: String(i) } : row);
      if (!parsed) return null;
      tasks.push(parsed);
    }
    if (new Set(tasks.map(row => row.id)).size !== tasks.length) return null;
    return { kind: 'task_snapshot', payload: { provider: tool === 'TodoWrite' ? 'todos' : 'tasks', tasks } };
  }
  if (tool === 'TaskCreate') {
    const created = task(output.task);
    return created ? { kind: 'task_update', payload: { provider: 'tasks', ...created } } : null;
  }
  if (tool === 'TaskUpdate' && output.success === true &&
      (typeof args.taskId === 'string' || typeof args.taskId === 'number') &&
      typeof args.status === 'string' && statuses.has(args.status)) {
    return { kind: 'task_update', payload: { provider: 'tasks', id: String(args.taskId), status: args.status } };
  }
  return null;
}
