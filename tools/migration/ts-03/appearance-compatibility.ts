/** Schema 9's explicit, bounded baseline translation. Frozen files remain immutable. */
import { canonical, decode } from '@fbincon/statusline-core/json';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { POWERLINE_FIELDS, POWERLINE_OPTIONS } from '@fbincon/statusline-core/contracts/ui';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { revision } from '@fbincon/statusline-platform/hash';

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const defaults = { padding: 'both', separator: 'arrow', start_cap: false, end_cap: true, color_mode: 'semantic' };
function display(value: unknown): unknown {
    if (!object(value) || canonical(value.schema_version) !== canonical(8) || !Array.isArray(value.instances) || Object.hasOwn(value, 'powerline')) return value;
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => key === 'powerline_glyph'
        ? [[key, item], ['powerline', defaults]] : [[key, key === 'schema_version' ? 9 : item]]));
}
export function appearanceBaseline(id: string, path: string, value: unknown): unknown {
    if (/^display-v[1-8]-read$/u.test(id) && path === '/value/effective') return display(value);
    const read = id === 'ui-read' && path === '/value/response/result' || id === 'transaction-save-conflict-backup' && /^\/value\/(initial|first_save|reopen)\/response\/result$/u.test(path);
    if (read && object(value) && object(value.draft)) {
        const upgraded = display(value.draft.display);
        if (upgraded !== value.draft.display) return { ...value, draft: { ...value.draft, display: upgraded },
            revision: revision({ revision_version: 1, display: upgraded, host: value.draft.host, installation: value.installation }) };
    }
    if (id === 'portable-roundtrip-review-no-save' && /^\/value\/responses\/[12]\/response\/result\/draft\/display$/u.test(path)) return display(value);
    if (id === 'ui-describe' && path === '/value/response/result/editor_fields/global' && Array.isArray(value) && value.length === 18) {
        const fields = value.map(field => field.key === 'statusline_language' ? { ...field, choices: [...LANGUAGES] } : field);
        return [...fields.slice(0, 2), ...POWERLINE_FIELDS, ...fields.slice(2)];
    }
    if (id === 'ui-describe' && path === '/value/response/result/options' && object(value) && !Object.hasOwn(value, 'powerline-padding'))
        return { ...value, ...POWERLINE_OPTIONS };
    if (typeof value !== 'string') return value;
    const stored = id === 'transaction-save-conflict-backup' && ['/value/after_first_save/config~1claude-statusline.json','/files_after/config~1claude-statusline.json'].includes(path);
    const portable = id === 'portable-roundtrip-review-no-save' && path === '/value/portable';
    const shown = id === 'cli-config-show' && path === '/value/stdout';
    if (!stored && !portable && !shown) return value;
    const parsed = decode(value);
    if (!object(parsed)) return value;
    const source = stored ? parsed : portable && object(parsed.draft) ? parsed.draft.display : parsed.display;
    const upgraded = display(source);
    if (upgraded === source) return value;
    const next = stored ? upgraded : portable ? { ...parsed, draft: { ...(parsed.draft as object), display: upgraded } } : { ...parsed, display: upgraded };
    return pythonJson(next, { indent: 2, ensureAscii: false }) + '\n';
}
