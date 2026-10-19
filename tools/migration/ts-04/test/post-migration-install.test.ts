import test from 'node:test';
import { fresh, snapshot, assert, fs, join, doctor } from './install-support.js';
import { renderMessage } from '@fbincon/statusline-core/i18n/messages';
import { sameLaunchEntry, ownedCommand } from '@fbincon/statusline-platform/commands';
import { pathCollisions } from '@fbincon/statusline-cli/integration/doctor';
import { prepare, requestGuard, started, writeResult, readResult, cleanup } from '@fbincon/statusline-platform/terminal/bridge';

test('R03 doctor rejects damaged owned skills and invalid host fields without repairing them', t => {
    for (const kind of ['skill', 'padding', 'refreshInterval', 'hideVimModeIndicator']) {
        const f = fresh(t); f.install({ native: false });
        if (kind === 'skill') fs.appendFileSync(join(f.root, 'skills/statusline-config/SKILL.md'), '\ndamaged\n');
        else { const settings = f.json('settings.json'); settings.statusLine[kind] = kind === 'padding' ? true : kind === 'refreshInterval' ? 0 : 1; f.put('settings.json', settings); }
        const before = snapshot(f.root);
        assert.ok(doctor(f.context).some(row => row.level === 'ERROR'), kind);
        assert.deepEqual(snapshot(f.root), before);
    }
});
test('R03 doctor diagnoses real current-user runtime write permission', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, t => {
    const f = fresh(t); f.install({ native: false }); const runtime = join(f.root, 'statusline_runtime');
    fs.chmodSync(runtime, 0o500);
    try { assert.ok(doctor(f.context).some(row => row.level === 'ERROR' && /not writable/u.test(renderMessage(row.message)))); }
    finally { fs.chmodSync(runtime, 0o700); }
});
test('B05 preexisting backup-root links are rejected before any external writes', t => {
    const f = fresh(t), outside = join(f.temporary, 'outside');
    fs.mkdirSync(outside); fs.mkdirSync(join(f.root, 'backups'), { recursive: true });
    fs.symlinkSync(outside, join(f.root, 'backups/statusline'), 'junction');
    assert.throws(() => f.install({ native: false }), /back.up|symbolic|reparse/iu);
    assert.deepEqual(fs.readdirSync(outside), []);
    assert.equal(fs.existsSync(join(f.root, 'settings.json')), false);
});
test('R02 and R06 only recognize the same npm distribution, including outer bootstrap', t => {
    const f = fresh(t), root = join(f.temporary, 'npm 中文'), bin = join(root, 'bin/claude-statusline.js'), entry = join(root, 'node_modules/@fbincon/statusline-cli/dist/src/entry.js');
    fs.mkdirSync(join(root, 'bin'), { recursive: true }); fs.mkdirSync(join(root, 'node_modules/@fbincon/statusline-cli/dist/src'), { recursive: true });
    fs.writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@fbincon/claude-code-statusline', bin: { 'claude-statusline': 'bin/claude-statusline.js' } }));
    fs.writeFileSync(entry, ''); fs.writeFileSync(bin, '#!/usr/bin/env node\nimport "../node_modules/@fbincon/statusline-cli/dist/src/entry.js";\n', { mode: 0o755 });
    const launch = { executable: process.execPath, args: [entry] };
    assert.equal(sameLaunchEntry(bin, launch), true);
    assert.equal(ownedCommand(`"${bin}" render`, 'render', launch), true);
    assert.equal(ownedCommand(`"${bin}.other" render`, 'render', launch), false);
    assert.equal(sameLaunchEntry(bin, { ...launch, args: [entry + '.other'] }), false);
    if (process.platform !== 'win32') {
        const command = join(root, 'bin/claude-statusline'); fs.symlinkSync(bin, command);
        const old = process.env.PATH; process.env.PATH = join(root, 'bin');
        try {
            assert.equal(ownedCommand('claude-statusline render', 'render', launch), true); assert.deepEqual(pathCollisions({ ...f.context, launch }), []);
            fs.unlinkSync(command); fs.writeFileSync(command, '#!/usr/bin/env python\n', { mode: 0o755 });
            assert.equal(ownedCommand('claude-statusline render', 'render', launch), false);
            assert.match(String(pathCollisions({ ...f.context, launch })[0]!.message), /Python\/pipx/u);
        }
        finally { process.env.PATH = old; }
    }
});
test('R01 private request/started/result identity checks cover an entire bridge lease', t => {
    const f = fresh(t); fs.mkdirSync(f.root, { recursive: true }); const invocation = prepare(f.root, f.launch, f.root);
    try {
        const guard = requestGuard(f.root, invocation.path, invocation.request.nonce, f.launch);
        assert.equal(started(invocation.directory, f.root, invocation.request.nonce).pid, process.pid); guard();
        writeResult(invocation.result, f.root, { outcome: 'cancelled', exit_code: 0, message: 'cancelled' });
        assert.equal(readResult(invocation.result, f.root).outcome, 'cancelled');
        fs.renameSync(invocation.path, invocation.path + '.old'); fs.writeFileSync(invocation.path, '{}', { mode: 0o600 });
        assert.throws(guard);
        fs.unlinkSync(invocation.path + '.old');
    } finally { cleanup(invocation.directory); }
});
