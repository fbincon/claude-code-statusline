import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import type { Sample } from '@fbincon/statusline-core/timing/sample';
import type { LocalizedText } from '@fbincon/statusline-core/i18n/messages';
import type { ObserveOperation } from '@fbincon/statusline-tui/session';

// Execution status uses the execution's retained control, outside this process.
const localReads = ['task_details', 'read_ui_preferences', 'package_review_status', 'source_status',
    'source_inspect', 'sources_read', 'profiles_read'] as const satisfies readonly ObserveOperation[];
export type LocalRead = typeof localReads[number];
export const isLocalRead = (value: unknown): value is LocalRead => localReads.some(operation => operation === value);

export interface ObservationMessage {
    operation: LocalRead;
    payload: unknown;
    configDir: string;
    launch: LaunchSpec;
    hostVersion?: readonly number[] | null;
    taskRuntime?: { root: string; now: number; sample: Sample };
}
export interface VerifyControlMessage { operation: 'verify_retained_control'; configDir: string; id: string; entry: string }
export type ObservationReply = { result: unknown } | { hostProbe: LaunchSpec | null }
    | { error: { code: string; message: string; localization: LocalizedText | null } };
