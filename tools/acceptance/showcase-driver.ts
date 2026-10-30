/** Runs outside the checkout; product code is loaded only from the verified installation. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const SCENES = [
    { id: 'daily', preset: 'daily-development', name: 'Showcase daily', theme: 'ocean', columns: 120 },
    { id: 'agents', preset: 'agent-workbench', name: 'Showcase agents', theme: 'slate', columns: 120 },
    { id: 'quota', preset: 'quota-cost', name: 'Showcase quota', theme: 'ember', columns: 120 },
    { id: 'narrow', preset: 'narrow-terminal', name: 'Showcase narrow', theme: 'terminal', columns: 40 },
    { id: 'light', preset: 'light-readable', name: 'Showcase light', theme: 'light', columns: 80 },
] as const;
export const SAMPLE_SCENARIOS = ['normal', 'warning', 'critical', 'zero', 'missing', 'long-content'] as const;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export function requireCompact(value: unknown): void {
    assert(value && typeof value === 'object' && 'separator_style' in value && value.separator_style === 'compact',
        'Showcase configurations must use compact separators, never Powerline');
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
    const [display, presets, profiles, gradients, preview, agents, environment, layout] = await Promise.all([
        load('core', 'config/display'), load('core', 'config/presets'), load('core', 'config/profiles'),
        load('core', 'editor/gradients'), load('core', 'rendering/preview'), load('core', 'rendering/subagents'),
        load('cli', 'rendering/environment'), load('core', 'rendering/layout'),
    ]);
    const examples = join(output, 'examples'); fs.mkdirSync(examples);
    const records: Record<string, unknown>[] = [], gallery: Record<string, unknown>[] = [];
    const sourceFiles = ['statusline-core/dist/src/rendering/preview.js', 'statusline-core/dist/src/rendering/sample-scenarios.js',
        'statusline-core/dist/src/rendering/subagents.js', 'statusline-cli/dist/src/rendering/environment.js'];
    const fixture = { home: '/sample', now: preview.SAMPLE_NOW,
        installed_modules: Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(join(modules, file)))])) };
    const fixtureJson = JSON.stringify(fixture, null, 2) + '\n', fixtureSha = hash(fixtureJson);
    fs.writeFileSync(join(output, 'sample-fixture.json'), fixtureJson, { flag: 'wx' });
    for (const scene of SCENES) {
        const original = presets.applyPreset(display.defaultDisplay(), scene.preset, () => { throw new Error('Duplicate built-in instance'); });
        original.separator_style = 'compact'; original.theme = scene.theme;
        delete original.powerline.row_background_gradient;
        for (const group of [...original.groups, ...original.subagents.groups]) group.shared_powerline = false;
        if (scene.id === 'daily') {
            original.instances.find((node: any) => node.type_id === 'session-cost').enabled = true;
            original.instances.find((node: any) => node.type_id === 'model-with-effort').options.foreground_gradient = [...gradients.GRADIENT_PRESETS.ocean];
        }
        const config = display.validateDisplay(original); requireCompact(config);
        const profile = { format: profiles.PROFILE_FORMAT, version: profiles.PROFILE_VERSION, name: scene.name, display: config };
        fs.writeFileSync(join(examples, scene.id + '.json'), JSON.stringify(profile, null, 2) + '\n', { flag: 'wx' });
        for (const language of ['en', 'zh-CN']) {
            const env = environment.baseEnvironment(await environment.presentation(language), { home: fixture.home, now: () => fixture.now });
            const render = (width: number, appearance: string, scenario: string) => {
                const candidate = structuredClone(config); candidate.statusline_language = language;
                if (appearance === 'light') {
                    candidate.theme = 'light';
                    if (scene.id === 'daily') candidate.instances.find((node: any) => node.type_id === 'model-with-effort').options.foreground_gradient = [...gradients.GRADIENT_PRESETS.lagoon];
                } else if (appearance === 'dark') candidate.theme = 'dark';
                else if (appearance === 'no-color') candidate.use_colors = false;
                requireCompact(candidate);
                const main = preview.previewRows(candidate, width, env, fixture.home, 0, scenario);
                const subagents = agents.previewRows(candidate, width, env, scenario);
                const lines = [...main, ...subagents] as string[];
                assert(lines.every(line => layout.displayWidth(line) <= width), 'Installed scene exceeds the terminal width');
                assert(lines.every(line => !line.includes('\ufffd')), 'Invalid Unicode replacement in installed output');
                if (appearance === 'no-color') assert(lines.every(line => !/\x1b\[[0-9;:]*m/u.test(line)), 'No-color preview emitted SGR');
                const metadata = sampleMetadata(scenario); requireSampleMetadata(metadata);
                return { scene: scene.id, preset: scene.preset, language, columns: width, appearance, theme: candidate.theme,
                    separator_style: candidate.separator_style, config_sha256: hash(JSON.stringify(candidate)),
                    source_sha256: hash(JSON.stringify({ fixture: fixtureSha, scenario })), ...metadata, main, subagents };
            };
            for (const width of [40, 80, 120]) for (const appearance of ['dark', 'light', 'no-color'])
                for (const scenario of SAMPLE_SCENARIOS) records.push(render(width, appearance, scenario));
            gallery.push(render(scene.columns, 'scheme', 'normal'));
        }
    }
    fs.writeFileSync(join(output, 'samples.json'), JSON.stringify({ fixture_sha256: fixtureSha, records, gallery }, null, 2) + '\n', { flag: 'wx' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const [modules, output] = process.argv.slice(2);
    assert(modules && output, 'Require verified installed modules and a new output directory');
    await collectSamples(resolve(modules), resolve(output));
}
