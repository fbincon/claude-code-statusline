import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { checkCommunity } from '../community.js';
import { checkDocs } from '../docs.js';

function fixture(t: TestContext) {
    const root = fs.mkdtempSync(join(tmpdir(), 'community checks '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    const write = (name: string, body: string) => {
        const path = join(root, name); fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, body);
    };
    const yaml = (name: string, value: unknown) => write('.github/ISSUE_TEMPLATE/' + name, stringify(value));
    return { root, write, yaml, check: () => checkCommunity(root) };
}
const form = () => ({ name: 'Bug / 问题', description: 'Report a problem / 报告问题', body: [
    { type: 'markdown', attributes: { value: '[Guide](../../docs/USER_GUIDE.md)' } },
    { type: 'input', id: 'version', attributes: { label: 'Version / 版本' }, validations: { required: true } },
    { type: 'dropdown', id: 'channel', attributes: { label: 'Channel / 渠道', options: ['npm', 'Source / 源码'] } },
] });

test('valid bilingual forms and chooser links expose Markdown for link checks', t => {
    const f = fixture(t);
    assert.deepEqual(f.check(), { errors: [], markdown: [] });
    f.yaml('bug_report.yml', form());
    f.yaml('config.yml', { blank_issues_enabled: true, contact_links: [{ name: 'Guide', url: 'https://example.com/guide', about: 'Read the guide / 阅读指南' }] });
    const result = f.check();
    assert.deepEqual(result.errors, []);
    assert(result.markdown.some(item => item.text.includes('../../docs/USER_GUIDE.md')));
    assert(result.markdown.some(item => item.text.includes('https://example.com/guide')));
});

test('malformed YAML, duplicate keys and invalid form structure fail', t => {
    const f = fixture(t);
    for (const source of ['body: [', 'name: first\nname: second\n', '', '[]', 'name: Missing body\ndescription: Example\n']) {
        f.write('.github/ISSUE_TEMPLATE/bug_report.yml', source);
        assert(f.check().errors.length > 0, source);
    }
    for (const changes of [{ name: '' }, { description: false }, { body: [] }, { body: [{ type: 'unknown' }] }, { body: [{ type: 'markdown', attributes: { value: 'No input' } }] }]) {
        f.yaml('bug_report.yml', { ...form(), ...changes });
        assert(f.check().errors.length > 0, JSON.stringify(changes));
    }
});

test('invalid and duplicate field IDs, required flags and dropdowns fail', t => {
    const f = fixture(t);
    for (const field of [
        { type: 'input', attributes: { label: 'Missing ID' } },
        { type: 'input', id: 'bad id', attributes: { label: 'Invalid ID' } },
        { type: 'input', id: 'version', attributes: { label: 'Duplicate ID' } },
        { type: 'input', id: 'extra', attributes: {}, validations: { required: 'true' } },
        { type: 'dropdown', id: 'extra', attributes: { label: 'Empty options', options: [] } },
        { type: 'dropdown', id: 'extra', attributes: { label: 'Repeated options', options: ['a', 'a'] } },
        { type: 'dropdown', id: 'extra', attributes: { label: 'Bad default', options: ['a'], default: 1 } },
    ]) {
        f.yaml('bug_report.yml', { ...form(), body: [...form().body, field] });
        assert(f.check().errors.length > 0, JSON.stringify(field));
    }
});

test('chooser entries need a name, an HTTP(S) URL and an explanation', t => {
    const f = fixture(t);
    for (const config of [
        { blank_issues_enabled: 'true' }, { contact_links: {} }, { contact_links: [null] },
        { contact_links: [{ name: 'Security', url: 'https://example.com' }] },
        { contact_links: [{ name: 'Security', url: '../../SECURITY.md', about: 'Report privately' }] },
        { contact_links: [{ name: 'Security', url: 'file:///tmp/private', about: 'Report privately' }] },
    ]) {
        f.yaml('config.yml', config);
        assert(f.check().errors.length > 0, JSON.stringify(config));
    }
});

test('documentation checks cover community links and require paired root policies only', t => {
    const f = fixture(t);
    for (const [suffix, heading, editor, legacy, release] of [
        ['', 'Common configuration', 'native-configuration-editor', 'v130a2-external-tui-and-in-session-client', 'v130-preview-rollout'],
        ['.zh-CN', '常用配置', '原生配置编辑器', 'v130a2外部-tui-与会话内-client', 'v130-预览推进'],
    ]) {
        f.write(`README${suffix}.md`, `## ${heading}\n/statusline-configure-native\n/statusline-configure\n/statusline-config\nclaude-statusline configure\nclaude-statusline config\n<a id="${legacy}"></a>\n`);
        f.write(`docs/USER_GUIDE${suffix}.md`, `[Editor](#${editor})\n<a id="${editor}"></a>\n<a id="${legacy}"></a>\n2.1.287 2.1.258 claude-statusline-native.json\n`);
        f.write(`docs/RELEASING${suffix}.md`, `<a id="${release}"></a>\n`);
    }
    f.write('.github/pull_request_template.md', '# Change / 修改\n[Guide](../docs/USER_GUIDE.md)\n');
    f.yaml('bug_report.yml', form());
    assert.deepEqual(checkDocs(f.root).errors, []);
    f.write('SECURITY.md', '# Security\n');
    assert.deepEqual(checkDocs(f.root).errors, ['SECURITY.md: missing bilingual counterpart']);
    f.write('SECURITY.zh-CN.md', '# 安全\n');
    f.write('.github/pull_request_template.md', '[Missing](../CONTRIBUTING.md)\n');
    f.yaml('config.yml', { contact_links: [{ name: 'Missing', url: 'https://github.com/fbincon/claude-code-statusline/blob/main/docs/missing.md', about: 'Unavailable guide' }] });
    f.yaml('bug_report.yml', { ...form(), body: [...form().body, { type: 'markdown', attributes: { value: '[Bad anchor](../../docs/USER_GUIDE.md#missing)' } }] });
    const errors = checkDocs(f.root).errors;
    assert.equal(errors.length, 3);
    assert(errors.some(error => error.startsWith('.github/pull_request_template.md: missing')));
    assert(errors.some(error => error.startsWith('.github/ISSUE_TEMPLATE/config.yml: missing')));
    assert(errors.some(error => error.includes('bug_report.yml: missing anchor')));
});
