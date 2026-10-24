import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { which } from '@fbincon/statusline-platform/commands';
import type { installCandidate } from './install.js';

/** Load policy and collector from the immutable installed artifact, using real Git. */
export async function installedGitPolicy(installed: ReturnType<typeof installCandidate>): Promise<number> {
    // Koffi installations must not coexist in the harness process on Windows.
    // Load the artifact's native adapter only in an isolated installed Node child.
    const input = JSON.stringify({modules:installed.modules,temporary:installed.temporary,node:installed.node,env:installed.env});
    const program = `import {installedGitPolicyChild} from ${JSON.stringify(import.meta.url)}; console.log(JSON.stringify({cases:await installedGitPolicyChild(JSON.parse(process.argv[1]))}));`;
    const result = spawnSync(installed.node, ['--input-type=module','-e',program,input], {encoding:'utf8',timeout:60000,windowsHide:true});
    assert.equal(result.error,undefined); assert.equal(result.status,0,result.stderr + result.stdout);
    return JSON.parse(result.stdout).cases;
}
export async function installedGitPolicyChild(installed: Pick<ReturnType<typeof installCandidate>, 'modules'|'temporary'|'node'|'env'>): Promise<number> {
    const load = (name: string, path: string) => import(pathToFileURL(join(installed.modules, 'statusline-' + name, 'dist/src', path + '.js')).href);
    const [{ GitInvocation, gitEnvironment }, { runCommand }, { GitCollector }, { runtimeContext }] = await Promise.all([
        load('platform', 'git'), load('platform', 'command'), load('cli', 'runtime/git'), load('cli', 'runtime/context'),
    ]);
    const executable = which('git'); assert(executable, 'Git is required for installed policy acceptance');
    const repo = join(installed.temporary, 'policy repo'), global = join(installed.temporary, 'git-global');
    fs.mkdirSync(repo); fs.writeFileSync(global, '');
    const env = { ...installed.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: global };
    const git = (...args: string[]) => { const result = spawnSync(executable, ['-C', repo, ...args], {env, encoding:'utf8', timeout:10000}); assert.equal(result.status, 0, result.stderr); return result.stdout; };
    git('init', '-qb', 'main'); git('config', 'user.name', 'Acceptance'); git('config', 'user.email', 'acceptance@example.invalid'); git('config', 'core.autocrlf', 'false');
    fs.writeFileSync(join(repo, 'file.txt'), 'aaaa\n'); git('add', '.'); git('commit', '-qm', 'fixture');
    const marker = join(installed.temporary, 'git-marker'), script = join(installed.temporary, 'marker.cjs');
    fs.writeFileSync(script, "require('fs').appendFileSync(process.argv[2],'called');if(process.argv[3]==='clean')process.stdout.write(require('fs').readFileSync(0));");
    const q = (value: string) => "'" + value.replaceAll('\\', '/').replaceAll("'", "'\\''") + "'";
    const command = [installed.node, script, marker].map(q).join(' ');
    // Only executable discovery is injected; command policy, parsing, timeouts and collection are installed code.
    const runner = (spec: any, options: any) => {
        const beforeMarker = fs.existsSync(marker);
        const result = runCommand({...spec, executable}, {...options, environment:{...options.environment, ...env}});
        assert.equal(fs.existsSync(marker),beforeMarker,'A policy invocation ran the marker: ' + spec.args.filter((v:string)=>['config','ls-files','status','rev-parse','merge-base','diff'].includes(v)).join(','));
        return result;
    };
    const collector = new GitCollector(runtimeContext(join(installed.temporary, 'policy-config'), env), undefined, runner);
    git('config', 'core.fsmonitor', command);
    const before = fs.readFileSync(join(repo, '.git/config'));
    assert(!fs.existsSync(marker),'Fixture unexpectedly ran fsmonitor while setting configuration');
    assert.equal(collector.uncached(repo).kind, 'ok'); assert(!fs.existsSync(marker),'fsmonitor marker');
    assert.deepEqual(fs.readFileSync(join(repo, '.git/config')), before);
    git('config', '--unset', 'core.fsmonitor');
    // Finish fixture writes before enabling the marker. Git for Windows can
    // leave a filter child completing after a maintenance/commit command exits.
    fs.writeFileSync(join(repo, '.gitattributes'), '*.txt filter=probe\n'); git('add', '.'); git('commit', '-qm', 'filter');
    git('config', 'filter.probe.clean', command + ' clean');
    fs.writeFileSync(join(repo, 'file.txt'), 'bbbb\n');
    fs.utimesSync(join(repo,'file.txt'),new Date(0),new Date(0));
    assert.equal(collector.uncached(repo).reason, 'filter_blocked'); assert(!fs.existsSync(marker),'clean filter marker');
    assert.equal(collector.branchDiff(repo, 'main').reason, null);
    const bare = join(installed.temporary, 'bare'); git('init', '--bare', '-q', bare);
    assert.notEqual(new GitInvocation(bare, 2000, runner).command(['rev-parse', '--is-bare-repository']).code, 0);
    const indirect = spawnSync(executable, ['-C', repo, 'config', '--get', 'core.fsmonitor'], {env:gitEnvironment(env), encoding:'utf8'});
    assert.equal(indirect.status, 0); assert.equal(indirect.stdout.trim(), '');
    git('status', '--porcelain');
    assert(fs.existsSync(marker), 'The unguarded control must exercise the clean filter');
    return 4;
}
