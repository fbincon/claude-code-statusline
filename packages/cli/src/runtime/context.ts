import { join, resolve } from 'node:path';
import { sample } from '@fbincon/statusline-platform/clocks';
import { processToken } from '@fbincon/statusline-platform/processes';
import { expandUser } from '@fbincon/statusline-platform/commands';
import type { Sample } from '@fbincon/statusline-core/timing/sample';
export interface RuntimeContext {
    configDir: string;
    runtimeRoot: string;
    cacheRoot: string;
    sessionsDir: string;
    sample(): Sample;
    nowMs(): number;
    processToken(pid: number): string | null;
}
export function runtimeContext(configDir?: string, environment: NodeJS.ProcessEnv = process.env): RuntimeContext {
    const directory = resolve(expandUser(configDir ?? environment.CLAUDE_CONFIG_DIR ?? '~/.claude'));
    return { configDir: directory, runtimeRoot: environment.CLAUDE_STATUSLINE_RUNTIME_DIR || join(directory, 'statusline_runtime'),
        cacheRoot: environment.CLAUDE_STATUSLINE_RUNTIME_DIR ?? directory, sessionsDir: environment.CLAUDE_STATUSLINE_SESSIONS_DIR ?? join(directory, 'sessions'),
        sample, nowMs: () => Date.now(), processToken };
}
