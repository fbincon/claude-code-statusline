import type { DisplayDraft, ProfileCollection } from '@fbincon/statusline-core/contracts/ui';
import { object } from '@fbincon/statusline-core/config/validation';
import { AGENT_ROWS } from '../integration/model.js';

/** Unbound profiles are portable drafts and do not request a host integration. */
export function configuredAgentRows(display: DisplayDraft, profiles?: ProfileCollection | null): boolean {
    return display.subagents.enabled || Boolean(profiles?.bindings.some(binding =>
        profiles.profiles.some(profile => profile.id === binding.profile_id && profile.display.subagents.enabled)));
}

/** Cheap configuration evidence for editors; doctor also validates the cached plugin bytes. */
export function hasAgentRowBinding(settings: Record<string, unknown>, installationId: string | null): boolean {
    const plugin = object(settings.pluginConfigs) ? settings.pluginConfigs[AGENT_ROWS.plugin] : null;
    return installationId !== null && object(settings.enabledPlugins) && settings.enabledPlugins[AGENT_ROWS.plugin] === true &&
        object(plugin) && object(plugin.options) && plugin.options.installationId === installationId;
}
