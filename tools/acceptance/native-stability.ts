/** Repeat the original long scenario without changing its body, assertions or deadline. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { repoRoot } from '../migration/ts-03/common.js';
import { sha256 } from '../build/files.js';
import { claudeLaunch } from '@fbincon/statusline-platform/commands';
import { isolatedHostEnvironment } from './mod-types.js';
import { retainLog } from './diagnostics.js';
const [reportPath, executable = 'claude'] = process.argv.slice(2); assert(reportPath);
const output = resolve(reportPath), host = claudeLaunch(executable), root = fs.mkdtempSync(join(tmpdir(), 'native-stability-'));
const name = 'changed host kinds and choices are refused per row while independent rows apply';
const original = fs.readFileSync(join(repoRoot, 'mods/statusline-native/tests/integration/advanced.test.ts'), 'utf8');
const parsed = ts.createSourceFile('advanced.test.ts', original, ts.ScriptTarget.Latest, true);
const selected = parsed.statements.filter(statement => !ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression) ||
    !ts.isIdentifier(statement.expression.expression) || statement.expression.expression.text !== 'test' ||
    (statement.expression.arguments[0] && ts.isStringLiteral(statement.expression.arguments[0]) && statement.expression.arguments[0].text === name));
assert.equal(selected.filter(statement => ts.isExpressionStatement(statement)).length, 1, 'Select exactly the unchanged long test');
const source = selected.map(statement => original.slice(statement.getFullStart(), statement.end)).join('\n');
const samples: any[] = []; const report: any = { status: 'fail', scenario: name, source_sha256: sha256(original), selected_sha256: sha256(source), original_deadline_ms: 20000, samples };
function copy(from: string, to: string): void {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        if (['node_modules', 'types'].includes(entry.name)) continue;
        if (entry.isDirectory()) copy(join(from, entry.name), join(to, entry.name));
        else if (entry.isFile() && !/\.test\.tsx?$/u.test(entry.name)) fs.copyFileSync(join(from, entry.name), join(to, entry.name));
    }
}
try {
    const mod = join(root, 'statusline-native'); copy(join(repoRoot, 'mods/statusline-native'), mod);
    fs.writeFileSync(join(mod, 'tests/integration/advanced.test.ts'), source);
    const env = isolatedHostEnvironment(process.env, join(root, 'host'));
    const version = spawnSync(host.executable, [...host.args, '--version'], { env, encoding: 'utf8', timeout: 30000 });
    assert.equal(version.status, 0); report.host = version.stdout.trim();
    for (let round = 1; round <= 10; round++) {
        const started = performance.now();
        const result = spawnSync(host.executable, [...host.args, 'plugin', 'test', mod], { env, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
        const text = (result.stdout ?? '') + (result.stderr ?? '');
        const log = retainLog(join(dirname(output), 'native-stability-logs'), `round-${round}.log`, text);
        // Keep the official per-test duration, not just process startup time.
        const line = text.split(/\r?\n/u).find(value => value.includes(name));
        const duration = line?.match(/\[([\d,.]+)ms\]/u)?.[1];
        const testMs = duration ? Number(duration.replaceAll(',', '')) : null;
        samples.push({ round, elapsed_ms: performance.now() - started, test_ms: testMs, deadline_margin_ms: testMs === null ? null : 20000 - testMs, status: result.status, log });
        assert.equal(result.error, undefined, text); assert.equal(result.status, 0, text);
        assert(testMs !== null && Number.isFinite(testMs) && testMs >= 0 && testMs < 20000, 'Missing official per-test timing or exhausted original deadline');
    }
    report.status = 'pass';
} finally {
    fs.mkdirSync(dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); fs.rmSync(root, { recursive: true, force: true });
}
