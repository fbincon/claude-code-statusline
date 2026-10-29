import type { DisplayDraft, Draft } from '@fbincon/statusline-core/contracts/ui';
import { repairStructure } from '@fbincon/statusline-core/editor/structure';
import { clone } from '@fbincon/statusline-core/editor/history';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { UNCHANGED, draft, type ConfigurationService, type MutationResult } from './service.js';
import { ArgumentError } from './arguments.js';

export function structuralFlags(flags: Record<string, unknown>): boolean {
  return ['dry-run','expected-revision','accept-alignments'].some(key => flags[key] !== undefined);
}
/** Review and commit use the same builder; the final revision check is inside the lock. */
export function structuralOperation(service: ConfigurationService, flags: Record<string, unknown>, action: string,
  build: (display: DisplayDraft) => DisplayDraft): string | MutationResult {
  const current = service.read(), expected = flags['expected-revision'];
  if (expected !== undefined && (typeof expected !== 'string' || !/^[a-f0-9]{64}$/u.test(expected))) throw new ArgumentError('Invalid --expected-revision');
  const proposal = (base: Draft) => {
    try {
      const detached = clone(base.display), alignments = detached.layout.alignments;
      delete detached.layout.alignments;
      const display = build(detached);
      if (alignments !== undefined) display.layout.alignments = alignments;
      return repairStructure(base, { ...base, display });
    } catch (error) {
      if (error instanceof ConfigError) throw error;
      throw new ConfigError(action.startsWith('config-group-') ? 'composition.groups.invalid' : 'composition.invalid');
    }
  };
  const review = proposal(draft(current));
  if (flags['dry-run']) return pythonJson({ expected_revision: current.revision, ...review }, { ensureAscii:false, indent:2 });
  if (review.repairs.length && expected === undefined) throw new ArgumentError('Alignment repairs require --dry-run review, --expected-revision and --accept-alignments');
  const accepted = typeof flags['accept-alignments'] === 'string' ? flags['accept-alignments'].split(',').filter(Boolean).sort() : [];
  return service.mutate(action, (display, settings, host) => {
    if (service.snapshot(display,settings).revision !== (expected ?? current.revision)) throw new ConfigError('profiles.error.conflict', {}, 'configuration_conflict');
    const final = proposal({ display, host });
    if (JSON.stringify(accepted) !== JSON.stringify(final.repairs.map(r=>r.id).sort())) throw new ConfigError('alignment.references', {ids:final.repairs.map(r=>r.id).join(', ')});
    return [final.draft.display, UNCHANGED];
  });
}
