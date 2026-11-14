import * as fs from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const TOKEN = /__CLAUDE_STATUSLINE_([A-Z_]+)__/gu;
const STANDALONE = /^\s*__CLAUDE_STATUSLINE_([A-Z_]+)__\s*$/u;
const KNOWN_PLACEHOLDERS = new Set(['ALLOWED_RULES', 'COMMAND', 'ITEM_GROUPS', 'LANGUAGES', 'LANGUAGE_CHOICES', 'THEME_CHOICES']);

function object(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}
function strings(value: unknown): value is string[] {
    return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.trim().length > 0);
}
function headings(content: string): number {
    const lines = content.split('\n');
    let fenced = false, count = 0;
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index]!;
        if (/^ {0,3}(?:`{3,}|~{3,})/u.test(line)) { fenced = !fenced; continue; }
        if (fenced) continue;
        if (/^# /u.test(line)) count++;
        else if (line.trim() && !/^ {0,3}(?:[-*+] |\d+[.)] )/u.test(line) && /^ {0,3}=+\s*$/u.test(lines[index + 1] ?? '')) count++;
    }
    return count;
}

/** Validate canonical bundled skill resources without editing product inputs. */
export function checkSkillResources(root: string): string[] {
    const directory = join(root, 'packages', 'cli', 'resources');
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return [];
    const errors: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
        if (!entry.isDirectory()) continue;
        const file = join(directory, entry.name, 'SKILL.md');
        if (!fs.existsSync(file)) continue;
        const path = 'packages/cli/resources/' + entry.name + '/SKILL.md';
        const fail = (message: string) => errors.push(path + ': ' + message);
        const body = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
        const external = entry.name === 'statusline-configure';
        let placeholderError = false;
        if (external && body.includes('__CLAUDE_STATUSLINE_')) { fail('external skill must not contain renderer placeholders'); placeholderError = true; }
        for (const token of body.matchAll(TOKEN)) if (!KNOWN_PLACEHOLDERS.has(token[1]!)) { fail('unknown bundled skill placeholder: ' + token[0]); placeholderError = true; }
        if (body.replace(TOKEN, '').includes('__CLAUDE_STATUSLINE_')) { fail('malformed bundled skill placeholder'); placeholderError = true; }
        if (placeholderError) continue;
        const match = /^---\n([\s\S]+?)\n---\n/u.exec(body);
        if (!match) { fail('missing YAML frontmatter'); continue; }
        let header: unknown;
        try {
            const normalized = match[1]!.split('\n').filter(line => !STANDALONE.test(line)).join('\n');
            header = parse(normalized);
        } catch (error) { fail('invalid YAML frontmatter: ' + String(error)); continue; }
        if (!object(header)) { fail('frontmatter must be a mapping'); continue; }
        if (header.name !== entry.name) fail('name must match the directory: ' + entry.name);
        if (!text(header.description)) fail('description must be a nonempty string');
        if (typeof header['argument-hint'] !== 'string') fail('argument-hint must be a string');
        const allowed = header['allowed-tools'], disallowed = header['disallowed-tools'];
        if (allowed !== undefined && disallowed !== undefined) fail('use either allowed-tools or disallowed-tools, not both');
        else if (allowed !== undefined && !strings(allowed)) fail('allowed-tools must be a nonempty string array');
        else if (disallowed !== undefined && !strings(disallowed)) fail('disallowed-tools must be a nonempty string array');
        else if (allowed === undefined && disallowed === undefined) fail('use allowed-tools or disallowed-tools');
        if (header['disable-model-invocation'] !== true) fail('disable-model-invocation must be true');
        const content = body.slice(body.indexOf('\n---\n') + 5);
        if (!content.trim()) fail('body must not be empty');
        else if (headings(content) !== 1) fail('body must contain exactly one H1');
    }
    return errors;
}
