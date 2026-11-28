import { BackendError } from '@fbincon/statusline-core/editor/backend';
import type { Editor } from '@fbincon/statusline-core/editor/draft';
import { receiveProfileList, type ProfileManager } from '@fbincon/statusline-core/editor/profile-manager';
import { receiveSources, type SourceManager } from '@fbincon/statusline-core/editor/source-manager';
import { clearSourceReadError, sourceObservationTarget, sourceReadFailed } from '@fbincon/statusline-core/editor/source-observation';
import type { TextKey } from '@fbincon/statusline-core/editor/text-input';
import { text, type LocalizedText } from '@fbincon/statusline-core/i18n/messages';
import type { RefreshTarget } from './foreground-refresh.js';
import { observeBackend } from './observation-backend.js';
import type { Backend } from './session.js';

const profileErrors = new WeakMap<ProfileManager, LocalizedText>();

function profileReadFailed(view: ProfileManager, error: unknown): boolean {
    const message = error instanceof BackendError && error.localization ? error.localization :
        text('profiles.failed', { value: error instanceof Error ? error.message : String(error) });
    const changed = JSON.stringify(view.message) !== JSON.stringify(message);
    profileErrors.set(view, message);
    view.message = message;
    return changed;
}

function clearProfileReadError(view: ProfileManager): boolean {
    if (view.message !== profileErrors.get(view)) return false;
    profileErrors.delete(view);
    view.message = null;
    return true;
}

function listTarget(view: SourceManager | ProfileManager, backend: Backend): RefreshTarget {
    const before = view.library;
    return {
        owner: view, key: 'list', interval: null,
        async read(signal) {
            if ('jobs' in view) {
                const result = await observeBackend(backend, 'sources_read', {}, signal);
                return () => {
                    if (signal.aborted || view.closed || view.page !== 'list' || view.library !== before) return false;
                    view.refreshList = false;
                    const cleared = clearSourceReadError(view);
                    if (result.revision === before?.revision) return cleared;
                    receiveSources(view, result);
                    return true;
                };
            }
            const result = await observeBackend(backend, 'profiles_read', {}, signal);
            return () => {
                if (signal.aborted || view.uncertain || view.page !== 'list' || view.library !== before) return false;
                view.refreshList = false;
                const cleared = clearProfileReadError(view);
                if (result.revision === before?.revision) return cleared;
                receiveProfileList(view, result);
                return true;
            };
        },
        failed: error => 'jobs' in view ? sourceReadFailed(view, error) : profileReadFailed(view, error),
    };
}

export function managerRefresh(editor: Editor, backend: Backend): RefreshTarget | null {
    if (editor.saveState !== 'idle' || editor.packageLocked) return null;
    const sources = editor.sources;
    if (sources && !sources.closed) {
        if (sources.page === 'list' && sources.library && sources.refreshList) return listTarget(sources, backend);
        const target = sourceObservationTarget(editor);
        return target && {
            ...target,
            read: (signal, reason) => target.read({ request: (operation, payload) => observeBackend(backend, operation, payload, signal) },
                reason === 'manual', () => !signal.aborted),
        };
    }
    const profiles = editor.profiles;
    return profiles?.page === 'list' && profiles.library && profiles.refreshList && !profiles.uncertain
        ? listTarget(profiles, backend) : null;
}

/** Reads with an active foreground target use the cancellable backend. */
export function manualManagerRefresh(editor: Editor, event?: TextKey): boolean {
    if (editor.saveState !== 'idle' || editor.packageLocked) return false;
    const sources = editor.sources;
    if (sources && !sources.closed && (!event || editor.shortcuts.action('sources', event) === 'reload-sources')) {
        if (sources.effect === 'observe-job' && sourceObservationTarget(editor)) {
            sources.effect = null;
            return true;
        }
        if (sources.page === 'list' && sources.effect === 'reload-library' && sources.library) {
            sources.effect = null;
            sources.refreshList = true;
            return true;
        }
    }
    const profiles = editor.profiles;
    if (profiles?.page === 'list' && !profiles.uncertain && profiles.effect?.kind === 'load' && profiles.library &&
        (!event || editor.shortcuts.action('profiles', event) === 'reload-profiles')) {
        profiles.effect = null;
        profiles.refreshList = true;
        return true;
    }
    return false;
}
