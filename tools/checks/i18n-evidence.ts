/** Source-bound language evidence; this module and its pure analyzer are exported from the accepted base. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { analyze, assertReady, canonical, hash, languageInputPath, parseJson, requiresLanguageEvidence, type Inputs, type LanguageReport } from '../generation/i18n/analysis.ts';

export interface LanguageEvidence { schema_version: 1; source_commit: string; report_sha256: string; report: LanguageReport }
const selected = (path: string) => languageInputPath(path) || path === 'packages/core/src/release.ts';
export function readLanguageInputs(root: string): Map<string, Uint8Array> {
    const result = new Map<string, Uint8Array>();
    const walk = (path: string) => {
        if (!fs.existsSync(join(root, path))) return;
        const stat = fs.lstatSync(join(root, path)); assert(!stat.isSymbolicLink(), 'Linked language input');
        if (stat.isDirectory()) for (const name of fs.readdirSync(join(root, path)).sort()) walk(path + '/' + name);
        else if (selected(path)) { assert(stat.isFile() && stat.size <= 32 * 1024 * 1024, 'Invalid language input file'); result.set(path, fs.readFileSync(join(root, path))); }
    };
    for (const path of ['packages/core/resources/i18n', 'tools/generation/i18n', 'tools/generation/resources.ts', 'packages/core/src/release.ts']) walk(path);
    return result;
}
export function languageInputsAt(commit: string): Map<string, Uint8Array> {
    assert.match(commit, /^[a-f0-9]{40}$/u);
    const git = (...args: string[]) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    return new Map(git('ls-tree', '-r', '-z', commit).toString().split('\0').filter(Boolean).flatMap(row => {
        const split = row.indexOf('\t'), path = row.slice(split + 1); if (!selected(path)) return [];
        assert(/^100(?:644|755) blob /u.test(row), 'Language input must be a regular Git blob');
        return [[path, git('cat-file', 'blob', row.slice(0, split).split(' ')[2]!)] as [string, Uint8Array]];
    }));
}
export function languageEvidence(inputs: Inputs, commit: string): LanguageEvidence | undefined {
    assert.match(commit, /^[a-f0-9]{40}$/u);
    if (!requiresLanguageEvidence(inputs)) return undefined;
    const { report } = analyze(inputs); assertReady(report);
    return { schema_version: 1, source_commit: commit, report_sha256: hash(canonical(report)), report };
}
export function verifyLanguageEvidence(value: LanguageEvidence | undefined, inputs: Inputs, commit: string, release = false): void {
    const expected = languageEvidence(inputs, commit); assert.deepEqual(value, expected, 'Language evidence differs from immutable inputs');
    if (expected) assertReady(expected.report, release);
}
export function verifySourceLanguage(value: LanguageEvidence | undefined, commit: string, release = false): void {
    verifyLanguageEvidence(value, languageInputsAt(commit), commit, release);
}
export function verifyPackLanguages(inputs: Inputs, entries: ReadonlyMap<string, Uint8Array>): void {
    if (!requiresLanguageEvidence(inputs)) return;
    const result = analyze(inputs); assertReady(result.report);
    for (const { code } of result.registry) {
        const bytes = entries.get('node_modules/@fbincon/statusline-core/resources/i18n/locales/' + code + '.json');
        assert(bytes, 'Missing effective package language');
        assert.deepEqual(parseJson(bytes), result.effective[code], 'Packaged language is not the effective resource');
    }
    assert(![...entries.keys()].some(path => path.includes('tools/generation/i18n/') || /\/i18n\/(?:data|accepted|baseline|history)\//u.test(path)), 'Build-only language inputs leaked into the package');
}
