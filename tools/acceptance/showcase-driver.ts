/** Runs outside the checkout; product code is loaded only from the verified installation. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const SCENES = [
    { id: 'daily', preset: 'daily-development', name: 'Showcase daily', theme: 'classic', columns: 120 },
    { id: 'agents', preset: 'agent-workbench', name: 'Showcase agents', theme: 'classic', columns: 120 },
    { id: 'quota', preset: 'quota-cost', name: 'Showcase quota', theme: 'classic', columns: 120 },
    { id: 'narrow', preset: 'narrow-terminal', name: 'Showcase narrow', theme: 'classic', columns: 40 },
    { id: 'light', preset: 'light-readable', name: 'Showcase light', theme: 'light', columns: 80 },
] as const;
export const SAMPLE_SCENARIOS = ['normal', 'warning', 'critical', 'zero', 'missing', 'long-content'] as const;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/** Documentation styles only: no product preset, palette or default is changed. */
export const SHOWCASE_GRADIENTS = {
    'model-with-effort': { dark: ['#fbcfe8', '#e9d5ff', '#dbeafe'], light: ['#9d174d', '#6b21a8', '#1e40af'] },
    'current-dir': { dark: ['#fb923c', '#f472b6', '#a78bfa'], light: ['#9a3412', '#9d174d', '#5b21b6'] },
    'git': { dark: ['#86efac', '#5eead4', '#7dd3fc'], light: ['#166534', '#115e59', '#075985'] },
    'context-remaining': { dark: ['#22d3ee', '#3b82f6'], light: ['#0e7490', '#1e40af'] },
    'context-window-size': { dark: ['#93c5fd', '#a5b4fc', '#c4b5fd'], light: ['#1e40af', '#3730a3', '#5b21b6'] },
    'context-used': { dark: ['#fed7aa', '#fdba74', '#fca5a5'], light: ['#9a3412', '#92400e', '#991b1b'] },
    'five-hour-limit': { dark: ['#fde68a', '#fdba74', '#fda4af'], light: ['#854d0e', '#9a3412', '#9f1239'] },
    'weekly-limit': { dark: ['#ddd6fe', '#c4b5fd', '#a5b4fc'], light: ['#6b21a8', '#5b21b6', '#3730a3'] },
    'spend-limit': { dark: ['#fecdd3', '#f9a8d4', '#e9a8f4'], light: ['#9f1239', '#9d174d', '#86198f'] },
    'five-hour-reset': { dark: ['#d9f99d', '#a7f3d0', '#99f6e4'], light: ['#3f6212', '#065f46', '#115e59'] },
    'weekly-reset': { dark: ['#c4b5fd', '#a5b4fc', '#99f6e4'], light: ['#5b21b6', '#3730a3', '#115e59'] },
    'tokens': { dark: ['#f0abfc', '#d8b4fe', '#c4b5fd'], light: ['#86198f', '#6b21a8', '#5b21b6'] },
    'task-timer': { dark: ['#99f6e4', '#67e8f9', '#93c5fd'], light: ['#115e59', '#155e75', '#1e40af'] },
    'task-active-timer': { dark: ['#a7f3d0', '#a5f3fc', '#bfdbfe'], light: ['#065f46', '#155e75', '#1e40af'] },
    'session-cost': { dark: ['#c7d2fe', '#d8b4fe', '#fbcfe8'], light: ['#3730a3', '#6b21a8', '#9d174d'] },
    'session-cost-rate': { dark: ['#fed7aa', '#fca5a5', '#f9a8d4'], light: ['#9a3412', '#991b1b', '#9d174d'] },
    'run-state': { dark: ['#bae6fd', '#99f6e4', '#a7f3d0'], light: ['#075985', '#115e59', '#065f46'] },
    'task-progress': { dark: ['#a5f3fc', '#93c5fd', '#c4b5fd'], light: ['#155e75', '#1e40af', '#5b21b6'] },
    'active-agents': { dark: ['#f5d0fe', '#e9d5ff', '#f9a8d4'], light: ['#86198f', '#6b21a8', '#9d174d'] },
    'status-elapsed': { dark: ['#bbf7d0', '#bfdbfe', '#ddd6fe'], light: ['#166534', '#1e40af', '#6b21a8'] },
    'status': { dark: ['#d9f99d', '#86efac', '#5eead4'], light: ['#3f6212', '#166534', '#115e59'] },
    'name': { dark: ['#fef08a', '#fcd34d', '#fde68a'], light: ['#713f12', '#854d0e', '#92400e'] },
    'elapsed': { dark: ['#fed7aa', '#fde68a', '#d9f99d'], light: ['#9a3412', '#854d0e', '#3f6212'] },
    'task': { dark: ['#bfdbfe', '#c7d2fe', '#fbcfe8'], light: ['#1e40af', '#3730a3', '#9d174d'] },
} as const;
export type ShowcaseAppearance = 'dark' | 'light';
const LEGACY_FORMATTING = { model_name: 'original', number_format: 'legacy', labels: 'legacy', icons: 'legacy',
    allowance: 'remaining', reset_format: 'countdown', reset_timezone: 'local' } as const;
