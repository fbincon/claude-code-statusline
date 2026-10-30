/** Developer-only language workflow. Report/freeze/validate never update source acceptance. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { analyze, assertReady, languageInputPath, parseJson, type LanguageReport } from './analysis.ts';
import { acceptValidation, freeze, validateSelection, type Validation } from './authoring.ts';
import { languageInputsAt, readLanguageInputs } from '../../checks/i18n-evidence.ts';

export function readable(report: LanguageReport): string {
    const rows = ['Language  Level  Raw       Current   Accepted  Fallback  Missing/Stale/Pending/Invalid  Retired'];
    for (const [code, row] of Object.entries(report.languages)) rows.push(`${code.padEnd(9)} ${row.level.padEnd(6)} ${`${row.present}/${row.total}`.padEnd(9)} ${String(row.current_valid).padEnd(9)} ${String(row.accepted).padEnd(9)} ${String(row.fallback.length).padEnd(9)} ${`${row.missing.length}/${row.stale.length}/${row.pending_validation.length}/${row.invalid.length}`.padEnd(29)} ${row.obsolete.length}`);
    rows.push(`Development: ${report.development_ready ? 'ready' : 'blocked'}; public release: ${report.release_ready ? 'ready' : 'blocked'}`);
    rows.push('Acceptance records describe their actual checks and limitations; presence is not linguistic acceptance.');
    for (const row of report.disclosure) rows.push(`Community ${row.language}: ${row.accepted}/${row.total} accepted; ${row.fallback.length} English fallbacks.`);
    return rows.join('\n') + '\n';
}
export function runLanguageCommand(args: string[], root = process.cwd()): unknown {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
        commit: { type: 'string' }, base: { type: 'string' }, output: { type: 'string' }, format: { type: 'string', default: 'json' },
        language: { type: 'string' }, keys: { type: 'string' }, review: { type: 'string' }, validation: { type: 'string' },
    } });
    assert.equal(positionals.length, 1, 'Use languages report|freeze|validate|accept|release-check');
    assert(['json', 'text'].includes(values.format!), 'Choose --format json or text');
    const output = values.output ? resolve(root, values.output) : null;
    if (output) {
        assert(!languageInputPath(relative(root, output).replaceAll('\\', '/')), 'Reports cannot overwrite language inputs');
        assert(!fs.existsSync(output), 'Use a new report output file');
    }
    const command = positionals[0]!, inputs = command === 'freeze' ? (assert(values.commit, 'freeze requires --commit FULL_SHA'), languageInputsAt(values.commit)) : readLanguageInputs(root);
    let result: any;
    if (command === 'freeze') result = freeze(inputs, values.commit!, values.base ? { inputs: languageInputsAt(values.base), commit: values.base } : undefined);
    else if (command === 'accept') {
        assert(values.validation, 'accept requires --validation FILE');
        const validation = parseJson(fs.readFileSync(resolve(root, values.validation))) as Validation, changes = acceptValidation(inputs, validation);
        // Validate the complete transition before any repository file is written.
        for (const [path, bytes] of changes) fs.writeFileSync(resolve(root, path), bytes);
        result = { schema_version: 1, kind: 'language-acceptance-update', languages: Object.keys(validation.entries), entries: Object.values(validation.entries).reduce((sum, entries) => sum + Object.keys(entries).length, 0),
            report: analyze(readLanguageInputs(root)).report };
    } else {
        const analysis = analyze(inputs);
        if (command === 'validate') result = validateSelection(analysis, values.language?.split(',') ?? analysis.registry.map(({ code }) => code), values.keys?.split(',') ?? Object.keys(analysis.contracts), values.review ?? null);
        else {
            assert(['report', 'release-check'].includes(command), 'Unknown language command'); result = analysis.report;
        }
    }
    const text = values.format === 'text' && result.kind === 'language-readiness' ? readable(result) : JSON.stringify(result, null, 2) + '\n';
    if (output) {
        fs.mkdirSync(dirname(output), { recursive: true }); fs.writeFileSync(output, text, { flag: 'wx' });
    } else process.stdout.write(text);
    if (command === 'release-check') assertReady(result, true);
    if (command === 'report') assertReady(result);
    return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runLanguageCommand(process.argv.slice(2));
