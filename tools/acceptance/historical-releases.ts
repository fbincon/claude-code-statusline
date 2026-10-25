/** Public npm archives verified independently before adding them to acceptance. */
import { LEGACY_370_SHA256 } from '@fbincon/statusline-core/management/compatibility';
export const HISTORICAL_RELEASES = {
  '3.7.0': LEGACY_370_SHA256,
  '3.8.0': 'c11ebea864a0d472c779f87401fe2e96bfcd3d16120db0cf2661d50fd6339dbc',
} as const;
export type HistoricalRelease = keyof typeof HISTORICAL_RELEASES;
