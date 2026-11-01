import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { runInstalled, setupInstalled, type ColdCommand, type InstalledCommandFixture } from './installed-commands.js';
import { admitLanguageOperation, LANGUAGE_OPERATION_MS, LANGUAGE_ROW_ADMISSION_MS, LANGUAGE_ROW_MS } from './language-budget.js';
import { withLanguageWorker, type LanguageCommand } from './installed-language-process.js';

export interface InstalledLanguageFixture extends InstalledCommandFixture {
    modules: string;
    packed: { source: { commit: string }; sha256: string };
}
type LanguageMode = 'baseline' | 'optimized';
export function languageMode(selected: string | undefined, diagnostic: string | undefined): LanguageMode {
    if (!selected || selected === 'optimized') return 'optimized';
    if (selected === 'baseline' && diagnostic) return 'baseline';
    throw new Error('The language baseline requires an explicit diagnostic pattern; unknown language modes are rejected');
}
/** One real-pipe control per language on each axis. Include the English default
 * and rotate the remaining languages so mismatched UI/output is exercised too. */
export function coldLanguageOutput(languages: readonly string[], index: number): string {
    return languages[index === 0 ? 0 : 1 + index % (languages.length - 1)]!;
}
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
interface ObservedPair {
    ui_language: string; output_language: string; preview_sample: true; readonly_preview: true;
    reopened_output: string; reopened_ui: string; render_sha256: string;
}

/** Same installed configuration, operation order and assertions in both modes.
 * Baseline sends all six operations through real stdin pipes. Optimized rows
 * share the writer's CLI imports and always reopen in a separate process. */
