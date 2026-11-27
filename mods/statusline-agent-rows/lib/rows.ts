import type { AgentInfo, RenderPropsOf } from 'claude-code';

export type RowProps = RenderPropsOf['AgentRow'];
export type Mode = 'mod' | 'standby' | 'pass';
export interface Reply {
  mode: Mode;
  rows: Map<string, string | undefined>;
  confirmation?: string;
}

/** Only the classic renderer's input fields cross the process boundary. */
export function taskOf(agent: AgentInfo) {
  return {
    id: agent.id, name: agent.name, type: agent.kind, agentType: agent.type,
    status: agent.taskStatus, label: agent.label, description: agent.description,
    startTime: agent.startTime, cwd: agent.cwd, model: agent.model, effort: agent.effort,
    tokenCount: agent.tokenCount, contextWindowSize: agent.contextWindowSize,
  };
}

type Entry = { parentId?: string; task: ReturnType<typeof taskOf>; key: string };

function entry(agent: AgentInfo): Entry {
  const task = taskOf(agent);
  return { parentId: agent.parentId, task, key: JSON.stringify([agent.parentId, task]) };
}

/** One ordered roster for row limits and one body budget per displayed level. */
export class Roster {
  readonly ids: string[];
  readonly columns: number;
  private readonly rows = new Map<string, Entry>();
  private readonly observed = new Map<string, Entry>();
  private readonly membership: Set<string>;
  revision = 0;

  constructor(ids: readonly string[], columns: number) {
    this.ids = [...ids];
    this.membership = new Set(ids);
    this.columns = columns;
  }

  matches(ids: readonly string[], columns: number) {
    return columns === this.columns && ids.length === this.ids.length && ids.every((id, i) => this.ids[i] === id);
  }

  observe(agent: AgentInfo) {
    const item = entry(agent);
    if ((this.observed.get(agent.id) ?? this.rows.get(agent.id))?.key === item.key) return;
    this.revision++;
    this.observed.set(agent.id, item);
  }

  snapshot(agents: readonly AgentInfo[]) {
    this.rows.clear();
    for (const agent of agents) {
      if (this.membership.has(agent.id)) this.rows.set(agent.id, entry(agent));
    }
    for (const [id, item] of this.observed) this.rows.set(id, item);
    if (this.rows.size !== this.ids.length) return null;
    this.observed.clear();
    const tasks = [];
    for (const id of this.ids) {
      const item = this.rows.get(id)!;
      const parents = new Set([id]);
      let ancestor = item.parentId;
      while (ancestor && this.rows.has(ancestor)) {
        if (parents.has(ancestor)) return null;
        parents.add(ancestor);
        ancestor = this.rows.get(ancestor)!.parentId;
      }
      tasks.push({ ...item.task, _row_columns: Math.max(0, this.columns - 2 * (parents.size - 1)) });
    }
    return tasks;
  }
}

export function usable(props: RowProps) {
  return (props.columns === undefined || Number.isSafeInteger(props.columns) && props.columns >= 0 && props.columns <= 10000) &&
    props.hasRow && Boolean(props.id) && Array.isArray(props.rowIds) && props.rowIds.includes(props.id) &&
    props.rowIds.every(id => typeof id === 'string' && id.length > 0) && new Set(props.rowIds).size === props.rowIds.length;
}

export function columnsOf(props: RowProps) {
  return props.columns ?? 80;
}

export function replyOf(stdout: string, ids: readonly string[]): Reply | null {
  const raw: unknown = JSON.parse(stdout);
  if (!raw || typeof raw !== 'object' || !('protocol' in raw) || raw.protocol !== 1 ||
      !('mode' in raw) || (raw.mode !== 'mod' && raw.mode !== 'standby' && raw.mode !== 'pass') ||
      !('rows' in raw) || !Array.isArray(raw.rows)) return null;
  const allowed = new Set(ids);
  const rows: Reply['rows'] = new Map();
  for (const row of raw.rows) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !allowed.has(row.id) || rows.has(row.id) ||
        ('body' in row && typeof row.body !== 'string')) return null;
    rows.set(row.id, row.body);
  }
  const confirmation = 'confirmation' in raw ? raw.confirmation : undefined;
  if (confirmation !== undefined && (typeof confirmation !== 'string' || !confirmation)) return null;
  return { mode: raw.mode, rows, confirmation };
}