const nodesOf = (value: any): any[] => [...value.instances, ...value.subagents.instances];

/** Apply to a derived draft, then pass it through the installed display validator. */
export function applyShowcaseVisuals(value: any, appearance: ShowcaseAppearance = 'dark'): void {
    Object.assign(value, { use_colors: true, palette: 'default', theme: appearance === 'light' ? 'light' : 'classic',
        separator_style: 'classic', directory_style: 'full', scope_labels: 'when-subagents' });
    Object.assign(value.formatting, LEGACY_FORMATTING);
    value.formatting.thresholds = { enabled: false, warning: 70, critical: 90 };
    delete value.powerline.row_background_gradient;
    for (const group of [...value.groups, ...value.subagents.groups]) group.shared_powerline = false;
    for (const node of nodesOf(value)) {
        if (node.type_id === 'spacer') continue;
        Object.assign(node.options, { label: null, icon: null, foreground: null, background: null, formatting: {} });
        delete node.options.background_gradient;
        const gradient = SHOWCASE_GRADIENTS[node.type_id as keyof typeof SHOWCASE_GRADIENTS];
        assert(gradient || !node.enabled, 'Displayed component lacks a reviewed showcase gradient: ' + node.type_id);
        if (gradient) node.options.foreground_gradient = [...gradient[appearance]];
    }
}

export function requireShowcaseVisuals(value: unknown, options: { appearance?: ShowcaseAppearance; allowNoColor?: boolean } = {}): void {
    assert(value && typeof value === 'object', 'Missing showcase display configuration');
    const config = value as any, appearance = options.appearance ?? (config.theme === 'light' ? 'light' : 'dark');
    assert.equal(config.separator_style, 'classic', 'Showcase requires classic separators, never Powerline');
    assert.equal(config.palette, 'default', 'Showcase requires the default RGB palette');
    assert.equal(config.theme, appearance === 'light' ? 'light' : 'classic', 'Showcase requires the approved classic/light theme');
    assert(config.use_colors === true || options.allowNoColor === true && config.use_colors === false,
        'Public showcase configurations require color; no-color is an explicit compatibility case');
    assert.equal(config.directory_style, 'full'); assert.equal(config.scope_labels, 'when-subagents');
    for (const [key, expected] of Object.entries(LEGACY_FORMATTING)) assert.equal(config.formatting?.[key], expected, 'Showcase formatting: ' + key);
    assert(Array.isArray(config.instances) && Array.isArray(config.subagents?.instances), 'Both display scopes are required');
    assert(!config.powerline?.row_background_gradient, 'Showcase cannot retain a Powerline row background');
    for (const group of [...config.groups, ...config.subagents.groups]) assert.equal(group.shared_powerline, false, 'Showcase group cannot share Powerline blocks');
    for (const node of nodesOf(config)) {
        const item = node.options;
        assert(!item.background && !item.background_gradient, 'Showcase cannot retain item backgrounds');
        assert.equal(item.label, null, 'Remove per-item label decorations'); assert.equal(item.icon, null, 'Remove per-item ASCII/icon decorations');
        assert.deepEqual(item.formatting, {}, 'Remove per-item formatting overrides');
        assert(!node.source, 'Showcase profiles contain no local source binding');
        if (node.type_id === 'spacer') { assert(!item.foreground_gradient, 'Spacers remain neutral'); continue; }
        if (!node.enabled) continue;
        const gradient = SHOWCASE_GRADIENTS[node.type_id as keyof typeof SHOWCASE_GRADIENTS];
        assert(gradient, 'Displayed component lacks a reviewed showcase gradient: ' + node.type_id);
        assert.equal(item.foreground, null, 'A fixed foreground must not override the component gradient');
        assert.deepEqual(item.foreground_gradient, [...gradient[appearance]], 'Wrong component gradient: ' + node.type_id);
    }
}

