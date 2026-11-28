import type { InstanceDraft, SourceContext, SourceDefinition } from '../contracts/ui.js';

export function sameContext(a: SourceContext, b: SourceContext): boolean {
  return (['project', 'session', 'agent', 'branch', 'head'] as const).every(key => a[key] === b[key]);
}

/** Cache only declared scope and supplied input identities. */
export function observationContext(source: SourceDefinition, actual: SourceContext): SourceContext {
  const inputs = Object.values(source.settings.input ?? {});
  const git = source.kind === 'github';
  return {
    project: source.scope.project !== null || git || inputs.some(key => ['project', 'branch', 'head'].includes(key)) ? actual.project : null,
    session: source.scope.session !== null || inputs.includes('session') || inputs.includes('agent') ? actual.session : null,
    agent: source.scope.agent !== null || inputs.includes('agent') ? actual.agent : null,
    branch: git || inputs.includes('branch') ? actual.branch : null,
    head: git || inputs.includes('head') ? actual.head : null,
  };
}

/** Matching a local source never authorizes it or collects an observation. */
export function compatibleSource(node: InstanceDraft, source: SourceDefinition, context: SourceContext | null): boolean {
  if (node.type_id === 'external-value' ? !['json','command'].includes(source.kind) : !['github-pr','github-ci'].includes(node.type_id) || source.kind !== 'github') return false;
  return (['project','session','agent'] as const).every(key => source.scope[key] === null || source.scope[key] === context?.[key]);
}
