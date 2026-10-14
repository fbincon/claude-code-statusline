import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { text, type LocalizedText } from '@fbincon/statusline-core/i18n/messages';
/** Localize nested domain errors only at an interface boundary. */
export function localizedError(error: ConfigError): LocalizedText {
    const params = Object.fromEntries(Object.entries(error.params).map(([key, value]) => [key, value instanceof ConfigError ? localizedError(value) : value]));
    return text(error.key, params);
}
