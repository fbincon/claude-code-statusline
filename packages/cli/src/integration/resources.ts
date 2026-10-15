import * as fs from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { quoteArgument } from '@fbincon/statusline-platform/commands';
import { isLinkOrReparse } from '@fbincon/statusline-platform/files';
import type { LaunchSpec } from '@fbincon/statusline-platform/launch';
import { BY_SCOPE } from '@fbincon/statusline-core/config/catalog';
import { LANGUAGES, LANGUAGE_NAMES } from '@fbincon/statusline-core/i18n/registry';
import { jsonBytes } from '../config/storage.js';
import { safeTarget } from './transaction.js';
import { SKILL, EXTERNAL, VERSION, type ModSpec } from './model.js';
const resourceRoot = fileURLToPath(new URL('../../../resources/', import.meta.url));
export const digest = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');
export function wizardGroups(): string {
    const lines: string[] = [];
    for (const [scope, label] of [['main', 'Main'], ['subagent', 'Subagents']] as const) {
        const items = [...BY_SCOPE[scope].values()].filter(item => !['text', 'spacer'].includes(item.id));
        for (const group of new Set(items.map(item => item.group)))
            lines.push(`   - ${label} / ${group}: ` + items.filter(item => item.group === group).map(item => '`' + item.id + '`').join(', '));
    }
    lines.push('   Use default_enabled, format_options and excludes from the live listings; do not infer defaults from this grouping.');
    return lines.join('\n');
}
export function renderSkill(launch: LaunchSpec, external = false): Buffer {
    let template = fs.readFileSync(join(resourceRoot, external ? EXTERNAL : SKILL, 'SKILL.md'), 'utf8');
    const token = /__CLAUDE_STATUSLINE_([A-Z_]+)__/gu;
    if (template.replace(token, '').includes('__CLAUDE_STATUSLINE_') || external && template.includes('__CLAUDE_STATUSLINE_'))
        throw new Error('Unresolved bundled skill placeholder');
    if (!external) {
        const bash = [launch.executable, ...launch.args].map(quoteArgument).join(' ');
        const powershell = '& ' + [launch.executable, ...launch.args].map(value => "'" + value.replaceAll("'", "''") + "'").join(' ');
        const command = process.platform === 'win32' ? powershell : bash;
        const rules = [`Bash(${bash} config *)`];
        if (process.platform === 'win32')
            rules.push(`PowerShell(${powershell} config *)`);
        const replacements = { ALLOWED_RULES: rules.map(rule => '  - ' + JSON.stringify(rule)).join('\n'), COMMAND: command, ITEM_GROUPS: wizardGroups(), LANGUAGES: LANGUAGES.map(code => `${code} (${LANGUAGE_NAMES[code]})`).join(', '), LANGUAGE_CHOICES: LANGUAGES.join('|') };
        // Insert argv literally in one pass: replacement-string $&, $` and $'
        // syntax, or a placeholder-looking path, must never expand as a template.
        template = template.replace(token, (_match, key: string) => {
            if (!Object.hasOwn(replacements, key))
                throw new Error('Unresolved bundled skill placeholder');
            return replacements[key as keyof typeof replacements];
        });
    }
    return Buffer.from(template);
}
export interface Inventory {
    schema_version: 1;
    backend_version: string;
    mod_version: string;
    protocol_version: number;
    files: Record<string, string>;
}
export interface Bundle {
    files: Map<string, Buffer>;
    inventory: Inventory;
}
export function inventory(files: ReadonlyMap<string, Buffer>, spec: ModSpec): Inventory {
    const manifest = JSON.parse(files.get('.claude-plugin/plugin.json')!.toString('utf8'));
    if (manifest.name !== spec.name || manifest.version !== VERSION)
        throw new Error('Bundled Mod/backend identity or version mismatch');
    return { schema_version: 1, backend_version: VERSION, mod_version: VERSION, protocol_version: spec.protocol, files: Object.fromEntries([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, raw]) => [name, digest(raw)])) };
}
export function sourceFiles(root: string): Map<string, Buffer> {
    const names = new Set(['.claude-plugin/plugin.json', 'hooks/hooks.json']);
    function walk(path: string): void {
        if (isLinkOrReparse(path))
            throw new Error('Bundled Mod contains a link or reparse point');
        for (const entry of fs.readdirSync(path, { withFileTypes: true })) {
            const target = join(path, entry.name);
            safeTarget(root, target);
            if (entry.isDirectory())
                walk(target);
            else if (entry.isFile() && entry.name.endsWith('.ts'))
                names.add(relative(root, target).replaceAll('\\', '/'));
        }
    }
    for (const directory of ['hooks', 'lib', 'ui'])
        if (fs.existsSync(join(root, directory)))
            walk(join(root, directory));
    return new Map([...names].sort().map(name => { const path = join(root, name); safeTarget(root, path); return [name, fs.readFileSync(path)]; }));
}
export function bundledFiles(spec: ModSpec): Bundle {
    const root = join(resourceRoot, spec.name), path = join(root, 'resource-manifest.json');
    let files: Map<string, Buffer>, record: Inventory;
    if (fs.existsSync(path)) {
        record = JSON.parse(fs.readFileSync(path, 'utf8')) as Inventory;
        files = new Map(Object.keys(record.files).map(name => { safeTarget(root, join(root, name)); return [name, fs.readFileSync(join(root, name))]; }));
        if (JSON.stringify(record) !== JSON.stringify(inventory(files, spec)))
            throw new Error('Bundled resource inventory does not match');
    }
    else {
        const checkout = fileURLToPath(new URL('../../../../../', import.meta.url));
        if (!fs.existsSync(join(checkout, 'tsconfig.tools.json')))
            throw new Error('Bundled resources are missing; reinstall the package');
        files = sourceFiles(join(checkout, 'mods', spec.name));
        record = inventory(files, spec);
    }
    files.set('resource-manifest.json', jsonBytes(record));
    return { files, inventory: record };
}
