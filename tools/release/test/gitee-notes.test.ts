import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GITHUB } from '../markdown.js';
import { GITEE, renderGitee, writeNotes, type Release } from '../gitee-notes.js';
import { repoRoot } from '../../migration/ts-03/common.js';
function release(tag: string, body = ''): [
    Release,
    Release
] {
    const version = tag.slice(1), numbers = version.match(/^(\d+)\.(\d+)\.(\d+)/u)!.slice(1).map(Number);
    const current = numbers[0]! > 1 || numbers[1]! > 7 || numbers[1] === 7 && numbers[2]! >= 4;
    const prefix = current ? 'fbincon_claude_code_statusline' : 'claude_code_statusline';
    const assets = (numbers[0]! >= 3 ? [`fbincon-claude-code-statusline-${version}.tgz`, `claude-code-statusline-${version}-source.tar.gz`, 'build-manifest.json', 'SHA256SUMS'] : [`${prefix}-${version}-py3-none-any.whl`, `${prefix}-${version}.tar.gz`, 'SHA256SUMS']).map(name => ({ name, browser_download_url: `${GITEE}/releases/download/${tag}/${name}` }));
    const source: Release = { tag_name: tag, prerelease: version.includes('-') || /(?:a|b|rc)\d+$/u.test(version), draft: false, body, html_url: `${GITHUB}/releases/tag/${tag}`, published_at: '2026-10-08T01:00:00Z', assets: structuredClone(assets) };
    return [source, { tag_name: tag, prerelease: source.prerelease, assets }];
}
test('tests.integration.test_release_documentation.GiteeNotesTests.test_all_repository_release_bodies', () => {
    const pairs = fs.readdirSync(join(repoRoot, 'docs/releases')).filter(n => /^v.*\.md$/u.test(n)).map(n => release(n.slice(0, -3), fs.readFileSync(join(repoRoot, 'docs/releases', n), 'utf8')));
    for (const [source] of pairs) {
        const out = renderGitee(source.tag_name, source, pairs.map(p => p[1]));
        assert.ok(!out.includes(GITHUB + '/releases/download/'));
        assert.equal(out.split('## Gitee installation and downloads').length, 2);
        assert.ok(out.includes('简体中文'));
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

test('preview notes require all four matching assets and retain beta installation', () => {
    const [source, target] = release('v3.0.0-beta.1', 'npm install --global @fbincon/claude-code-statusline@beta');
    assert.ok(renderGitee(source.tag_name, source, [target]).includes('@beta'));
    assert.throws(() => renderGitee(source.tag_name, source, [{ ...target, assets: target.assets.slice(1) }]));
    assert.throws(() => renderGitee(source.tag_name, { ...source, assets: source.assets.slice(1) }, [target]));
});
