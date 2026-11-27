import type { PackageControl, ResultFor } from '@fbincon/statusline-core/contracts/ui';
import type { Backend } from './session.js';

export type ObserveOperation = 'task_details' | 'read_ui_preferences' | 'package_review_status' |
    'package_execute_status' | 'source_status' | 'source_inspect' | 'sources_read' | 'profiles_read';

/** Production sessions inject a cancellable reader. In-process backends use the same operations. */
export async function observeBackend<O extends ObserveOperation>(
    backend: Backend, operation: O, payload: unknown, signal: AbortSignal, control?: PackageControl,
): Promise<ResultFor<O>> {
    signal.throwIfAborted();
    if (backend.observe) return backend.observe(operation, payload, signal, control);
    const result = control && backend.control
        ? await backend.control(control, operation, payload)
        : await backend.request(operation, payload);
    signal.throwIfAborted();
    return result;
}
