import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, truncateSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import type { Input } from './fixtures.js';
const [path, phase, countText = '50'] = process.argv.slice(2);
const input = JSON.parse(readFileSync(path!, 'utf8')) as Input, { spec } = input, count = Number(countText);
const counts = { usage_calls: 0, transcript_reads: 0, git_calls: 0 };
const resetCounts = () => { counts.usage_calls = counts.transcript_reads = counts.git_calls = 0; };
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const rss = () => process.resourceUsage().maxRSS * 1024;
let usage: import('@fbincon/statusline-cli/runtime/usage').UsageCollector | undefined;
let git: import('@fbincon/statusline-cli/runtime/git').GitCollector | undefined;
if (['render', 'usage', 'git'].includes(spec.operation)) {
    const { runtimeContext } = await import('@fbincon/statusline-cli/runtime/context');
    const context = runtimeContext();
    if (spec.operation !== 'git') {
        const { UsageCollector } = await import('@fbincon/statusline-cli/runtime/usage');
        const collect = UsageCollector.prototype.collect, instrumented = new WeakSet<object>();
        UsageCollector.prototype.collect = function (data) {
            counts.usage_calls++;
            if (!instrumented.has(this.io)) {
                const lines = this.io.lines;
                this.io.lines = (...args) => { counts.transcript_reads++; return lines(...args); };
                instrumented.add(this.io);
            }
            return collect.call(this, data);
        };
        usage = new UsageCollector(context);
    }
    const { GitCollector } = await import('@fbincon/statusline-cli/runtime/git');
    const uncached = GitCollector.prototype.uncached;
    GitCollector.prototype.uncached = function (cwd) { counts.git_calls++; return uncached.call(this, cwd); };
    git = new GitCollector(context);
}
if (phase === 'prepare') {
    if (spec.operation === 'render') {
        usage!.collect(input.payload);
        git!.status(input.project, 'bench');
    }
    process.stdout.write('{"prepared":true}\n');
}
else if (spec.mode === 'command') {
    const { main } = await import('@fbincon/statusline-cli/main');
    resetCounts();
    const status = await main([input.command]);
    let signature: unknown = null;
    if (spec.operation === 'hook') {
        const directory = join(process.env.CLAUDE_STATUSLINE_RUNTIME_DIR!, 'turns');
        const files = readdirSync(directory).filter(name => name.endsWith('.json'));
        const state = JSON.parse(readFileSync(join(directory, files[0]!), 'utf8'));
        signature = { records: files.length, status: state.status, prompt_id: state.prompt_id };
    }
    process.stderr.write(JSON.stringify({ peak_rss_bytes: rss(), counts, signature }) + '\n');
    process.exitCode = status;
}
else {
    const { pythonJson } = await import('@fbincon/statusline-core/json-text');
    let action: () => unknown, prepare = () => { }, cleanup = () => { };
    if (spec.operation === 'usage') {
        const { sessionTokenCounts } = await import('@fbincon/statusline-core/runtime/usage');
        action = () => { const result = usage!.collect(input.payload)!; return [result[0], result[1], result[2], sessionTokenCounts(result[4])]; };
        if (spec.cache === 'cold')
            prepare = () => rmSync(usage!.path(), { force: true });
        else {
            action();
            const cache = readFileSync(usage!.path()), size = statSync(input.history).size;
            prepare = () => { writeFileSync(usage!.path(), cache); if (spec.cache === 'append')
                appendFileSync(input.history, input.append); };
            cleanup = () => { if (spec.cache === 'append') {
                truncateSync(input.history, size);
                utimesSync(input.history, 1788400000, 1788400000);
            } };
        }
    }
    else if (spec.operation === 'git') {
        const value = git!.uncached(input.project);
        action = () => git!.status(input.project, 'bench');
        prepare = () => {
            if (spec.cache === 'miss')
                rmSync(git!.path('bench'), { force: true });
            else {
                git!.writeCache('bench', input.project, value);
                if (spec.cache === 'expired') {
                    const cache = JSON.parse(readFileSync(git!.path('bench'), 'utf8'));
                    cache.checked_ns = '0';
                    // A quoted integer is also invalid, so use a true stale integer on disk.
                    writeFileSync(git!.path('bench'), JSON.stringify(cache).replace('"checked_ns":"0"', '"checked_ns":0'));
                }
            }
        };
    }
    else {
        const { validateDisplay } = await import('@fbincon/statusline-core/config/display');
        const { renderEnvironment } = await import('@fbincon/statusline-cli/rendering/environment');
        const display = validateDisplay(input.display), env = await renderEnvironment(display, input.payload, {}, spec.operation === 'agents');
        if (spec.operation === 'agents') {
            const { renderPayload } = await import('@fbincon/statusline-core/rendering/subagents');
            action = () => renderPayload(input.payload, display, env, 1788400078000);
        }
        else {
            const { configuredRows } = await import('@fbincon/statusline-core/rendering/items');
            action = () => configuredRows(input.payload, display, 80, env);
        }
    }
    mkdirSync(process.env.CLAUDE_STATUSLINE_RUNTIME_DIR!, { recursive: true });
    const records = [];
    for (let index = 0; index < count; index++) {
        prepare();
        resetCounts();
        const start = performance.now();
        const value = action!();
        const elapsed = performance.now() - start;
        const encoded = pythonJson(value, { sortKeys: true, ensureAscii: false, compact: true });
        records.push({ ms: elapsed, peak_rss_bytes: rss(), counts: { ...counts }, output_sha256: digest(encoded) });
        cleanup();
    }
    process.stdout.write(JSON.stringify({ records, peak_rss_bytes: rss() }) + '\n');
}
