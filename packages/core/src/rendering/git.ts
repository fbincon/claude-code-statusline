import { object, truth, string, type Data } from '../runtime/values.js';
import { sanitizePayloadText } from './formatters.js';
import type { Presentation } from './language.js';
import type { Palette } from './palette.js';
export function changeMarkers(result: Data, compactStaged = false): string[] {
    return ([['staged', compactStaged ? '●' : '● '], ['unstaged', '~'], ['conflicts', '!'], ['untracked', '?']] as const).filter(([key]) => truth(result[key])).map(([key, symbol]) => symbol + string(result[key]));
}
export function divergenceMarkers(result: Data, language: Presentation, showZero = false): string[] {
    return truth(result.upstream_gone) ? [language.text('git.gone')] : ([['ahead', '↑'], ['behind', '↓']] as const).filter(([key]) => truth(result[key]) || showZero).map(([key, symbol]) => symbol + string(result[key]));
}
export function component(result: unknown, item: string, language: Presentation, compactStaged = false): string | null {
    if (!object(result) || result.kind === 'not_repo')
        return null;
    if (result.kind === 'error')
        return 'Git!';
    if (result.kind !== 'ok')
        return null;
    if (item === 'git-branch') {
        const branch = sanitizePayloadText(result.branch);
        return branch ? 'Git ' + branch : null;
    }
    if (item === 'git-changes') {
        const markers = changeMarkers(result, compactStaged);
        return 'Git ' + (markers.length ? markers.join(' ') : language.text('git.clean'));
    }
    return truth(result.upstream) ? 'Git ' + divergenceMarkers(result, language, true).join(' ') : null;
}
export function segment(result: Data, palette: Palette, language: Presentation, compactStaged = false): string | null {
    if (result.kind === 'error')
        return palette.git_error + 'Git!' + palette.reset;
    if (result.kind !== 'ok')
        return null;
    const statuses = [...divergenceMarkers(result, language), ...changeMarkers(result, compactStaged)];
    return palette.branch + 'Git ' + string(result.branch) + (statuses.length ? ' ' + statuses.join('') : '') + palette.reset;
}
