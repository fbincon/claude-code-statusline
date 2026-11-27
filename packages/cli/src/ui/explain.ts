import type { ExplanationFacts } from '@fbincon/statusline-core/rendering/explain';
import type { ConfigurationService } from '../config/service.js';
import { readSettings } from '../config/storage.js';
import { installationIdentity } from '../config/host.js';
import { loadRuntime } from '../config/runtime-preferences.js';
import { revision } from '@fbincon/statusline-platform/hash';
import { readAgentRowRoute } from '../integration/agent-row-state.js';
import { VERSION } from '../integration/model.js';
import { hasAgentRowBinding } from '../config/agent-rows.js';

/** Reads only attributable configuration. No locks, repair, runtime stores or collectors. */
export function explanationFacts(service: ConfigurationService): ExplanationFacts {
  const result: ExplanationFacts={installation:{main:'unknown',subagent:'unknown'},host_version:null,runtime:null};
  try {
    const [settings]=readSettings(service.context.configDir,service.io);
    const identity=installationIdentity(settings,service.context.launch);
    for(const [scope,key] of [['main','statusLine'],['subagent','subagentStatusLine']] as const) {
      const state=identity[key]?.state;
      if(state==='owned'||state==='absent'||state==='foreign') result.installation[scope]=state;
    }
    if (result.installation.subagent === 'absent') {
      const route = readAgentRowRoute(service.context.configDir);
      if (route?.mode === 'mod' && route.backendVersion === VERSION && route.launchRevision === revision(service.context.launch) &&
          hasAgentRowBinding(settings, route.installationId))
        result.installation.subagent = 'owned';
    }
  } catch { /* Unreadable configuration is unknown, never absent. */ }
  try { result.runtime=loadRuntime(service.context.configDir,service.io); } catch { /* Retain unknown; never repair. */ }
  try { result.host_version=service.context.hostVersion(); } catch { /* Retain unknown. */ }
  return result;
}
