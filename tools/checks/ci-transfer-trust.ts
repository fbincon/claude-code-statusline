/** Consumers execute this file from the selected, accepted Git blob before
 * using any local Action to transport original evidence. No checkout imports. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const action = '.github/actions/transfer-artifact';
const shared = ['tools/checks/ci-transfer.ts', 'tools/checks/ci-transfer-policy.ts'];
export function acceptedTransfer(commit: string, root = process.cwd()): boolean {
    assert.match(commit, /^[a-f0-9]{40}$/u);
    const rows = execFileSync('git', ['--no-replace-objects', 'ls-tree', '-rz', commit, '--', action, ...shared], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    const expected = new Map<string, string>();
    for (const row of rows) {
        const m = /^100(?:644|755) blob ([a-f0-9]{40})\t([a-zA-Z0-9_./-]+)$/u.exec(row);
        if (!m) return false;
        expected.set(m[2]!, m[1]!);
    }
    if (![...shared, ...['action.yml', 'entry.mjs', 'package.json', 'package-lock.json'].map(name => action + '/' + name)].every(path => expected.has(path))) return false;
    // Include ignored files and directories too. An extra local module, link or
    // manifest must not influence the accepted implementation or its SDK bootstrap.
    const actual: string[] = [];
    function collect(path: string): boolean {
        const full = join(root, path), stat = fs.lstatSync(full);
        if (stat.isDirectory()) return fs.readdirSync(full).every(name => collect(path + '/' + name));
        if (!stat.isFile() || !expected.has(path)) return false;
        const bytes = fs.readFileSync(full);
        actual.push(path);
        return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex') === expected.get(path);
    }
    try {
        for (const dir of ['.github', '.github/actions', 'tools', 'tools/checks'])
            if (!fs.lstatSync(join(root, dir)).isDirectory()) return false;
        return [action, ...shared].every(collect) && actual.length === expected.size;
    } catch { return false; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    assert(process.argv.length === 3);
    // The first protected transfer starts from a fresh SDK installation. Only
    // the subsequent verified transfers in this job can reuse those modules.
    const fresh = !fs.readdirSync(process.env.RUNNER_TEMP!).some(name => name.startsWith('statusline-transfer-sdk-'));
    process.exitCode = fresh && acceptedTransfer(process.argv[2]!) ? 0 : 1;
}
