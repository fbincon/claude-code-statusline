import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test, { type TestContext } from 'node:test';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { coldLanguageOutput, languageMode } from '../installed-language.js';
import { admitLanguageOperation, languageAcceptanceBudget, LANGUAGE_OPERATION_MS, LANGUAGE_ROW_ADMISSION_MS, LANGUAGE_ROW_MS } from '../language-budget.js';
import { withLanguageWorker } from '../installed-language-process.js';

test('original-cold language controls cover both axes exactly once and the baseline is diagnostic only', () => {
    const controls = LANGUAGES.map((_, i) => coldLanguageOutput(LANGUAGES, i));
    assert.equal(controls[0], 'en');
    assert.deepEqual([...controls].sort(), [...LANGUAGES].sort());
    assert(controls.slice(1).every((output, i) => output !== LANGUAGES[i + 1]));
    assert.equal(languageMode(undefined, undefined), 'optimized');
    assert.equal(languageMode('baseline', 'installed effective languages'), 'baseline');
    assert.throws(() => languageMode('baseline', ''), /diagnostic/);
    assert.throws(() => languageMode('other', 'pattern'), /unknown/);
});
test('a language row cannot admit another operation at expiry, and its enclosing budget includes final call and cleanup', () => {
    admitLanguageOperation(1, 'last admitted operation', LANGUAGE_ROW_ADMISSION_MS);
    assert.throws(() => admitLanguageOperation(1, 'next operation', LANGUAGE_ROW_ADMISSION_MS + 1), /before next operation/);
    assert(LANGUAGE_ROW_MS > LANGUAGE_ROW_ADMISSION_MS + LANGUAGE_OPERATION_MS);
    assert.equal(languageAcceptanceBudget(12), 3_030_000);
    assert.equal(languageAcceptanceBudget(13) - languageAcceptanceBudget(12), LANGUAGE_ROW_MS);
    assert.throws(() => languageAcceptanceBudget(0));
});

function fixture(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'installed-language-'));
    t.after(() => { removeTree(directory); assert(!existsSync(directory)); });
    writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
    writeFileSync(join(directory, 'main.js'), `
        import fs from 'node:fs';
        let saved = false;
        export async function main(args, io) {
            const input = io.stdin();
            if (args[0] === 'write') { saved = true; fs.writeFileSync('saved', input); }
            if (args[0] === 'block') { fs.writeFileSync('blocked-pid', String(process.pid)); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); }
            if (args[0] === 'bad') { io.stderr('operation rejected'); return 2; }
            if (args[0] === 'noise') { process.stdout.write('noise'); return 0; }
            if (args[0] === 'large') { io.stdout('x'.repeat(1024 * 1024 + 1)); return 0; }
            io.stdout(JSON.stringify({pid:process.pid,saved,file:fs.readFileSync('saved','utf8'),width:process.env.COLUMNS}));
            return 0;
        }
    `);
    return { directory, node: process.execPath, entry: join(directory, 'entry.js'),
        worker: fileURLToPath(new URL('../installed-language-worker.js', import.meta.url)), env: { ...process.env, COLUMNS: '73' } };
}
test('warm writer and fresh reader enter the selected CLI, reopen real bytes, and isolate render width', async t => {
    const options = fixture(t);
    await withLanguageWorker(options, async writer => {
        const written = JSON.parse(await writer('write', ['write'], '保存 🐈'));
        await withLanguageWorker(options, async reader => {
            const reopened = JSON.parse(await reader('read', ['read'], ''));
            assert.notEqual(written.pid, reopened.pid); assert.equal(written.saved, true); assert.equal(reopened.saved, false);
            assert.equal(reopened.file, '保存 🐈'); assert.equal(reopened.width, '73');
            assert.equal(JSON.parse(await reader('render', ['render'], '')).width, '120');
            assert.equal(JSON.parse(await reader('reopen', ['read'], '')).width, '73');
            await assert.rejects(reader('bad', ['bad'], ''), /operation rejected/);
            await assert.rejects(reader('large', ['large'], ''), /stdout limit/);
        });
        assert.equal(JSON.parse(await writer('read', ['read'], '')).pid, written.pid);
    });
});
test('unexpected direct machine-protocol stdout cannot disappear behind worker IPC', async t => {
    await assert.rejects(withLanguageWorker(fixture(t), call => call('noise', ['noise'], '')), /direct stdout/);
});
test('external operation timer terminates a synchronously blocked language worker and waits for exit', async t => {
    const options = fixture(t);
    await assert.rejects(withLanguageWorker(options, call => call('blocked preview', ['block'], ''), 500), /timed out: blocked preview/);
    const pid = Number(readFileSync(join(options.directory, 'blocked-pid'), 'utf8'));
    assert.throws(() => process.kill(pid, 0), (error: NodeJS.ErrnoException) => error.code === 'ESRCH');
});
