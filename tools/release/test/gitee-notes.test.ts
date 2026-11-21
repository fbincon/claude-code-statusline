import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GITHUB, TAG } from '../markdown.js';
import { GITEE, renderGitee, writeNotes, type Release } from '../gitee-notes.js';
import { repoRoot } from '../../migration/ts-03/common.js';
const METADATA = ['build-manifest.json', 'SHA256SUMS'];
function release(tag: string, body = '', giteeLarge = false): [
    Release,
    Release
] {
    const version = tag.slice(1), numbers = version.match(/^(\d+)\.(\d+)\.(\d+)/u)!.slice(1).map(Number);
    const current = numbers[0]! > 1 || numbers[1]! > 7 || numbers[1] === 7 && numbers[2]! >= 4;
    const prefix = current ? 'fbincon_claude_code_statusline' : 'claude_code_statusline';
    const typescript = numbers[0]! >= 3;
    const names = typescript ? [`fbincon-claude-code-statusline-${version}.tgz`, `claude-code-statusline-${version}-source.tar.gz`, ...METADATA] : [`${prefix}-${version}-py3-none-any.whl`, `${prefix}-${version}.tar.gz`, 'SHA256SUMS'];
    const sourceAssets = names.map(name => ({ name, browser_download_url: `${GITHUB}/releases/download/${tag}/${name}` }));
    const targetNames = typescript && !giteeLarge ? METADATA : names;
    const targetAssets = targetNames.map(name => ({ name, browser_download_url: `${GITEE}/releases/download/${tag}/${name}` }));
    const source: Release = { tag_name: tag, prerelease: version.includes('-') || /(?:a|b|rc)\d+$/u.test(version), draft: false, body, html_url: `${GITHUB}/releases/tag/${tag}`, published_at: '2026-10-08T01:00:00Z', assets: structuredClone(sourceAssets) };
    return [source, { tag_name: tag, prerelease: source.prerelease, assets: targetAssets }];
}
test('tests.integration.test_release_documentation.GiteeNotesTests.test_all_repository_release_bodies', () => {
    const pairs = fs.readdirSync(join(repoRoot, 'docs/releases')).filter(n => n.endsWith('.md')&&TAG.test(n.slice(0,-3))).map(n => release(n.slice(0, -3), fs.readFileSync(join(repoRoot, 'docs/releases', n), 'utf8')));
    for (const [source] of pairs) {
        const out = renderGitee(source.tag_name, source, pairs.map(p => p[1]));
        const typescript = source.assets.some(asset => asset.name.endsWith('.tgz'));
        assert.equal(out.split('## Gitee installation and downloads').length, 2);
        assert.ok(out.includes('简体中文'));
        if (typescript) {
            const packageName = source.assets.find(asset => asset.name.endsWith('.tgz'))!.name, sourceName = source.assets.find(asset => asset.name.endsWith('-source.tar.gz'))!.name;
            assert.ok(out.includes(`${GITHUB}/releases/download/${source.tag_name}/${packageName}`));
            assert.ok(out.includes(`${GITHUB}/releases/download/${source.tag_name}/${sourceName}`));
            assert.ok(!out.includes(`${GITEE}/releases/download/${source.tag_name}/${packageName}`));
            assert.ok(!out.includes(`${GITEE}/releases/download/${source.tag_name}/${sourceName}`));
            assert.ok(out.includes(`${GITEE}/releases/download/${source.tag_name}/build-manifest.json`));
            assert.ok(out.includes(`${GITEE}/releases/download/${source.tag_name}/SHA256SUMS`));
            assert.ok(out.includes('1 GB'));
        }
        else
            assert.ok(!out.includes(GITHUB + '/releases/download/'));
    }
});
test('tests.integration.test_release_documentation.GiteeNotesTests.test_relative_docs_resolve_from_release_file', () => {
    const [s, t] = release('v1.7.2', '[guide](../USER_GUIDE.zh-CN.md#安装与接入) [English](#english)'), out = renderGitee(s.tag_name, s, [t]);
    assert.ok(decodeURIComponent(out).includes(GITEE + '/blob/v1.7.2/docs/USER_GUIDE.zh-CN.md#安装与接入'));
    assert.ok(out.includes('[English](#english)'));
});
test('tests.integration.test_release_documentation.GiteeNotesTests.test_commands_use_actual_assets_and_preserve_git_refs', () => {
    const [s, t] = release('v1.7.2', 'pipx install "git+https://github.com/fbincon/claude-code-statusline.git@main"\npipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.7.2"');
    const out = renderGitee(s.tag_name, s, [t]);
    assert.ok(out.includes('git+' + GITEE + '.git@main'));
    assert.ok(out.includes('git+' + GITEE + '.git@v1.7.2'));
    assert.ok(out.includes(t.assets[0]!.browser_download_url!));
});
test('tests.integration.test_release_documentation.GiteeNotesTests.test_download_link_retained_but_pipx_installs_local_wheel', () => {
    const [s, t] = release('v1.7.5');
    s.body = `[download](${GITHUB}/releases/download/${s.tag_name}/${s.assets[0]!.name})\npipx install "${GITHUB}/releases/download/${s.tag_name}/${s.assets[0]!.name}"`;
    const out = renderGitee(s.tag_name, s, [t]);
    assert.ok(out.includes(t.assets[0]!.browser_download_url!));
    assert.ok(out.includes(`pipx install "./${s.assets[0]!.name}"`));
});
test('tests.integration.test_release_documentation.GiteeNotesTests.test_pinned_index_install_uses_local_wheel_and_rejects_another_version', () => {
    const [s, t] = release('v1.7.6', 'pipx install --force fbincon-claude-code-statusline==1.7.6');
    assert.ok(renderGitee(s.tag_name, s, [t]).includes(`pipx install --force "./${s.assets[0]!.name}"`));
    s.body = 'pipx install --force fbincon-claude-code-statusline==1.7.7';
    assert.throws(() => renderGitee(s.tag_name, s, [t]), /Pinned installation/u);
});
test('tests.integration.test_release_documentation.GiteeNotesTests.test_keep_github_workflows_issues_and_original_provenance', () => {
    const [s, t] = release('v1.7.2', `[CI](${GITHUB}/actions/runs/42) [issues](${GITHUB}/issues) [doc](${GITHUB}/blob/main/README.md)`), out = renderGitee(s.tag_name, s, [t]);
    for (const value of [GITHUB + '/actions/runs/42', GITHUB + '/issues', GITEE + '/blob/main/README.md', s.html_url!, s.published_at!])
        assert.ok(out.includes(value));
});
test('tests.integration.test_release_documentation.GiteeNotesTests.test_missing_asset_duplicate_target_and_prerelease_mismatch', () => {
    const [s, t] = release('v1.7.0a1');
    for (const targets of [[], [t, t], [{ ...t, assets: t.assets.slice(0, -1) }], [{ ...t, prerelease: false }]])
        assert.throws(() => renderGitee(s.tag_name, s, targets));
});
test('tests.integration.test_release_documentation.GiteeNotesTests.test_wrong_identity_tag_url_and_unpublished_source', () => {
    const [s, t] = release('v1.7.5');
    for (const source of [{ ...s, tag_name: 'v1.7.4' }, { ...s, draft: true }, { ...s, html_url: 'https://example.com/release' }, { ...s, assets: [{ name: 'foreign.whl' }, ...s.assets.slice(1)] }])
        assert.throws(() => renderGitee(s.tag_name, source, [t]));
    const invalid = structuredClone(t);
    invalid.assets[0]!.browser_download_url = 'https://example.com/foreign.whl';
    assert.throws(() => renderGitee(s.tag_name, s, [invalid]));
});
test('tests.integration.test_release_documentation.GiteeNotesTests.test_cross_version_asset_requires_matching_release', () => {
    const [s, t] = release('v1.7.2'), [old, other] = release('v1.7.1');
    s.body = `[previous](${GITHUB}/releases/download/v1.7.1/${old.assets[0]!.name})`;
    assert.throws(() => renderGitee(s.tag_name, s, [t]));
    assert.ok(renderGitee(s.tag_name, s, [t, other]).includes(other.assets[0]!.browser_download_url!));
});
test('tests.integration.test_release_documentation.GiteeNotesTests.test_repeat_render_retains_source_and_release_metadata', () => {
    const [s, t] = release('v1.7.0a1', 'Old support claims remain here.'), before = JSON.stringify([s, t]), first = renderGitee(s.tag_name, s, [t]);
    assert.equal(renderGitee(s.tag_name, s, [t]), first);
    assert.equal(JSON.stringify([s, t]), before);
    assert.ok(first.includes(s.body!));
});
test('tests.integration.test_release_documentation.GiteeNotesTests.test_cli_rejects_missing_assets_before_overwriting_output', t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'notes-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const [s, target] = release('v1.7.5');
    target.assets.pop();
    fs.writeFileSync(join(root, 's.json'), JSON.stringify(s));
    fs.writeFileSync(join(root, 't.json'), JSON.stringify([target]));
    const path = join(root, 'notes.md');
    fs.writeFileSync(path, 'reviewed');
    assert.throws(() => writeNotes(s.tag_name, join(root, 's.json'), join(root, 't.json'), path));
    assert.equal(fs.readFileSync(path, 'utf8'), 'reviewed');
});

