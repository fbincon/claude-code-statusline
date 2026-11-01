import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { create } from 'tar';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { sha256 } from '../../build/files.js';
import { historyProfileBudget, officialHistoryProfilePhases, officialTransitionPhases, OFFICIAL_VERSION_SEQUENCE_MS,
    supervisionBudget, versionChildBudget, versionManagementBudget, VERSION_SEQUENCE_MS } from '../budgets.js';
import { shortHistoryObserver, verifyShortInstalledArchive } from '../short-history.js';

test('the short profile admits the original baseline without either the other archive or the separate editor allowance', () => {
    for (const official of [true, false]) {
        assert.equal(versionChildBudget('3.8.0', official, 'short'), supervisionBudget([{ name: 'baseline', budgetMs: official ? OFFICIAL_VERSION_SEQUENCE_MS : VERSION_SEQUENCE_MS }]));
        for (const windows of [true, false]) {
            assert.equal(historyProfileBudget(windows, 'full', official), versionManagementBudget(windows, official));
            assert(historyProfileBudget(windows, 'short', official) < historyProfileBudget(windows, 'full', official));
            assert.deepEqual(officialHistoryProfilePhases(windows, 'full'), officialTransitionPhases(windows));
        }
    }
});

test('short history checks actual installed files, including a non-entry file, against the archive at each transition', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'short-history-')), source = join(root, 'package'), installed = join(root, 'installed'), archive = join(root, 'test.tgz');
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    const missingNative = '@koromix/koffi-' + (process.platform === 'win32' ? 'linux' : 'win32') + '-x64';
    for (const [file, bytes] of Object.entries({ 'package.json': JSON.stringify({ optionalDependencies: { [missingNative]: '3.3.3' } }),
        'entry.js': 'entry', 'config.js': 'original', ['node_modules/' + missingNative + '/native.node']: 'foreign' })) {
        fs.mkdirSync(dirname(join(source, file)), { recursive: true }); fs.writeFileSync(join(source, file), bytes);
    }
    create({ cwd: root, file: archive, gzip: true, sync: true, noDirRecurse: true }, [
        'package/package.json','package/entry.js','package/config.js','package/node_modules/' + missingNative + '/native.node',
    ]);
    fs.cpSync(source, installed, { recursive: true }); removeTree(join(installed, 'node_modules')); assert(!fs.existsSync(join(installed, 'node_modules')));
    assert.equal(verifyShortInstalledArchive(installed, archive), sha256(fs.readFileSync(archive)));
    fs.writeFileSync(join(installed, 'config.js'), 'altered');
    assert.throws(() => verifyShortInstalledArchive(installed, archive), /Installed file differs/u);
});

test('the explicit disable and reinstall probe rejects a historical package in place of the upgraded candidate', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'short-candidate-'));
    t.after(() => { removeTree(root); assert(!fs.existsSync(root)); });
    fs.writeFileSync(join(root, 'package.json'), '{"version":"3.8.0"}');
    const observer = shortHistoryObserver({ root, entry: '', node: '', npm: '', config: root, shim: '', archive: '', legacy: '', audit: '', registry: '',
        invoke: async () => { throw new Error('Must not invoke another package'); } });
    await assert.rejects(observer.disableAndReinstall('3.16.1'), /must exercise the upgraded candidate/u);
});