const chromatic = (rgb: number[]) => rgb.every(n => Number.isInteger(n) && n >= 0 && n <= 255) && Math.max(...rgb) - Math.min(...rgb) >= 12;
const hexColor = (rgb: number[]) => '#' + rgb.map(n => n.toString(16).padStart(2, '0')).join('');
/** Base-16 UI chrome alone is not evidence of the graded RGB/256-color previews. */
function foregroundSequences(ansi: string) {
    const colors = new Set<string>(); let rgbSequences = 0, indexedSequences = 0;
    for (const match of ansi.matchAll(/\x1b\[([0-9;:]+)m/gu)) {
        const values = match[1]!.split(/[;:]/u).map(Number);
        for (let i = 0; i < values.length; i++) if (values[i] === 38 || values[i] === 48) {
            const foreground = values[i] === 38;
            if (values[i + 1] === 2 && i + 4 < values.length) {
                const rgb = values.slice(i + 2, i + 5);
                if (foreground) { rgbSequences++; if (chromatic(rgb)) colors.add(hexColor(rgb)); }
                i += 4;
            } else if (values[i + 1] === 5 && i + 2 < values.length) {
                const index = values[i + 2]!;
                if (foreground) {
                    indexedSequences++;
                    if (Number.isInteger(index) && index >= 16 && index < 232) {
                        const levels = [0, 95, 135, 175, 215, 255], n = index - 16;
                        const rgb = [levels[Math.floor(n / 36)]!, levels[Math.floor(n / 6) % 6]!, levels[n % 6]!];
                        if (chromatic(rgb)) colors.add(hexColor(rgb));
                    }
                }
                i += 2;
            }
        }
    }
    return { colors: [...colors].sort(), rgbSequences, indexedSequences };
}
export function observedForegroundColors(ansi: string): string[] { return foregroundSequences(ansi).colors; }

export function requireColorObservation(ansi: string, cells: readonly (readonly { data: string; fg: string; bg?: string; reverse?: boolean }[])[]) {
    const sgr = foregroundSequences(ansi), observed = new Set<string>(); let chromaticCells = 0;
    for (const cell of cells.flat()) {
        if (!/\S/u.test(cell.data)) continue;
        const color = cell.reverse ? cell.bg : cell.fg;
        if (!color || !/^#?[0-9a-f]{6}$/iu.test(color)) continue;
        const hex = color.replace(/^#/u, '').toLowerCase(), rgb = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
        if (chromatic(rgb)) { observed.add('#' + hex); chromaticCells++; }
    }
    const foregroundColors = [...observed].sort();
    const matching = foregroundColors.filter(color => sgr.colors.includes(color));
    assert(sgr.colors.length >= 2, 'Captured terminal has no varied RGB/indexed foreground SGR');
    assert(foregroundColors.length >= 2, 'Selected frame has no varied chromatic foreground text cells');
    assert(matching.length >= 2, 'Frame foreground colors lack matching raw terminal SGR');
    return { chromatic_cells: chromaticCells, unique_foreground_rgb: foregroundColors,
        sgr_rgb_sequences: sgr.rgbSequences, sgr_indexed_sequences: sgr.indexedSequences, matching_foreground_colors: matching };
}

export function sampleMetadata(scenario: string) {
    assert((SAMPLE_SCENARIOS as readonly string[]).includes(scenario), 'Unknown fixed sample scenario');
    return { kind: 'fixed sample through the installed production renderer', sample: true,
        input_kind: 'synthetic-preview', scenario, actual_session: false, model_calls: 0,
        physical_visual_acceptance: false, human_acceptance: false } as const;
}

export function requireSampleMetadata(value: unknown): void {
    assert(value && typeof value === 'object', 'Missing sample provenance');
    const record = value as Record<string, unknown>;
    const expected = sampleMetadata(String(record.scenario));
    for (const [key, wanted] of Object.entries(expected))
        assert.equal(record[key], wanted, 'A fixed sample cannot be described as a real session or human acceptance: ' + key);
}

export async function collectSamples(modules: string, output: string): Promise<void> {
    const load = (name: string, file: string) => import(pathToFileURL(join(modules, 'statusline-' + name, 'dist/src', file + '.js')).href);
    const [display, presets, profiles, instances, preview, agents, environment, layout] = await Promise.all([
        load('core', 'config/display'), load('core', 'config/presets'), load('core', 'config/profiles'),
        load('core', 'config/instances'), load('core', 'rendering/preview'), load('core', 'rendering/subagents'),
        load('cli', 'rendering/environment'), load('core', 'rendering/layout'),
    ]);
    const examples = join(output, 'examples'); fs.mkdirSync(examples);
    const records: Record<string, unknown>[] = [], gallery: Record<string, unknown>[] = [];
    const sourceFiles = ['statusline-core/dist/src/rendering/preview.js', 'statusline-core/dist/src/rendering/sample-scenarios.js',
        'statusline-core/dist/src/rendering/subagents.js', 'statusline-cli/dist/src/rendering/environment.js'];
    const fixture = { home: '/demo', now: preview.SAMPLE_NOW,
        installed_modules: Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(join(modules, file)))])) };
    const fixtureJson = JSON.stringify(fixture, null, 2) + '\n', fixtureSha = hash(fixtureJson);
    fs.writeFileSync(join(output, 'sample-fixture.json'), fixtureJson, { flag: 'wx' });
    for (const scene of SCENES) {
        let original = presets.applyPreset(display.defaultDisplay(), scene.preset, () => { throw new Error('Duplicate built-in instance'); });
        if (scene.id === 'daily') {
            const rows = [['model-with-effort', 'current-dir', 'git'], ['context-remaining', 'context-window-size'],
                ['five-hour-limit', 'weekly-limit', 'spend-limit'], ['tokens', 'task-timer']];
            original = instances.updateDisplay(original, { items: rows.flat(), layout: { mode: 'explicit', rows } });
            for (const node of original.instances) {
                node.options.max_width = node.type_id === 'current-dir' ? 42 : node.type_id === 'git' ? 36 : null;
                if (['context-remaining', 'five-hour-limit', 'weekly-limit', 'spend-limit'].includes(node.type_id))
                    Object.assign(node.options, { presentation: 'adaptive', bar_width: 8 });
            }
        }
        if (scene.id === 'narrow') original.layout = { mode: 'explicit', rows: [['model-with-effort', 'current-dir'], ['context-remaining', 'task-timer']] };
        if (scene.id === 'agents') original.subagents.hide_completed = false;
        applyShowcaseVisuals(original, scene.id === 'light' ? 'light' : 'dark');
        // The quota tutorial intentionally demonstrates production threshold colors over decorative gradients.
        if (scene.id === 'quota') original.formatting.thresholds.enabled = true;
        const config = display.validateDisplay(original); requireShowcaseVisuals(config);
        const profile = { format: profiles.PROFILE_FORMAT, version: profiles.PROFILE_VERSION, name: scene.name, display: config };
        fs.writeFileSync(join(examples, scene.id + '.json'), JSON.stringify(profile, null, 2) + '\n', { flag: 'wx' });
        for (const language of ['en', 'zh-CN']) {
            const env = environment.baseEnvironment(await environment.presentation(language), { home: fixture.home, now: () => fixture.now });
            const render = (width: number, appearance: string, scenario: string) => {
                const candidate = structuredClone(config); candidate.statusline_language = language;
                if (appearance === 'light' || appearance === 'dark') {
                    applyShowcaseVisuals(candidate, appearance);
                    if (scene.id === 'quota') candidate.formatting.thresholds.enabled = true;
                } else if (appearance === 'no-color') candidate.use_colors = false;
                requireShowcaseVisuals(candidate, { allowNoColor: appearance === 'no-color' });
                const main = preview.previewRows(candidate, width, env, fixture.home, 0, scenario);
                const subagents = agents.previewRows(candidate, width, env, scenario);
                const lines = [...main, ...subagents] as string[];
                assert(lines.every(line => layout.displayWidth(line) <= width), 'Installed scene exceeds the terminal width');
                assert(lines.every(line => !line.includes('\ufffd')), 'Invalid Unicode replacement in installed output');
                if (appearance === 'no-color') assert(lines.every(line => !/\x1b\[[0-9;:]*m/u.test(line)), 'No-color preview emitted SGR');
                const foregroundColors = observedForegroundColors(lines.join('\n'));
                if (appearance !== 'no-color' && scenario !== 'missing')
                    assert(foregroundColors.length >= 2, 'Color showcase sample contains no varied chromatic foreground output');
                const metadata = sampleMetadata(scenario); requireSampleMetadata(metadata);
                return { scene: scene.id, preset: scene.preset, language, columns: width, appearance, theme: candidate.theme,
                    separator_style: candidate.separator_style, formatting: candidate.formatting,
                    gradient_variant: candidate.theme === 'light' ? 'light' : 'dark', foreground_colors: foregroundColors,
                    threshold_override: candidate.formatting.thresholds.enabled, config_sha256: hash(JSON.stringify(candidate)),
                    source_sha256: hash(JSON.stringify({ fixture: fixtureSha, scenario })), ...metadata, main, subagents };
            };
            for (const width of [40, 80, 120]) for (const appearance of ['dark', 'light', 'no-color'])
                for (const scenario of SAMPLE_SCENARIOS) records.push(render(width, appearance, scenario));
            gallery.push(render(scene.columns, 'scheme', 'normal'));
        }
    }
    fs.writeFileSync(join(output, 'samples.json'), JSON.stringify({ fixture_sha256: fixtureSha, records, gallery }, null, 2) + '\n', { flag: 'wx' });
    fs.writeFileSync(join(output, 'visual-baseline.json'), JSON.stringify({ separator_style: 'classic', palette: 'default',
        theme: 'classic', light_variant_theme: 'light', formatting: LEGACY_FORMATTING, gradients: SHOWCASE_GRADIENTS,
        quota_threshold_override: { enabled: true, warning: 70, critical: 90 }, scene_profiles: SCENES }, null, 2) + '\n', { flag: 'wx' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const [modules, output] = process.argv.slice(2);
    assert(modules && output, 'Require verified installed modules and a new output directory');
    await collectSamples(resolve(modules), resolve(output));
}