test('preview notes require Gitee metadata and link large assets to GitHub', () => {
    const [source, target] = release('v3.0.0-beta.1', 'npm install --global @fbincon/claude-code-statusline@beta');
    const out = renderGitee(source.tag_name, source, [target]);
    assert.ok(out.includes('@beta'));
    assert.ok(out.includes(`${GITHUB}/releases/download/v3.0.0-beta.1/${source.assets[0]!.name}`));
    assert.ok(out.includes(`${GITHUB}/releases/download/v3.0.0-beta.1/${source.assets[1]!.name}`));
    assert.ok(out.includes(`${GITEE}/releases/download/v3.0.0-beta.1/build-manifest.json`));
    assert.ok(out.includes(`${GITEE}/releases/download/v3.0.0-beta.1/SHA256SUMS`));
    assert.throws(() => renderGitee(source.tag_name, source, [{ ...target, assets: target.assets.slice(0, 1) }]));
    assert.throws(() => renderGitee(source.tag_name, { ...source, assets: source.assets.slice(1) }, [target]));
    const [largeSource, largeTarget] = release('v3.0.0-beta.1', source.body ?? '', true);
    assert.equal(renderGitee(largeSource.tag_name, largeSource, [largeTarget]), out);
});
test('TypeScript notes require Gitee metadata and canonical GitHub large assets', () => {
    const [source, target] = release('v3.16.6', `[package](${GITHUB}/releases/download/v3.16.6/fbincon-claude-code-statusline-3.16.6.tgz)\n[checksums](${GITHUB}/releases/download/v3.16.6/SHA256SUMS)`);
    const out = renderGitee(source.tag_name, source, [target]);
    assert.ok(out.includes(`${GITHUB}/releases/download/v3.16.6/fbincon-claude-code-statusline-3.16.6.tgz`));
    assert.ok(out.includes(`${GITHUB}/releases/download/v3.16.6/claude-code-statusline-3.16.6-source.tar.gz`));
    assert.ok(out.includes(`${GITEE}/releases/download/v3.16.6/build-manifest.json`));
    assert.ok(out.includes(`${GITEE}/releases/download/v3.16.6/SHA256SUMS`));
    assert.ok(!out.includes(`${GITEE}/releases/download/v3.16.6/fbincon-claude-code-statusline-3.16.6.tgz`));
    assert.throws(() => renderGitee(source.tag_name, source, [{ ...target, assets: target.assets.slice(1) }]));
    const invalid = structuredClone(source);
    invalid.assets[0]!.browser_download_url = 'https://example.com/package.tgz';
    assert.throws(() => renderGitee(source.tag_name, invalid, [target]), /Unexpected GitHub asset URL/u);
    const invalidTarget = structuredClone(target);
    invalidTarget.assets[1]!.browser_download_url = 'https://example.com/SHA256SUMS';
    assert.throws(() => renderGitee(source.tag_name, source, [invalidTarget]), /Unexpected Gitee asset URL/u);
});
test('TypeScript cross-version large assets stay on GitHub while metadata requires Gitee', () => {
    const [source, target] = release('v3.16.6'), [, oldTarget] = release('v3.16.5');
    source.body = `[previous](${GITHUB}/releases/download/v3.16.5/fbincon-claude-code-statusline-3.16.5.tgz)\n[checksums](${GITHUB}/releases/download/v3.16.6/SHA256SUMS)`;
    const out = renderGitee(source.tag_name, source, [target]);
    assert.ok(out.includes(`${GITHUB}/releases/download/v3.16.5/fbincon-claude-code-statusline-3.16.5.tgz`));
    assert.ok(out.includes(`${GITEE}/releases/download/v3.16.6/SHA256SUMS`));
    source.body = `[checksums](${GITHUB}/releases/download/v3.16.5/SHA256SUMS)`;
    assert.throws(() => renderGitee(source.tag_name, source, [target]), /Missing matching Gitee asset/u);
    assert.ok(renderGitee(source.tag_name, source, [target, oldTarget]).includes(`${GITEE}/releases/download/v3.16.5/SHA256SUMS`));
});
