/** Official task/message identity only; never retain prompt text. */
import type { TelemetryLogInput } from 'claude-code';

export function promptLink(e: TelemetryLogInput, session: string) {
  if (e.to !== 'collector' || !['user_prompt', 'claude_code.user_prompt'].includes(e.event)) return null;
  const a = e.attributes;
  if (a['session.id'] !== session || a['workflow.run_id'] || a.command_name ||
      typeof a['prompt.id'] !== 'string' || typeof a['message.uuid'] !== 'string') return null;
  return { identity: { prompt_id: a['prompt.id'] }, payload: { message_id: a['message.uuid'] } };
}

export function reportAgent(prompt: string): string | null {
  return /^\s*<task-notification>\s*<task-id>([^<>\s]+)<\/task-id>/.exec(prompt)?.[1] ?? null;
}