export async function installedLanguages(installed: InstalledLanguageFixture, observedPairs?: (pairs: readonly ObservedPair[]) => void) {
    const mode = languageMode(process.env.TS05_LANGUAGE_MODE, process.env.TS05_DIAGNOSTIC_PATTERN);
    const started = performance.now(), report = process.env.TS04_INSTALLED_REPORT;
    const launches = { cli: 0, writer: 0, reader: 0 };
    const cold: ColdCommand = (...args) => { launches.cli++; return runInstalled(installed, ...args); };
    const config = setupInstalled(installed, 'i18n-workflow', cold);
    cold(['config', 'set-items', 'context-remaining'], config);
    cold(['config', 'set', 'colors', 'off'], config);
    const messages = await import(pathToFileURL(join(installed.modules, 'statusline-core/dist/src/i18n/messages.js')).href);
    const dictionaries = await import(pathToFileURL(join(installed.modules, 'statusline-core/dist/src/i18n/generated-locales.js')).href);
    const worker = join(installed.temporary, 'installed-language-worker.mjs');
    if (mode === 'optimized') copyFileSync(fileURLToPath(new URL('./installed-language-worker.js', import.meta.url)), worker);
    const options = { node: installed.node, entry: installed.entry, worker, directory: installed.directory, env: { ...installed.env, CLAUDE_CONFIG_DIR: config } };
    const display = join(config, 'claude-statusline.json'), rendered = new Map<string, string>();
    const resources: { language: string; entries: number; sha256: string }[] = [], pairs: ObservedPair[] = [];
    const rows: { language: string; elapsed_ms: number; pairs: number; cold_control: string | null }[] = [];
    const journal = report && report + '.language-rows.jsonl';
    if (journal) writeFileSync(journal, '', { flag: 'wx' });
    const record = (event: object) => { if (journal) appendFileSync(journal, JSON.stringify(event) + '\n'); };
    let active = 'resource verification';
    try {
        for (const [index, language] of LANGUAGES.entries()) {
            const start = performance.now(), first = pairs.length, control = coldLanguageOutput(LANGUAGES, index);
            active = language + '/resources';
            record({ phase: 'start', language, mode, budget_ms: LANGUAGE_ROW_ADMISSION_MS, last_operation_ms: LANGUAGE_OPERATION_MS });
            const checkStart = (label: string) => { active = language + '/' + label; admitLanguageOperation(start, active); };
            const resource = readFileSync(join(installed.modules, 'statusline-core/resources/i18n/locales', language + '.json'));
            const effective = JSON.parse(resource.toString('utf8'));
            assert.deepEqual(effective, dictionaries.LOCALES[language]);
            for (const key of Object.keys(effective)) assert.equal(messages.messageOrigin(key, language), dictionaries.FALLBACK_KEYS[language].includes(key) ? 'en' : language);
            resources.push({ language, entries: Object.keys(effective).length, sha256: digest(resource) });

            const pipe: LanguageCommand = async (_label, args, input) => cold(args, config, input, args[0] === 'render' ? { COLUMNS: '120' } : {});
            const ui = async (call: LanguageCommand, label: string, operation: string, payload: unknown = {}) => {
                checkStart(label);
                const raw = await call(active, ['ui', '--config-dir', config], JSON.stringify({ protocol_version: 31, operation, payload }));
                const reply = JSON.parse(raw); assert.equal(reply.protocol_version, 31); assert.ok(reply.result); return reply.result;
            };
            await ui(pipe, 'set_ui_language', 'set_ui_language', { ui_language: language });
            const row = async (writer: LanguageCommand) => {
                for (const output of LANGUAGES) {
                    const realPipe = mode === 'baseline' || output === control, write = realPipe ? pipe : writer;
                    const current = await ui(write, output + '/read', 'read'), before = readFileSync(display);
                    const draft = structuredClone(current.draft); draft.display.statusline_language = output;
                    assert.equal((await ui(write, output + '/preview', 'preview', { draft, width: 80 })).sample, true);
                    assert.deepEqual(readFileSync(display), before);
                    await ui(write, output + '/apply', 'apply', { draft, expected_revision: current.revision });
                    const reopen = async (read: LanguageCommand) => {
                        const reopened = (await ui(read, output + '/reopen', 'read')).draft.display.statusline_language;
                        const preference = (await ui(read, output + '/preference', 'read_ui_preferences')).ui_language;
                        assert.equal(reopened, output); assert.equal(preference, language);
                        checkStart(output + '/render');
                        const actual = await read(active, ['render'], '{"context_window":{"remaining_percentage":50}}');
                        assert(actual.includes('50%'));
                        if (rendered.has(output)) assert.equal(actual, rendered.get(output), 'UI preference changed output language');
                        else rendered.set(output, actual);
                        pairs.push({ ui_language: language, output_language: output, preview_sample: true, readonly_preview: true,
                            reopened_output: reopened, reopened_ui: preference, render_sha256: digest(actual) });
                    };
                    if (realPipe) await reopen(pipe);
                    else {
                        checkStart(output + '/open-reader'); launches.reader++;
                        await withLanguageWorker(options, reopen);
                    }
                }
            };
            if (mode === 'baseline') await row(pipe);
            else {
                checkStart('open-writer'); launches.writer++;
                await withLanguageWorker(options, row);
            }
            const receipt = { language, elapsed_ms: performance.now() - start, pairs: pairs.length - first, cold_control: mode === 'optimized' ? control : null };
            assert(receipt.elapsed_ms <= LANGUAGE_ROW_MS, 'Language row exceeded its cleanup envelope: ' + language);
            rows.push(receipt); record({ phase: 'pass', ...receipt });
        }
        const obligations = pairs.map(pair => [pair.ui_language, pair.output_language]);
        assert.deepEqual(obligations, LANGUAGES.flatMap(ui => LANGUAGES.map(output => [ui, output])));
        const count = LANGUAGES.length;
        assert.deepEqual(launches, mode === 'baseline' ? { cli: 3 + count + 6 * count ** 2, writer: 0, reader: 0 }
            : { cli: 3 + count + 6 * count, writer: count, reader: count * (count - 1) });
        if (report) writeFileSync(report + '.language.json', JSON.stringify({
            schema_version: 1, status: 'pass', promotable: false, mode, commit: installed.packed.source.commit, tarball_sha256: installed.packed.sha256,
            node: process.version, platform: process.platform, arch: process.arch, target: process.env.TS05_TARGET ?? 'local',
            elapsed_ms: performance.now() - started, candidate_launches: launches.cli + launches.writer + launches.reader, launches,
            combinations: pairs.length, obligations_sha256: digest(JSON.stringify(obligations)), content_sha256: digest(JSON.stringify({ resources, pairs })),
            resources, pairs, rows,
        }, null, 2) + '\n', { flag: 'wx' });
        observedPairs?.(pairs);
        return { languages: LANGUAGES, combinations: pairs.length, effective_resources: true, readonly_preview: true, save_reopen: true, installed_modules: true, model_calls: 0 };
    } catch (error) {
        record({ phase: 'fail', operation: active, completed_pairs: pairs.length, error: String(error) });
        throw error;
    }
}
