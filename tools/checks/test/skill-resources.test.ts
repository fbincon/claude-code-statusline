import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkSkillResources } from '../skill-resources.js';

function fixture(t: TestContext) {
    const root = fs.mkdtempSync(join(tmpdir(), 'skill resources '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
    const write = (name: string, body: string) => {
        const path = join(root, name);
        fs.mkdirSync(dirname(path), { recursive: true });
        fs.writeFileSync(path, body);
    };
    return { root, write, check: () => checkSkillResources(root) };
}
const skill = (name: string, tools = 'allowed-tools:\n  - Read\n', hint = '"[show|set]"', description = 'Fixture skill.',
    placeholder = '__CLAUDE_STATUSLINE_ALLOWED_RULES__\n') =>
    `---\nname: ${name}\ndescription: ${description}\nargument-hint: ${hint}\ndisable-model-invocation: true\n${tools}${placeholder}---\n\n# ${name}\n\nBody.\n`;
const file = 'packages/cli/resources/statusline-config/SKILL.md';
const configureFile = 'packages/cli/resources/statusline-configure/SKILL.md';
const configure = () => skill('statusline-configure', 'disallowed-tools:\n  - Bash\n  - PowerShell\n', '""', 'Fixture skill.', '');

test('canonical skill resources require consistent frontmatter and body structure', t => {
    const f = fixture(t);
    assert.deepEqual(f.check(), []);
    f.write(file, skill('statusline-config'));
    f.write(configureFile, configure());
    assert.deepEqual(f.check(), []);
    const cases: [string, string, RegExp][] = [
        ['missing frontmatter', '# Skill\n\nBody.\n', /missing YAML frontmatter/u],
        ['name mismatch', skill('other'), /name must match the directory/u],
        ['blank description', skill('statusline-config', undefined, undefined, ' '), /description must be a nonempty string/u],
        ['both tool archetypes', skill('statusline-config', 'allowed-tools:\n  - Read\ndisallowed-tools:\n  - Bash\n'), /either allowed-tools or disallowed-tools/u],
        ['neither tool archetype', skill('statusline-config', ''), /use allowed-tools or disallowed-tools/u],
        ['missing argument hint', skill('statusline-config').replace('argument-hint: "[show|set]"\n', ''), /argument-hint must be a string/u],
        ['non-string argument hint', skill('statusline-config', undefined, '1'), /argument-hint must be a string/u],
        ['missing disable flag', skill('statusline-config').replace('disable-model-invocation: true\n', ''), /disable-model-invocation must be true/u],
        ['false disable flag', skill('statusline-config').replace('disable-model-invocation: true', 'disable-model-invocation: false'), /disable-model-invocation must be true/u],
        ['non-boolean disable flag', skill('statusline-config').replace('disable-model-invocation: true', 'disable-model-invocation: yes'), /disable-model-invocation must be true/u],
        ['unknown placeholder', skill('statusline-config', undefined, undefined, undefined, '__CLAUDE_STATUSLINE_RULES_EXTRA__\n'), /unknown bundled skill placeholder/u],
        ['malformed placeholder', skill('statusline-config', undefined, undefined, undefined, '__CLAUDE_STATUSLINE_RULES2__\n'), /malformed bundled skill placeholder/u],
        ['empty tool list', skill('statusline-config', 'allowed-tools: []\n'), /allowed-tools must be a nonempty string array/u],
        ['missing H1', skill('statusline-config').replace('# statusline-config\n', ''), /body must contain exactly one H1/u],
        ['multiple H1', skill('statusline-config') + '\nTitle\n=====\n', /body must contain exactly one H1/u],
        ['empty body', skill('statusline-config').replace('# statusline-config\n\nBody.\n', ''), /body must not be empty/u],
    ];
    for (const [name, body, expected] of cases) {
        f.write(file, body);
        assert.match(f.check().join('\n'), expected, name);
    }
    f.write(configureFile, skill('statusline-configure', 'disallowed-tools:\n  - Bash\n', '""', 'Fixture skill.', '__CLAUDE_STATUSLINE_ALLOWED_RULES__\n'));
    assert.match(f.check().join('\n'), /external skill must not contain renderer placeholders/u);
    f.write(configureFile, configure());
    f.write(file, skill('statusline-config').replace('Body.\n', '```bash\n# comment\n```\n'));
    assert.deepEqual(f.check(), []);
    f.write(file, skill('statusline-config').replace('# statusline-config\n', 'statusline-config\n=================\n'));
    assert.deepEqual(f.check(), []);
    f.write(file, skill('statusline-config').replaceAll('\n', '\r\n'));
    assert.deepEqual(f.check(), []);
    assert.deepEqual(checkSkillResources(process.cwd()), []);
    assert.ok(fs.existsSync(join(process.cwd(), 'packages/cli/resources/statusline-config/SKILL.md')));
    assert.ok(fs.existsSync(join(process.cwd(), 'packages/cli/resources/statusline-configure/SKILL.md')));
});
