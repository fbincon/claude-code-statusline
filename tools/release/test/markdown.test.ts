import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GITHUB, RAW_GITHUB, packageReadme, rewriteLinks } from '../markdown.js';
import { repoRoot } from '../../migration/ts-03/common.js';
import { join } from 'node:path';
test('tests.integration.test_release_documentation.MarkdownTests.test_fixed_tag_links_images_fragments_and_titles', () => {
    const body = '[Guide](docs/USER_GUIDE.md#要求 "title") ![image](docs/a(1).png) [here](#features)', out = packageReadme(body, 'v1.7.5');
    assert.ok(out.includes(`${GITHUB}/blob/v1.7.5/docs/USER_GUIDE.md#%E8%A6%81%E6%B1%82 "title"`));
    assert.ok(out.includes(`${RAW_GITHUB}/v1.7.5/docs/a%281%29.png`));
    assert.ok(out.includes(`${GITHUB}/blob/v1.7.5/README.md#features`));
});
test('tests.integration.test_release_documentation.MarkdownTests.test_nested_badges_reference_images_and_html', () => {
    const out = packageReadme('[![badge](docs/badge.svg)](docs/guide.md)\n![screenshot][photo]\n[photo]: <docs/my image.png> "caption"\n<a href="README.zh-CN.md">中文</a><img src="docs/a.png">\n', 'v1.7.5');
    for (const fragment of [`${RAW_GITHUB}/v1.7.5/docs/badge.svg`, `${GITHUB}/blob/v1.7.5/docs/guide.md`, `<${RAW_GITHUB}/v1.7.5/docs/my%20image.png> "caption"`, `href="${GITHUB}/blob/v1.7.5/README.zh-CN.md"`, `src="${RAW_GITHUB}/v1.7.5/docs/a.png"`])
        assert.ok(out.includes(fragment));
});
test('tests.integration.test_release_documentation.MarkdownTests.test_commands_code_spans_and_external_links_are_unchanged', () => {
    const body = '`[literal](docs/a.md)`\n```text\npipx install "git+https://github.com/fbincon/claude-code-statusline.git@main"\n[example](docs/b.md)\n```\n~~~md\n[another](docs/c.md)\n~~~\n[external](https://example.com/a) [mail](mailto:user@example.com)\n';
    assert.equal(packageReadme(body, 'v1.7.5'), body);
});
test('tests.integration.test_release_documentation.MarkdownTests.test_relative_escape_and_invalid_version_are_rejected', () => {
    assert.throws(() => packageReadme('[outside](../secret)', 'v1.7.5'));
    assert.throws(() => packageReadme('[doc](docs/a.md)', '../../main'));
});
test('tests.integration.test_release_documentation.MarkdownTests.test_conversion_is_idempotent_and_source_is_unchanged', () => {
    const path = join(repoRoot, 'README.md'), before = readFileSync(path, 'utf8'), out = packageReadme(before, 'v1.7.5');
    assert.equal(packageReadme(out, 'v1.7.5'), out);
    assert.equal(readFileSync(path, 'utf8'), before);
});
test('tests.integration.test_release_documentation.MarkdownTests.test_only_destinations_change', () => {
    assert.equal(rewriteLinks('[nested [label]](docs/a.md "a title") and `[code](docs/a.md)`', () => 'new'), '[nested [label]](new "a title") and `[code](docs/a.md)`');
});
