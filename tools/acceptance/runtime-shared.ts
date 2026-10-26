/** Bind overlapping obligations to one actual full execution; never fabricate a rerun. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { matchesNodeCase } from '@fbincon/statusline-core/node-runtime';
import { sha256 } from '../build/files.js';
const [directory, cases] = process.argv.slice(2); assert(directory && cases);
const root = resolve(directory), installed = JSON.parse(fs.readFileSync(join(root, 'installed.json'), 'utf8'));
const source = JSON.parse(fs.readFileSync(join(root, 'source-tests.json'), 'utf8'));
assert.equal(installed.status, 'pass'); assert.equal(installed.node, process.version);
assert.equal(installed.node_sha256, sha256(fs.readFileSync(process.execPath)));
assert.equal(source.status, 'pass'); assert.equal(source.suite, 'complete-platform-suite');
assert.equal(source.commit, installed.commit); assert.equal(source.node, installed.node); assert.equal(source.node_sha256, installed.node_sha256);
assert.deepEqual(source.source_hashes, installed.harness_hashes); assert.equal(source.platform, process.platform); assert.equal(source.arch, process.arch);
for (const [field, key] of [['run_id', 'GITHUB_RUN_ID'], ['attempt', 'GITHUB_RUN_ATTEMPT'], ['job', 'GITHUB_JOB']]) assert.equal(source[field!], process.env[key!]);
const selections = JSON.parse(cases) as string[]; assert(Array.isArray(selections));
for (const selection of selections) {
    assert(matchesNodeCase(process.versions.node, selection));
    const output = join(root, 'shared-' + selection); fs.mkdirSync(output);
    fs.writeFileSync(join(output, 'runtime.json'), JSON.stringify({ ...installed, kind: 'node-runtime', runtime_case: selection, runtime_tests: true,
        execution: { run_id: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, job: process.env.GITHUB_JOB, reused_installed: true, source_suite: 'complete-platform-suite' } }, null, 2) + '\n', { flag: 'wx' });
}
