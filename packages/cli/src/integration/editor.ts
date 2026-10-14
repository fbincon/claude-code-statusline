import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
/** TS-04 supplies the terminal adapter; the backend owns this request/result boundary. */
export interface EditorRequest {
    configDir: string;
    backend: LaunchSpec;
    cwd: unknown;
}
export interface EditorResult {
    outcome: 'updated' | 'already-current' | 'cancelled' | 'interrupted' | 'timed-out' | 'error';
    message?: unknown;
}
export type EditorLauncher = (request: EditorRequest) => EditorResult | Promise<EditorResult>;
export const UNAVAILABLE_MESSAGE = 'Interactive status line configuration is unavailable here.\nRun `claude-statusline configure` in a terminal, or use `/statusline-config`.';
export const unavailableEditor: EditorLauncher = () => ({ outcome: 'error', message: UNAVAILABLE_MESSAGE });
