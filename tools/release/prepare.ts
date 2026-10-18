/** Read-only candidate readiness, never uploads, tags or publishes. */
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { verifyDelivery } from '../build/verify.js';
export const INSTALL_TARGETS = ['ubuntu-24.04-x64', 'windows-2025-x64', 'windows-11-arm-x64', 'macos-14-arm64', 'macos-15-arm64', 'macos-15-intel-x64', 'macos-26-arm64', 'macos-26-intel-x64'];
export const HOST_TARGETS = [...['2.1.287', '2.1.288', '2.1.289', '2.1.294', '2.1.296'].map(host => 'linux-' + host), ...['win32', 'darwin'].flatMap(os => ['2.1.288', '2.1.289', '2.1.294', '2.1.296'].map(host => os + '-' + host))];
export function assessEvidence(reports: any[], commit: string, sha256: string) {
    const typesUnavailable: string[] = [], seen = new Set<string>();
    for (const report of reports) {
        assert.equal(report.status, 'pass', 'Failed/skipped evidence cannot pass');
        assert.equal(report.commit, commit, 'Evidence belongs to another commit');
        assert.equal(report.tarball_sha256, sha256, 'Evidence belongs to another artifact');
        assert(!seen.has(report.target), 'Duplicate target evidence'); seen.add(report.target);
        if (INSTALL_TARGETS.includes(report.target)) {
            assert.equal(report.offline_install, true); assert.equal(report.initially_empty_npm_cache, true);
            assert.equal(report.lifecycle_scripts, false); assert.equal(report.outside_checkout, true);
            assert.equal(report.path_excludes_python_and_compilers, true);
            if (report.target.startsWith('windows-')) {
                assert.equal(report.powershell_setup?.status, 'pass', 'Windows shell environment evidence is required');
                assert.equal(report.powershell_setup.candidate_invoked, false);
                assert.equal(report.powershell_setup.receipt.status, 0);
                assert.equal(report.powershell_setup.receipt.timeout_ms, 60000);
                assert.equal(report.powershell_setup.receipt.error, null);
            }
            assert.equal(Object.keys(report.checks).length, 10); assert(Object.values(report.checks).every(value => value === true));
        } else {
            assert(HOST_TARGETS.includes(report.target), 'Unexpected host target');
            assert.equal(report.target, report.platform + '-' + report.host);
            assert.equal(report.model_calls, 0);
            const required = Number(report.host.split('.')[2]) >= 289 ? ['statusline-native', 'statusline-runtime'] : ['statusline-native'];
            for (const name of required) {
                const mod = report.mods[name]; assert.equal(mod.validation, 'pass'); assert.equal(mod.official_tests, 'pass');
                if (report.host === '2.1.296') { assert.equal(mod.types.status, 'unavailable'); assert(mod.types.reason); typesUnavailable.push(report.target + '/' + name); }
                else { assert.equal(mod.types.status, 'pass'); assert.equal(mod.types.host, report.host); }
            }
            assert.equal(report.installed.status, 'pass'); assert.equal(report.installed.tarball_sha256, sha256);
            assert.equal(report.installed.source.commit, commit);
        }
    }
    assert.deepEqual([...seen].sort(), [...INSTALL_TARGETS, ...HOST_TARGETS].sort(), 'Incomplete candidate matrix');
    return { status: 'pass', commit, tarball_sha256: sha256, installations: 8, hosts: 13, type_declarations_unavailable: typesUnavailable, public_release: false };
}
export function evidenceFiles(root: string): any[] {
    return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
        const path = join(root, entry.name);
        if (entry.isSymbolicLink()) throw new Error('Linked evidence is not accepted');
        return entry.isDirectory() ? evidenceFiles(path) : ['installed.json', 'mods.json'].includes(entry.name) ? [JSON.parse(fs.readFileSync(path, 'utf8'))] : [];
    });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, evidence: { type: 'string' }, report: { type: 'string' }, preview: { type: 'boolean' } } });
    if (!values.artifact || !values.commit || !values.evidence || !values.report) throw new Error('Require --artifact TGZ --commit FULL_SHA --evidence DIRECTORY --report NEW_FILE');
    const candidate = verifyDelivery(resolve(values.artifact), values.commit);
    const result = assessEvidence(evidenceFiles(resolve(values.evidence)), values.commit, candidate.sha256);
    if (values.preview) assert.equal(candidate.source.channel, 'preview', 'Preview gate requires the public package');
    const report = { ...result, application_version: candidate.source.application_version, channel: candidate.source.channel ?? 'candidate',
        preview_ready: values.preview === true, stable_ready: false,
        deferred_to_stable: ['physical-macos-sleep', 'macos-14-intel-desktop-power', 'windows-10-desktop', 'wsl-desktop-popup', 'remaining-target-power-and-human-visual'] };
    fs.writeFileSync(resolve(values.report), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report));
}
