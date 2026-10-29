import type { InstanceDraft, SourceContext, SourceDefinition } from '../contracts/ui.js';
/** Matching a local source never authorizes it or collects an observation. */
export function compatibleSource(node: InstanceDraft, source: SourceDefinition, context: SourceContext | null): boolean {
  if (node.type_id === 'external-value' ? !['json','command'].includes(source.kind) : !['github-pr','github-ci'].includes(node.type_id) || source.kind !== 'github') return false;
  return (['project','session','agent'] as const).every(key => source.scope[key] === null || source.scope[key] === context?.[key]);
}
