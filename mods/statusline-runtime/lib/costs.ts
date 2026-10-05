/** Whitelist official collector attributes; never enable or redirect exporters. */
import type { TelemetryLogInput } from 'claude-code';
import { usage } from './streams.ts';

export function promptLink(e: TelemetryLogInput, session: string) {
  if (e.to !== 'collector' || !['user_prompt', 'claude_code.user_prompt'].includes(e.event)) return null;
  const a = e.attributes;
  if (a['session.id'] !== session || a['workflow.run_id'] || a.command_name ||
      typeof a['prompt.id'] !== 'string' || typeof a['message.uuid'] !== 'string') return null;
  return { identity: { prompt_id: a['prompt.id'] }, payload: { message_id: a['message.uuid'] } };
}

export function cost(e: TelemetryLogInput, session: string, agentTypes: readonly string[]) {
  if (e.to !== 'collector' || !['api_request', 'claude_code.api_request'].includes(e.event)) return null;
  const a = e.attributes;
  if (a['session.id'] !== session || a['workflow.run_id'] ||
      typeof a['prompt.id'] !== 'string' || typeof a.request_id !== 'string' ||
      !['repl_main_thread', ...agentTypes].includes(String(a.query_source))) return null;
  const usd = typeof a.cost_usd === 'number' ? a.cost_usd :
    typeof a.cost_usd_micros === 'number' && Number.isSafeInteger(a.cost_usd_micros) ? a.cost_usd_micros / 1000000 : null;
  if (usd === null || !Number.isFinite(usd) || usd < 0) return null;
  return {
    identity: { prompt_id: a['prompt.id'], request_id: a.request_id },
    payload: { cost_usd: usd, usage: usage({
      input_tokens: a.input_tokens, output_tokens: a.output_tokens,
      cache_read_input_tokens: a.cache_read_tokens, cache_creation_input_tokens: a.cache_creation_tokens,
    }) },
  };
}
