import test from 'node:test';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fresh, snapshot, assert, fs, join, NATIVE, doctor } from './install-support.js';
import { pending, readJournal, refreshIntents, RecoveryRequired } from '@fbincon/statusline-cli/recovery/journal';
import { digest } from '@fbincon/statusline-cli/integration/resources';
import { owner, registered, cacheOwned } from '@fbincon/statusline-cli/integration/mod-ownership';
import { recover } from '@fbincon/statusline-cli/recovery/service';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { setLanguage } from '@fbincon/statusline-cli/config/preferences';
import { UnconfirmedOperation } from '@fbincon/statusline-platform/plugin-host';
import { main } from '@fbincon/statusline-cli/main';
const helper = fileURLToPath(new URL('./recovery-child.js', import.meta.url));
test('canonical cache identity never conceals a link inside the configuration tree', t => {
    const f = fresh(t); f.install({ native: true, nativeTiming: false });
    const row = f.host.plugins[0]!, path = String(row.installPath), moved = path + '-original';
    fs.renameSync(path, moved); fs.symlinkSync(moved, path, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => cacheOwned(f.root, NATIVE, row, owner(f.root, NATIVE, f.io)!, f.io), /symbolic link|reparse/u);
});
test('concurrent explicit recoveries serialize and the second reports already recovered', async t => {
    const f = fresh(t); initialize(f); crash(f.root, 'applied:0');
    const run = () => new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [...f.launch.args, 'recover', '--config-dir', f.root], { env: { ...process.env, PATH: '' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let error = ''; child.stderr.on('data', chunk => { error += chunk; });
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Recovery wait exceeded bound')); }, 10000);
        child.on('error', failure => { clearTimeout(timer); reject(failure); }); child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(error)); });
    });
    await Promise.all([run(), run()]); assert.equal(pending(f.root).length, 0); assert.equal(f.json('settings.json').original, 'unchanged');
});
test('official registration and recovery compare canonical directory identities', t => {
    const f = fresh(t); f.install({ native: true, nativeTiming: false });
    const alias = join(f.temporary, 'market-alias'); fs.symlinkSync(join(f.root, NATIVE.name), alias, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(registered(f.root, NATIVE, [{ name: NATIVE.marketplace, source: 'directory', path: alias }], f.host.listing()[1], owner(f.root, NATIVE, f.io))[0], true);
    const parent = join(f.temporary, 'parent-alias'); fs.symlinkSync(f.temporary, parent, process.platform === 'win32' ? 'junction' : 'dir');
    const aliasRoot = join(parent, f.root.slice(f.temporary.length + 1)); const before = snapshot(f.root);
    crash(aliasRoot, 'applied:0'); recover(f.context); assert.deepEqual(snapshot(f.root), before);
});
test('an explicitly selected configuration-directory link resolves before ownership checks', async t => {
    const f = fresh(t); f.put('settings.json', { env: { KEEP: 'yes' } });
    const alias = join(f.temporary, 'selected-config'); fs.symlinkSync(f.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(await main(['install', '--config-dir', alias, '--no-native-editor', '--no-native-timing'], { launch: f.launch, hostVersion: () => null, stdout: () => {} }), 0);
    assert.equal(f.json('settings.json').env.KEEP, 'yes'); assert.ok(f.read('statusline_runtime/installation.json'));
});
function crash(root: string, point: string, action = 'files') {
    const result = spawnSync(process.execPath, [helper, root, point, action], { env: { ...process.env, PATH: '' }, timeout: 15000, windowsHide: true });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0, result.stderr.toString());
    assert.equal(pending(root).length, 1, result.stderr.toString());
}
function initialize(f: ReturnType<typeof fresh>) { f.put('settings.json', Buffer.from('{"original":"unchanged"}\n')); f.put('claude-statusline-features.json', Buffer.from('{"schema_version":1,"experimental_slash_tui":true}\n')); }
for (const point of ['prepared', 'before-write:0', 'applied:0', 'before-write:1', 'applied:1', 'committed'])
    test('hard-killed file transaction recovers at ' + point, t => {
        const f = fresh(t);
        initialize(f);
        const before = snapshot(f.root);
        crash(f.root, point);
        const journal = readJournal(f.root, pending(f.root)[0]!);
        assert.equal(journal.kind, 'files');
        const backups = snapshot(join(f.root, 'backups'));
        const interrupted = snapshot(f.root);
        const preview = recover(f.context, true);
        assert.equal(preview.changed, false);
        assert.deepEqual(snapshot(f.root), interrupted);
        const result = recover(f.context);
        assert.equal(result.transactions[0]!.outcome, point === 'committed' ? 'committed' : 'rollback');
        assert.equal(pending(f.root).length, 0);
        assert.deepEqual(snapshot(join(f.root, 'backups')), backups);
        if (point !== 'committed')
            assert.deepEqual(snapshot(f.root), before);
        else
            assert.equal(f.json('settings.json').changed, true);
        assert.deepEqual(recover(f.context), { changed: false, transactions: [] });
    });
test('recovery removes files that were originally absent and retains immutable absence records', t => { const f = fresh(t); crash(f.root, 'applied:1'); recover(f.context); assert.equal(fs.existsSync(join(f.root, 'settings.json')), false); assert.equal(fs.existsSync(join(f.root, 'claude-statusline-features.json')), false); assert.ok(fs.readdirSync(join(f.root, 'backups/statusline')).length); });
test('new configuration, language and installation writes are blocked until explicit recovery', async (t) => {
    const f = fresh(t);
    f.install({ native: false, nativeTiming: false });
    const service = new ConfigurationService({ configDir: f.root, launch: f.launch, hostVersion: () => null }, f.io), draft = service.read();
    crash(f.root, 'prepared');
    const before = snapshot(f.root);
    assert.throws(() => service.apply({ display: draft.display, host: draft.host }), RecoveryRequired);
    assert.throws(() => setLanguage(f.root, 'ja'), RecoveryRequired);
    assert.throws(() => f.install(), RecoveryRequired);
    assert.ok(doctor(f.context).some(row => row.level === 'ERROR' && typeof row.message !== 'string' && row.message.key === 'recovery.pending'));
    assert.deepEqual(snapshot(f.root), before);
    let output = '';
    assert.equal(await main(['recover', '--config-dir', f.root, '--dry-run'], { launch: f.launch, hostVersion: () => null, stdout: value => { output += value; } }), 0);
    assert.ok(output.includes('Recovery preview'));
    assert.equal(pending(f.root).length, 1);
    assert.equal(await main(['recover', '--config-dir', f.root], { launch: f.launch, hostVersion: () => null, stdout: () => { } }), 0);
    assert.equal(pending(f.root).length, 0);
});
test('foreign post-crash changes block all restoration before any file is touched', t => { const f = fresh(t); initialize(f); crash(f.root, 'applied:1'); const first = f.read('settings.json'); f.put('claude-statusline-features.json', Buffer.from('foreign edit')); const before = snapshot(f.root); assert.throws(() => recover(f.context), /conflict/u); assert.deepEqual(snapshot(f.root), before); assert.deepEqual(f.read('settings.json'), first); });
test('damaged immutable backup cannot authorize a restoration', t => { const f = fresh(t); initialize(f); crash(f.root, 'applied:1'); const journal = readJournal(f.root, pending(f.root)[0]!); assert.equal(journal.kind, 'files'); if (journal.kind !== 'files')
    return; fs.writeFileSync(join(f.root, journal.entries[1]!.snapshot!), 'tampered'); const before = snapshot(f.root); assert.throws(() => recover(f.context), /Backup hash mismatch/u); assert.deepEqual(snapshot(f.root), before); });
test('future, duplicate and path-escaping journals are refused without mutation', t => { const f = fresh(t); initialize(f); crash(f.root, 'applied:1'); const path = pending(f.root)[0]!, original = fs.readFileSync(path, 'utf8'), journal = JSON.parse(original); for (const raw of [original.replace('"schema_version": 1', '"schema_version": 2'), original.replace('"schema_version": 1', '"schema_version": 1, "schema_version": 1'), JSON.stringify({ ...journal, entries: [{ ...journal.entries[0], path: '../settings.json' }] }), JSON.stringify({ ...journal, entries: [{ ...journal.entries[0], snapshot: journal.backup + '/../settings.json.before' }] })]) {
    fs.writeFileSync(path, raw);
    const before = snapshot(f.root);
    assert.throws(() => recover(f.context));
    assert.deepEqual(snapshot(f.root), before);
} });
test('linked recovery snapshots and reparse targets are never followed', t => { const f = fresh(t); initialize(f); crash(f.root, 'applied:1'); const journal = readJournal(f.root, pending(f.root)[0]!); if (journal.kind !== 'files')
    assert.fail(); const backup = join(f.root, journal.entries[0]!.snapshot!); fs.unlinkSync(backup); const foreign = join(f.temporary, 'foreign'); fs.mkdirSync(foreign); fs.symlinkSync(foreign, backup, process.platform === 'win32' ? 'junction' : 'dir'); assert.throws(() => recover(f.context)); assert.equal(fs.readdirSync(foreign).length, 0); });
test('a second kill during rollback is idempotently recoverable', t => { const f = fresh(t); initialize(f); const before = snapshot(f.root); crash(f.root, 'applied:1'); crash(f.root, 'restored:1', 'recover'); recover(f.context); assert.deepEqual(snapshot(f.root), before); });
test('a live transaction owner is reported without taking over its locks', async (t) => {
    const f = fresh(t);
    initialize(f);
    const child = spawn(process.execPath, [helper, f.root, 'prepared', 'hold'], { windowsHide: true, stdio: 'ignore' });
    try {
        const end = Date.now() + 8000;
        while (!fs.existsSync(join(f.temporary, 'held')) && Date.now() < end)
            await new Promise(resolve => setTimeout(resolve, 20));
        assert.ok(fs.existsSync(join(f.temporary, 'held')));
        assert.throws(() => recover(f.context, true), /still running/u);
    }
    finally {
        child.kill('SIGKILL');
        await new Promise(resolve => child.once('exit', resolve));
    }
    recover(f.context);
    assert.equal(pending(f.root).length, 0);
});
test('recovery preserves original private modes and refuses later permission changes', { skip: process.platform === 'win32' }, t => { const f = fresh(t); initialize(f); fs.chmodSync(join(f.root, 'settings.json'), 0o640); crash(f.root, 'applied:1'); recover(f.context); assert.equal(fs.statSync(join(f.root, 'settings.json')).mode & 0o777, 0o640); crash(f.root, 'applied:1'); fs.chmodSync(join(f.root, 'settings.json'), 0o777); assert.throws(() => recover(f.context), /permissions changed/u); });
test('interrupted Mod staging recovers only that phase and can be installed again', t => { const f = fresh(t); crash(f.root, 'applied:3', 'mod-stage'); assert.ok(f.read('settings.json')); recover(f.context); assert.equal(fs.existsSync(join(f.root, NATIVE.name)), false); assert.equal(f.install({ native: true, nativeTiming: false }).failed, false); });
for (const applied of [false, true])
    test('uncertain official install is reconciled from inventory with applied=' + applied, t => {
        const f = fresh(t), run = f.host.run.bind(f.host);
        let failed = false;
        f.host.run = (args, values, json) => { if (!failed && args[0] === 'install') {
            failed = true;
            if (applied)
                run(args, values, json);
            throw new UnconfirmedOperation('lost host reply');
        } return run(args, values, json); };
        const result = f.install({ native: true, nativeTiming: false });
        assert.equal(result.failed, true);
        assert.ok(f.read('settings.json'));
        assert.equal(pending(f.root).length, 1);
        const count = f.host.calls.filter(call => call.args[0] === 'install').length;
        assert.throws(() => f.install(), RecoveryRequired);
        const preview = recover(f.context, true);
        assert.equal(preview.transactions[0]!.outcome, applied ? 'confirmed' : 'not-applied');
        assert.equal(pending(f.root).length, 1);
        recover(f.context);
        assert.equal(f.host.calls.filter(call => call.args[0] === 'install').length, count);
        assert.equal(f.install().failed, false);
    });
test('hard kill after official mutation is reconciled without replaying the write', t => { const f = fresh(t); crash(f.root, 'official-returned', 'official'); Object.assign(f.host, JSON.parse(fs.readFileSync(join(f.temporary, 'host-receipt.json'), 'utf8'))); const result = recover(f.context); assert.equal(result.transactions[0]!.outcome, 'confirmed'); assert.equal(f.host.calls.filter(call => call.args[0] === 'install').length, 0); });
test('ambiguous official changes remain blocked for inspection', t => { const f = fresh(t), run = f.host.run.bind(f.host); f.host.run = (args, values, json) => { const result = run(args, values, json); if (args[0] === 'install') {
    f.host.inputs.backendExecutable = 'foreign';
    throw new UnconfirmedOperation('lost reply');
} return result; }; f.install({ native: true, nativeTiming: false }); const before = snapshot(f.root); assert.throws(() => recover(f.context), /ambiguous/u); assert.deepEqual(snapshot(f.root), before); });
for (const [point, action] of [['official-returned', 'refresh-uninstall'], ['cleared', 'refresh-uninstall'], ['official-returned', 'refresh-install']])
    test('disabled plugin survives a hard kill at ' + action + '/' + point, t => {
        const f = fresh(t);
        f.install({ native: true, nativeTiming: false });
        f.host.enabled(false);
        const markerPath = NATIVE.name + '/.claude-statusline-owner.json', marker = f.json(markerPath), name = 'plugins/' + NATIVE.name + '/hooks/register.ts', raw = Buffer.from('// historical owned resource\n');
        f.put(NATIVE.name + '/' + name, raw);
        fs.writeFileSync(join(f.host.plugins[0]!.installPath as string, 'hooks/register.ts'), raw);
        marker.files[name] = digest(raw);
        f.put(markerPath, marker);
        const receipt = join(f.temporary, 'host-receipt.json');
        fs.writeFileSync(receipt, JSON.stringify({ markets: f.host.markets, plugins: f.host.plugins, inputs: f.host.inputs }));
        const killed = spawnSync(process.execPath, [helper, f.root, point!, action!], { env: { ...process.env, PATH: '' }, timeout: 15000, windowsHide: true });
        assert.equal(killed.error, undefined);
        assert.notEqual(killed.status, 0, killed.stderr.toString());
        assert.deepEqual(refreshIntents(f.root), [NATIVE.name]);
        Object.assign(f.host, JSON.parse(fs.readFileSync(receipt, 'utf8')));
        assert.throws(() => setLanguage(f.root, 'ja'), RecoveryRequired);
        const preview = recover(f.context, true);
        assert.ok(preview.transactions.some(row => row.outcome === 'restore-disabled'));
        recover(f.context);
        assert.equal(f.host.listing()[1][0]!.enabled, false);
        assert.deepEqual(refreshIntents(f.root), []);
        assert.equal(pending(f.root).length, 0);
    });
