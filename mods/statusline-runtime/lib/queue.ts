/** Bounded, retryable batches. Host access belongs to the hooks entry. */
import type { Observation, Kind, Source } from './generated-contracts.ts';

export type Identity = Partial<Pick<Observation,
  'prompt_id' | 'agent_id' | 'parent_agent_id' | 'turn_id' | 'request_id'>>;

export class Queue {
  pending: Observation[] = [];
  sequence = 0;
  session = '';
  epoch = '';
  loadedAt = 0;
  dropped = false;

  bind(session: string, loadedAt: number): void {
    this.session = session;
    this.loadedAt = loadedAt;
    this.epoch = String(loadedAt) + '-' + Math.random().toString(16).slice(2);
    this.sequence = 0;
    this.pending = [];
    this.dropped = false;
  }

  push(kind: Kind, payload: Record<string, unknown>, at: number,
       identity: Identity = {}, source: Source = 'native'): void {
    if (!this.session) return;
    const record: Observation = {
      session_id: this.session, epoch: this.epoch, seq: this.sequence++,
      observed_at_ms: at, source, kind,
      prompt_id: identity.prompt_id ?? null, agent_id: identity.agent_id ?? null,
      parent_agent_id: identity.parent_agent_id ?? null, turn_id: identity.turn_id ?? null,
      request_id: identity.request_id ?? null, payload,
    };
    // Preserve the initial heartbeat even when an unavailable backend fills the queue.
    if (this.pending.length >= 1024) {
      this.dropped = true;
      this.pending.splice(this.pending[0]?.kind === 'heartbeat' ? 1 : 0, 1);
    }
    this.pending.push(record);
  }

  batch(): Observation[] { return this.pending.slice(0, 256); }

  acknowledge(batch: readonly Observation[]): void {
    const acknowledged = new Set(batch.map(row => row.epoch + ':' + row.seq));
    this.pending = this.pending.filter(row => !acknowledged.has(row.epoch + ':' + row.seq));
  }
}

export function confirmedResponse(stdout: string, expected: string, count?: number): boolean {
  try {
    const value = JSON.parse(stdout) as Record<string, unknown>;
    const result = value.result as Record<string, unknown> | undefined;
    return value.protocol_version === 1 && result !== undefined &&
      typeof result.backend_version === 'string' && (!expected || result.backend_version === expected) &&
      typeof result.enabled === 'boolean' &&
      typeof result.accepted === 'number' && Number.isInteger(result.accepted) && result.accepted >= 0 &&
      typeof result.ignored === 'number' && Number.isInteger(result.ignored) && result.ignored >= 0 &&
      (count === undefined || result.accepted + result.ignored === count);
  } catch { return false; }
}
