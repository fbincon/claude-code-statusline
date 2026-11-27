import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkModValidation, declarationIdentity, recordModHost } from '../mod-types.js';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';

test('pinned hosts accept only their known runtime validation warnings before exact typechecking', () => {
    const dir = fs.mkdtempSync(join(tmpdir(), 'official-validator-')), version = '2.1.332';
    const file = join(dir, 'tests/integration/capacity-recovery.test.ts');
    const row = { file, type: 'hooks', errors: [] as string[], warnings: [{ message: "error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled." }] };
    const report = { success: true, strict: false, target: join(dir, '.claude-plugin/plugin.json'), manifest: {errors: [], warnings: [] as string[]}, contents: [row] };
    const validate = () => checkModValidation(JSON.stringify(report), dir, version);
    try {
        assert.deepEqual(validate(), { import_extension: 1, test_host_version: 0 });
        row.warnings[0]!.message = "error TS2307: Cannot find module '../../.claude-plugin/types/host-version.ts' or its corresponding type declarations.";
        assert.throws(validate);
        recordModHost(dir, version);
        assert.deepEqual(validate(), { import_extension: 0, test_host_version: 1 });
        row.file = join(dir, 'hooks/register.ts');
        assert.throws(validate, /Unexpected official validator warning/u);
        row.file = file;
        row.warnings[0]!.message = "error TS2307: Cannot find module './backend'.";
        assert.throws(validate);
        row.warnings = []; row.errors.push('invalid hook');
        assert.throws(validate);
        row.errors = []; report.manifest.warnings.push('unrecognized property');
        assert.throws(validate);
    } finally {
        removeTree(dir); assert(!fs.existsSync(dir));
    }
});

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
