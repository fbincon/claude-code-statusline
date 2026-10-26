import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DOCUMENTATION = new Set([
    'README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'CHANGELOG.zh-CN.md',
    'SECURITY.md', 'SECURITY.zh-CN.md', 'CONTRIBUTING.md', 'CONTRIBUTING.zh-CN.md',
    '.github/pull_request_template.md', '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/config.yml', '.github/ISSUE_TEMPLATE/preview-feedback.yml',
]);

/** Only explicitly maintained documentation and community templates may avoid the product matrix. */
export function documentationOnly(event: string, refType: string, paths: readonly string[]): boolean {
    return ['pull_request', 'push'].includes(event) && refType === 'branch' && paths.length > 0 &&
        paths.every(path => DOCUMENTATION.has(path) || /^docs\/(?:[^/]+\/)*[^/]+\.md$/u.test(path));
}

export function changedDocumentationOnly(event: string, refType: string, base: string, head: string): boolean {
    if (!['pull_request', 'push'].includes(event) || refType !== 'branch' ||
        !/^[a-f0-9]{40}$/u.test(base) || /^0+$/u.test(base) || !/^[a-f0-9]{40}$/u.test(head)) return false;
    try {
        const revisions = event === 'pull_request' ? [base + '...' + head] : [base, head];
        // Show both sides of renames, so moving executable content cannot hide it.
        const files = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', ...revisions, '--'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return documentationOnly(event, refType, files.split('\0').filter(Boolean));
    } catch {
        return false;
    }
}

export function assessCiNeeds(needs: Record<string, { result: string; outputs?: Record<string, string> }>): void {
    assert.equal(needs.scope?.result, 'success', 'CI scope classification did not pass');
    const documentation = needs.scope.outputs?.docs_only === 'true';
    if (documentation) assert.equal(needs.documentation?.result, 'success', 'Documentation checks did not pass');
    for (const name of ['candidate', 'installed', 'runtime', 'mods'])
        assert.equal(needs[name]?.result, documentation ? 'skipped' : 'success', 'Unexpected CI result for ' + name);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    if (process.argv[2] === 'gate') assessCiNeeds(JSON.parse(process.env.CI_NEEDS ?? '{}'));
    else {
        const result = changedDocumentationOnly(process.env.CI_EVENT ?? '', process.env.CI_REF_TYPE ?? '', process.env.CI_BASE ?? '', process.env.CI_HEAD ?? '');
        assert(process.env.GITHUB_OUTPUT, 'Missing CI output path');
        appendFileSync(process.env.GITHUB_OUTPUT, `docs_only=${result}\n`);
        console.log(result ? 'Documentation allowlist: necessary checks only' : 'Full candidate and product matrix required');
    }
}
