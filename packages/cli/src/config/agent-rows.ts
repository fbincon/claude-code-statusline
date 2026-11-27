import type { DisplayDraft, ProfileCollection } from '@fbincon/statusline-core/contracts/ui';

/** Unbound profiles are portable drafts and do not request a host integration. */
export function configuredAgentRows(display: DisplayDraft, profiles?: ProfileCollection | null): boolean {
    return display.subagents.enabled || Boolean(profiles?.bindings.some(binding =>
        profiles.profiles.some(profile => profile.id === binding.profile_id && profile.display.subagents.enabled)));
}
