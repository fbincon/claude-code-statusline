import type { RenderTrace } from './trace.js';
import type { Data } from '../runtime/values.js';
import type { Sample } from '../timing/sample.js';
import type { SessionTokenCounts } from '../runtime/usage.js';
import type { DirectoryStyle } from '../contracts/ui.js';
import type { Presentation } from './language.js';
import type { DateFormatter } from './preferences.js';
export interface UsageObservation {
    hit: string;
    miss: string;
    out: string;
    last_prompt: unknown;
    entry: Data;
    counts: SessionTokenCounts | null;
}
export interface TaskObservation {
    state: Data | null;
    sample: Sample;
}
/** The renderer calls only selected sources; providers own all platform effects. */
export interface RenderEnvironment {
    trace?: RenderTrace;
    language: Presentation;
    compactStaged: boolean;
    now(): number;
    directory(value: string, style: DirectoryStyle, project?: string | null): string;
    basename(value: string): string;
    formatDate: DateFormatter;
    hostname(): string | null;
    git(cwd: string, session: unknown): Data;
    branchDiff(cwd: string | null, base: string | null): Data;
    usage(data: unknown): UsageObservation | null;
    task(data: unknown, usage: UsageObservation): TaskObservation;
    activePoint(data: unknown): Data;
    hadSubagents(data: unknown): boolean;
    live(data: unknown, nowMs: number): Data;
    agentEndings(session: string): Data;
}
