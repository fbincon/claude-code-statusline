/** Fresh release bytes for the tagged maintenance source, with independent/source rebuilds. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildCandidate } from './candidate.js';
import { git } from '../checks/impact-content.js';
import { publicChannel } from './model.js';

const { values } = parseArgs({ options: { output: { type: 'string' }, rebuild: { type: 'string' } } });
assert(values.output && values.rebuild);
const commit = git('rev-parse', 'HEAD'), output = resolve(values.output);
const original = await buildCandidate(commit, output, undefined, publicChannel());
const rebuilt = await buildCandidate(commit, resolve(values.rebuild), join(output, original.source.file), publicChannel());
assert.equal(original.candidate.sha256, rebuilt.candidate.sha256);
fs.writeFileSync(join(output, 'release-build-proof.json'), JSON.stringify({ schema_version: 1, commit,
    tarball_sha256: original.candidate.sha256, source_rebuild_sha256: rebuilt.candidate.sha256,
    execution: { run_id: Number(process.env.GITHUB_RUN_ID), attempt: Number(process.env.GITHUB_RUN_ATTEMPT), job: 'release-build' } }, null, 2) + '\n');
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'filename=' + original.candidate.file + '\n');
