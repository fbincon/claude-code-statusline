import { stripVTControlCharacters } from 'node:util';
import type { LocalizedText } from '@fbincon/statusline-core/i18n/messages';

export const MOD_BLOCKED_NOTICE = 'native.notice.compatibility_configuration_is_retained_run_doctor_before';

export function integrationDetail(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    return stripVTControlCharacters(value).replace(/[\x00-\x1f\x7f-\x9f]+/gu, ' ').trim().slice(0, 1200) || undefined;
}

export function modFailureDetail(messages: readonly (string | LocalizedText)[]): string | undefined {
    return integrationDetail(messages.flatMap(message => typeof message !== 'string' && message.key === MOD_BLOCKED_NOTICE &&
        typeof message.params.value0 === 'string' ? [message.params.value0] : []).join(' '));
}
