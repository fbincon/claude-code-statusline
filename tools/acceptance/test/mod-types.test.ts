import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { declarationIdentity } from '../mod-types.js';

test('exact declaration evidence waits for compiler settings and every requested type file', () => {
    const directory = fs.mkdtempSync(join(tmpdir(), 'declaration-evidence-'));
    const put = (name: string, value: string) => { fs.mkdirSync(join(directory, name), { recursive: true }); fs.writeFileSync(join(directory, name, 'index.d.ts'), value); };
    try {
        put('claude-code', '// Written by Claude Code 2.1.310.\nexport {};\n');
        assert.equal(declarationIdentity(directory, '2.1.310'), null);
        fs.writeFileSync(join(directory, 'tsconfig.json'), '{"compilerOptions":');
        assert.equal(declarationIdentity(directory, '2.1.310'), null);
        fs.writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({compilerOptions: {target: 'es2023', types: ['claude-code', 'claude-code-tools']}}));
        assert.equal(declarationIdentity(directory, '2.1.310'), null);
        put('claude-code-tools', '');
        assert.equal(declarationIdentity(directory, '2.1.310'), null);
        put('claude-code-tools', 'export {};\n');
        const complete = declarationIdentity(directory, '2.1.310');
        assert.match(complete!, /^[a-f0-9]{64}$/u);
        assert.equal(declarationIdentity(directory, '2.1.294'), null);
        put('claude-code-tools', 'export interface Tool {}\n');
        assert.notEqual(declarationIdentity(directory, '2.1.310'), complete);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
