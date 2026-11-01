import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { processAlive } from '@fbincon/statusline-platform/processes';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { APPEARANCE_MS, APPEARANCE_SCHEMES, HANDOFF_MS, WORKER_OVERHEAD, requireHostedBudget, supervisionBudget, versionChildBudget, versionManagementBudget } from '../budgets.js';
import { installedPhases, appearancePhase } from '../installed-plan.js';
import { withinInstalledBudget, admitInstalledCommand } from '../installed-admission.js';
import { PhaseWatchdog, superviseInstalled } from '../installed-supervisor.js';

for (const [pr, scheme, remaining] of [[190, 'powerline-daily', 4_640], [198, 'light-readable', 52_860]] as const) {
    test('#' + pr + ': the final admitted appearance scenario keeps its own 120 seconds', () => {
        const plan = installedPhases(true, 12);
        const index = plan.findIndex(phase => phase.name === appearancePhase(scheme));
        let now = 0;
        const clock = new PhaseWatchdog(plan, () => now);
        const previous = plan.slice(0, index);
        const oldDeadline = 55 * 60_000, start = oldDeadline - remaining;
        const available = previous.reduce((total, phase) => total + phase.budgetMs, 0);
        for (const phase of previous) {
            clock.observe({ event: 'start', name: phase.name });
            now += start * phase.budgetMs / available;
            clock.observe({ event: 'end', name: phase.name });
        }
        clock.observe({ event: 'start', name: appearancePhase(scheme) });
        now = oldDeadline; clock.check();
        now = start + APPEARANCE_MS; clock.observe({ event: 'end', name: appearancePhase(scheme) });
        assert(now > oldDeadline);
    });
}
test('parent budget includes every admissible handoff, setup, exit, and both historical schedules', () => {
    for (const windows of [false, true]) {
        const plan = installedPhases(windows, 12);
        let now = 0; const clock = new PhaseWatchdog(plan, () => now);
        now += WORKER_OVERHEAD.start;
        for (const [index, phase] of plan.entries()) {
            clock.observe({ event: 'start', name: phase.name }); now += phase.budgetMs + HANDOFF_MS;
            clock.observe({ event: 'end', name: phase.name }); now += index === plan.length - 1 ? WORKER_OVERHEAD.exit : HANDOFF_MS;
        }
        clock.finish(); assert(now <= supervisionBudget(plan)); requireHostedBudget(supervisionBudget(plan), 30 * 60_000);
        assert.deepEqual(plan.filter(p => APPEARANCE_SCHEMES.some(s => p.name === appearancePhase(s))).map(p => p.budgetMs),
            APPEARANCE_SCHEMES.map(() => APPEARANCE_MS + HANDOFF_MS));
    }
    assert(versionManagementBudget(true) > versionManagementBudget(false));
    for (const official of [false, true]) assert(versionChildBudget('3.8.0', official) > versionChildBudget('3.7.0', official));
    assert.throws(() => requireHostedBudget(350 * 60_000, 0), /partition/);
    const filtered = installedPhases(true, 12, 'terminal policy|external editor saves');
    assert.equal(filtered.length, 6); assert(!filtered.some(p => p.name.startsWith('appearance/')));
    assert.throws(() => installedPhases(false, 12, 'not-an-installed-case'));
    assert.deepEqual(installedPhases(true, 12, '/TERMINAL POLICY|EXTERNAL EDITOR SAVES/i'), filtered);
    withinInstalledBudget('sample', 10, () => assert.throws(() => admitInstalledCommand(30_000), /cannot admit/));
});
test('a heartbeat cannot restart a stage, and missing, late or out-of-order events fail', () => {
    let now = 0; const phase = { name: 'first', budgetMs: 20 }, monitor = () => new PhaseWatchdog([phase], () => now);
    assert.throws(() => monitor().finish(), /Incomplete/);
    assert.throws(() => monitor().observe({ event: 'end', name: 'first' }));
    assert.throws(() => monitor().observe({ event: 'start', name: 'second' }));
    const late = monitor(); late.observe({ event: 'start', name: 'first' });
    assert.throws(() => late.observe({ event: 'start', name: 'first' }), /Repeated/);
    now = 20 + HANDOFF_MS + 1; assert.throws(() => late.observe({ event: 'end', name: 'first' }), /deadline/);
});
test('synchronous stall is stopped outside its event loop; its child cannot survive timeout', async t => {
    const root = fs.mkdtempSync(join(tmpdir(), 'acceptance-sync-hang-')); t.after(() => removeTree(root));
    const report = join(root, 'worker'), marker = join(root, 'pid.json');
    const api = import.meta.resolve('@fbincon/statusline-platform/processes');
    const childProgram = `import fs from 'node:fs'; import {processToken} from ${JSON.stringify(api)};fs.writeFileSync(process.argv[1],JSON.stringify([process.pid,processToken(process.pid)])); setInterval(()=>{},1000);`;
    const program = `import {spawn} from 'node:child_process'; import fs from 'node:fs'; const marker=process.argv[1];
        spawn(process.execPath,['--input-type=module','-e',${JSON.stringify(childProgram)},marker],{detached:process.platform!=='win32',stdio:'ignore'});
        while (!fs.existsSync(marker)) await new Promise(r=>setTimeout(r,20));
        fs.appendFileSync(process.env.TS05_PHASE_EVENTS,JSON.stringify({event:'start',name:'hang'})+'\\n');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);`;
    await assert.rejects(superviseInstalled(['--input-type=module','-e',program,marker], [{name:'hang',budgetMs:100}],
        process.env, report, { overhead: { start: 60_000, handoff: 200, exit: 10_000 } }), /deadline.*hang/);
    const [pid, token] = JSON.parse(fs.readFileSync(marker, 'utf8')); assert(token); assert.equal(processAlive(pid,token), false);
    assert.equal(JSON.parse(fs.readFileSync(report + '.phases.json','utf8')).status,'fail');
});
test('cleanup failure and large legal TAP output keep their real outcomes', async t => {
    const root=fs.mkdtempSync(join(tmpdir(),'acceptance-output-')); t.after(()=>removeTree(root));
    for (const [label, result] of [['pass','end'], ['cleanup-failure','fail']] as const) {
        const report = join(root,label), count = 2*1024*1024; let bytes = 0;
        const stream = new Writable({ write(chunk,_encoding,done) { bytes += chunk.length; done(); } });
        const program = `const fs=require('node:fs'); const emit=event=>fs.appendFileSync(process.env.TS05_PHASE_EVENTS,JSON.stringify({name:'cleanup',event})+'\\n');
            emit('start');process.stdout.write(Buffer.alloc(${count},65));emit('${result}');`;
        const run=superviseInstalled(['-e',program],[{name:'cleanup',budgetMs:30_000}],process.env,report,{output:{stdout:stream,stderr:stream}});
        if (result==='end') await run; else await assert.rejects(run,/fixture failed.*cleanup/);
        const receipt=JSON.parse(fs.readFileSync(report+'.phases.json','utf8'));
        assert.equal(receipt.status,result==='end'?'pass':'fail'); assert.equal(bytes,count);
    }
});
