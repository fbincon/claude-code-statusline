/** Internal worker. Command timing never passes through this instrumented path. */
import * as fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import type { Input } from '../migration/ts-03/performance/fixtures.js';

const [requestPath, phase] = process.argv.slice(2);
const { installed, input } = JSON.parse(fs.readFileSync(requestPath!, 'utf8')) as { installed: string; input: Input };
const spec = input.spec;
const load = (area: string, name: string): Promise<any> => import(pathToFileURL(join(installed, 'node_modules/@fbincon/statusline-' + area, 'dist/src', name + '.js')).href);
const counts = { usage_calls: 0, transcript_reads: 0, git_calls: 0, reads: 0, writes: 0, read_bytes: 0, written_bytes: 0, index_reads: 0, index_writes: 0 };
const diagnostic = phase === 'diagnose';
const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

function instrument(io: any): void {
    const { read, write, lines } = io;
    io.read = (path: string) => {
        const value = read(path);
        counts.reads++;
        counts.read_bytes += value?.length ?? 0;
        if (/[bm]-[a-f0-9]{64}\.json$/u.test(path)) counts.index_reads++;
        return value;
    };
    io.write = (path: string, raw: Buffer) => {
        write(path, raw);
        counts.writes++;
        counts.written_bytes += raw.length;
        if (/[bm]-[a-f0-9]{64}\.json$/u.test(path)) counts.index_writes++;
    };
    io.lines = (...args: unknown[]) => { counts.transcript_reads++; return lines(...args); };
}

let usage: any, git: any, context: any;
if (['usage', 'render', 'git'].includes(spec.operation)) {
    context = (await load('cli', 'runtime/context')).runtimeContext();
    if (spec.operation !== 'git') {
        const { UsageCollector } = await load('cli', 'runtime/usage');
        if (diagnostic) {
            const collect = UsageCollector.prototype.collect, seen = new WeakSet<object>();
            UsageCollector.prototype.collect = function (data: unknown) {
                counts.usage_calls++;
                if (!seen.has(this.io)) { instrument(this.io); seen.add(this.io); }
                return collect.call(this, data);
            };
        }
        usage = new UsageCollector(context);
    }
    if (spec.operation !== 'usage') {
        const { GitCollector } = await load('cli', 'runtime/git');
        if (diagnostic) {
            const uncached = GitCollector.prototype.uncached, status = GitCollector.prototype.status, seen = new WeakSet<object>();
            GitCollector.prototype.uncached = function (cwd: string) { counts.git_calls++; return uncached.call(this, cwd); };
            GitCollector.prototype.status = function (...args: unknown[]) {
                if (!seen.has(this.io)) { instrument(this.io); seen.add(this.io); }
                return status.apply(this, args);
            };
        }
        git = new GitCollector(context);
    }
}

if (phase === 'prepare') {
    if (['usage', 'render'].includes(spec.operation)) usage.collect(input.payload);
    if (['git', 'render'].includes(spec.operation)) git.status(input.project, 'bench');
    process.stdout.write('{}\n');
} else {
    const { pythonJson } = await load('core', 'json-text');
    let value: unknown, stdout = '', elapsed: number | undefined;
    if (spec.mode === 'command') {
        const { main } = await load('cli', 'main');
        const status = await main([input.command], { stdin: () => input.raw, stdout: (text: string) => { stdout += text; } });
        if (status !== 0) throw new Error('Installed command failed: ' + status);
    } else {
        let action: () => unknown;
        if (spec.operation === 'usage') {
            const { sessionTokenCounts } = await load('core', 'runtime/usage');
            action = () => {
                const result = usage.collect(input.payload);
                if (!result) throw new Error('Usage became unavailable');
                return [result[0], result[1], result[2], sessionTokenCounts(result[4])];
            };
        } else if (spec.operation === 'git') {
            action = () => git.status(input.project, 'bench');
        } else {
            const { validateDisplay } = await load('core', 'config/display');
            const { renderEnvironment } = await load('cli', 'rendering/environment');
            const display = validateDisplay(input.display), env = await renderEnvironment(display, input.payload, {}, spec.operation === 'agents');
            if (spec.operation === 'agents') {
                const { renderPayload } = await load('core', 'rendering/subagents');
                action = () => renderPayload(input.payload, display, env, 1788400078000);
            } else {
                const { configuredRows } = await load('core', 'rendering/items');
                action = () => configuredRows(input.payload, display, 80, env);
            }
        }
        const start = performance.now();
        value = action();
        elapsed = performance.now() - start;
    }
    const encoded = pythonJson(value ?? null, { sortKeys: true, ensureAscii: false, compact: true });
    process.stdout.write(JSON.stringify({ ms: elapsed, stdout, output_sha256: hash(encoded), counts }) + '\n');
}
