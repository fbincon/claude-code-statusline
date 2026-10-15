import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { commit } from '@fbincon/statusline-cli/recovery/files';
import { observeTransactions } from '@fbincon/statusline-cli/recovery/journal';
import { recover } from '@fbincon/statusline-cli/recovery/service';
import { createStorage, jsonBytes } from '@fbincon/statusline-cli/config/storage';
import { install, installContext } from '@fbincon/statusline-cli/integration/install';
import { NATIVE } from '@fbincon/statusline-cli/integration/model';
import { FakeHost } from './install-support.js';
const [root, stage, action = 'files'] = process.argv.slice(2), io = createStorage();
const host = new FakeHost(root!, NATIVE), context = installContext(root!, { executable: process.execPath, args: [join(process.cwd(), 'packages/cli/dist/src/entry.js')] }, [2, 1, 288], io, () => host);
if (action.startsWith('refresh'))
    Object.assign(host, JSON.parse(fs.readFileSync(join(dirname(root!), 'host-receipt.json'), 'utf8')));
observeTransactions((point, journal) => {
    if (point !== stage || action === 'mod-stage' && journal.action !== 'mod-stage' || action === 'official' && (journal.kind !== 'official' || journal.args[0] !== 'install'))
        return;
    if (action.startsWith('refresh') && (journal.kind !== 'official' || journal.args[0] !== (action === 'refresh-install' ? 'install' : 'uninstall')))
        return;
    if (action === 'official' || action.startsWith('refresh'))
        fs.writeFileSync(join(dirname(root!), 'host-receipt.json'), JSON.stringify({ markets: host.markets, plugins: host.plugins, inputs: host.inputs }));
    if (action === 'hold') {
        fs.writeFileSync(join(dirname(root!), 'held'), 'ready');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    }
    process.kill(process.pid, 'SIGKILL');
});
if (action === 'recover')
    recover(context);
else if (action === 'mod-stage' || action === 'official' || action.startsWith('refresh'))
    install(context, { native: true, nativeTiming: false, liveMetrics: false });
else
    io.lock(root!, () => {
        const changes = ['settings.json', 'claude-statusline-features.json'].map((name, index) => ({ name, path: join(root!, name), raw: io.read(join(root!, name)), desired: jsonBytes(index ? { schema_version: 1, experimental_slash_tui: false } : { changed: true }) }));
        commit(root!, 'crash-probe', changes, io);
    });
