/** Loaded only for the runtime v3 lifecycle operation, never ordinary observations. */
import { fileURLToPath } from 'node:url';
import type { RuntimeContext } from '../runtime/context.js';
import { ConfigurationService } from '../config/service.js';
import { createStorage } from '../config/storage.js';
import { SourceService } from './service.js';
import { AutomaticRefresh } from './automatic.js';
export function sourceLifecycle(context: RuntimeContext, payload: unknown) {
    const configuration = new ConfigurationService({ configDir: context.configDir, hostVersion: () => null,
        launch: { executable: process.execPath, args: [fileURLToPath(new URL('../entry.js', import.meta.url))] } }, createStorage(() => new Date(context.nowMs())));
    return new AutomaticRefresh(new SourceService(configuration, context.nowMs)).lifecycle(payload);
}
