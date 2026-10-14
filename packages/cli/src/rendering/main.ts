import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { CONFIG_FILENAME, defaultDisplay, validateDisplay } from '@fbincon/statusline-core/config/display';
import { decode } from '@fbincon/statusline-core/json';
import { readJson } from '@fbincon/statusline-core/json-read';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { configuredRows } from '@fbincon/statusline-core/rendering/items';
import { coercedInteger } from '@fbincon/statusline-core/rendering/formatters';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { renderEnvironment, type EnvironmentOptions } from './environment.js';
export function configDirectory(value?: string): string { value ??= process.env.CLAUDE_CONFIG_DIR ?? '~/.claude'; return resolve(value === '~' ? homedir() : value.startsWith('~/') || value.startsWith('~\\') ? join(homedir(), value.slice(2)) : value); }
export function readDisplay(directory: string) { try {
    return validateDisplay(decode(decodeUtf8(readFileSync(join(directory, CONFIG_FILENAME)))));
}
catch {
    return defaultDisplay();
} }
export function renderInput(read: () => string | Uint8Array): unknown {
    const raw = read();
    let text = typeof raw === 'string' ? raw : decodeUtf8(raw);
    if (text.startsWith('\ufeff'))
        text = text.slice(1);
    return readJson(text);
}
export function contentWidth(columns?: string): number {
    const parsed = coercedInteger(columns), width = parsed !== null && parsed > 0n ? Number(parsed) : 120;
    return Math.max(2, width - 2);
}
export async function render(read: () => string | Uint8Array, options: EnvironmentOptions = {}, subagents = false, columns = process.env.COLUMNS): Promise<string> {
    let data: unknown;
    try {
        data = renderInput(read);
    }
    catch {
        return '';
    }
    const configDir = configDirectory(options.configDir), config = readDisplay(configDir), env = await renderEnvironment(config, data, { ...options, configDir }, subagents);
    if (subagents) {
        const { renderPayload } = await import('@fbincon/statusline-core/rendering/subagents');
        return renderPayload(data, config, env).map(item => pythonJson(item, { ensureAscii: false, compact: true }) + '\n').join('');
    }
    const rows = configuredRows(data, config, contentWidth(columns), env);
    return rows.length ? rows.join('\n') + '\n' : '';
}
