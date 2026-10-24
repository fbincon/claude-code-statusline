/** Integration-test envelopes; product subprocess deadlines remain unchanged. */
export const VERSION_OPERATION_MS = 360_000;
export const VERSION_SEQUENCE_MS = 900_000;
export const OFFICIAL_VERSION_SEQUENCE_MS = 1_200_000;
// The existing installed suite and the new real-npm sequence run serially.
export const INSTALLED_SUITE_MS = 600_000 + VERSION_SEQUENCE_MS;
// Include the separate 60-second Windows shell preparation and cleanup.
export const RUNTIME_INSTALLATION_MS = INSTALLED_SUITE_MS + 90_000;
// Host transitions also install a fresh candidate and fetch the pinned archive.
export const OFFICIAL_TRANSITION_MS = OFFICIAL_VERSION_SEQUENCE_MS + 300_000;
