import test from 'node:test';
import assert from 'node:assert/strict';
import { configurationSection } from '../docs.js';
test('README configuration checks preserve the same section under Windows CRLF and POSIX LF', () => {
    for (const heading of ['Common configuration', '常用配置']) {
        const text = `# Project\n\n## ${heading}\n\n/statusline-configure-native\n\n### Child\n\nclaude-statusline config\n\n## Following\n\nwrong section\n`;
        const expected = configurationSection(text, heading);
        assert(expected.includes('/statusline-configure-native')); assert(expected.includes('claude-statusline config'));
        assert(!expected.includes('wrong section')); assert.equal(configurationSection(text.replaceAll('\n', '\r\n'), heading), expected);
    }
});
