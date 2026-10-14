import type { Sample } from '@fbincon/statusline-core/timing/sample';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';

/** All environment-sensitive application inputs are explicit at service boundaries. */
export interface Context {
  configDir: string;
  runtimeDir: string;
  sessionsDir: string;
  launch: LaunchSpec;
  sample: () => Sample;
  hostVersion: () => readonly number[] | null;
}
