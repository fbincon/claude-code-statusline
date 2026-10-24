import { join, resolve } from 'node:path';
import { object, int, truth, string, type Data } from '@fbincon/statusline-core/runtime/values';
import { validGitResult, parsePorcelain, numstat, GIT_CACHE_VERSION, GIT_CACHE_TTL_NS, GIT_CACHE_MAX_AGE_NS, GIT_CACHE_MAX_FILES } from '@fbincon/statusline-core/runtime/git';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { runCommand, CommandTimeout, monotonicMilliseconds, type CommandRunner } from '@fbincon/statusline-platform/command';
import type { RuntimeContext } from './context.js';
import { runtimeIO, readStored, type RuntimeIO } from './io.js';
import { readDataJson } from './json-data.js';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { GitInvocation, GitPolicyError } from '@fbincon/statusline-platform/git';
function strip(raw: Buffer): Buffer { let start = 0, end = raw.length; const space = (v: number) => v === 32 || v >= 9 && v <= 13; while (start < end && space(raw[start]!))
    start++; while (end > start && space(raw[end - 1]!))
    end--; return raw.subarray(start, end); }
function ascii(raw: Buffer): string { if (raw.some(byte => byte > 127))
    throw new Error('Non-ASCII Git object identity'); return raw.toString('ascii'); }
export class GitCollector {
    constructor(public readonly context: RuntimeContext, public readonly io: RuntimeIO = runtimeIO(), public readonly run: CommandRunner = runCommand, public readonly monotonic: () => number = monotonicMilliseconds) { }
    directory(): string { return join(this.context.cacheRoot, 'git_cache'); }
    path(session: unknown): string { return join(this.directory(), sha256(string(session)) + '.json'); }
    readCache(session: unknown, cwd: string): Data | null {
        if (!truth(session))
            return null;
        try {
            const bytes = this.io.read(this.path(session));
            const raw = bytes === null ? null : readDataJson(decodeUtf8(bytes));
            if (!object(raw) || !equalSettings(raw.version, GIT_CACHE_VERSION) || raw.cwd !== resolve(cwd))
                return null;
            const checked = int(raw.checked_ns, false), age = checked === null ? -1n : this.context.sample().wall_ns - checked;
            return age >= 0n && age <= GIT_CACHE_TTL_NS && validGitResult(raw.value) ? raw.value : null;
        }
        catch {
            return null;
        }
    }
    prune(maxAge = GIT_CACHE_MAX_AGE_NS, maxFiles = GIT_CACHE_MAX_FILES): void {
        const now = this.context.sample().wall_ns, live: {
            path: string;
            stamp: bigint;
        }[] = [];
        let entries;
        try {
            entries = this.io.entries(this.directory());
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.file || entry.link || !entry.name.endsWith('.json'))
                continue;
            try {
                const stamp = this.io.stat(entry.path, false).mtimeNs, age = now - stamp;
                if (age >= 0n && age > maxAge)
                    this.io.remove(entry.path);
                else
                    live.push({ path: entry.path, stamp });
            }
            catch { /* Ignore inaccessible cache entries. */ }
        }
        if (live.length > maxFiles)
            for (const entry of live.sort((a, b) => a.stamp < b.stamp ? -1 : a.stamp > b.stamp ? 1 : a.path < b.path ? -1 : 1).slice(0, live.length - maxFiles)) {
                try {
                    this.io.remove(entry.path);
                }
                catch { /* Retry on later pruning. */ }
            }
    }
    writeCache(session: unknown, cwd: string, value: unknown): void {
        if (!truth(session) || !validGitResult(value))
            return;
        try {
            this.io.privateDirectory(this.directory());
            this.io.write(this.path(session), Buffer.from(pythonJson({ version: GIT_CACHE_VERSION, checked_ns: this.context.sample().wall_ns, cwd: resolve(cwd), value }, { compact: true, allowNan: true })));
            this.prune();
        }
        catch { /* Git collection remains useful without a cache. */ }
    }
    uncached(cwd: string): Data {
        try {
            const invocation = new GitInvocation(cwd, 2000, this.run, this.monotonic);
            const policy = invocation.worktreePolicy();
            const result = invocation.command(['status', '--porcelain=v2', '--branch', '--ahead-behind', '--renames', '--untracked-files=all'], policy);
            if (result.code !== 0)
                return { kind: result.stderr.toString('utf8').includes('not a git repository') ? 'not_repo' : 'error' };
            return parsePorcelain(result.stdout.toString('utf8'));
        }
        catch (error) {
            return error instanceof GitPolicyError ? error.reason === 'not_repo' ? { kind: 'not_repo' } : { kind: 'error', reason: error.reason } : { kind: 'error' };
        }
    }
    status(cwd: string, session: unknown = null): Data {
        const cached = this.readCache(session, cwd);
        if (cached)
            return cached;
        const result = this.uncached(cwd);
        this.writeCache(session, cwd, result);
        return result;
    }
    branchDiff(cwd: string, baseRef: string | null = null, timeoutMs = 2000): Data {
        let invocation: GitInvocation;
        const git = (...args: string[]) => invocation.command(args);
        const commit = (ref: string) => { const result = git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}'); return result.code === 0 ? ascii(strip(result.stdout)) : null; };
        try {
            invocation = new GitInvocation(cwd, timeoutMs, this.run, this.monotonic);
            const repository = git('rev-parse', '--show-toplevel');
            if (repository.code !== 0)
                return { value: null, reason: 'not_repo' };
            const head = commit('HEAD');
            let base: string | null = null, selected = baseRef;
            for (const ref of baseRef === null ? ['origin/HEAD', 'main', 'master'] : [baseRef]) {
                base = commit(ref);
                if (base) {
                    selected = ref;
                    break;
                }
            }
            if (!head || !base)
                return { value: null, reason: 'base_unavailable' };
            const key = sha256(Buffer.concat([strip(repository.stdout), Buffer.from('\0' + head + '\0' + base)])), target = join(this.directory(), 'diff-' + key + '.json');
            const success = (value: unknown) => ({ value, reason: null, base_ref: selected, head, base });
            try {
                const cached = this.io.isLink(target) ? null : readStored(this.io, target, true);
                if (object(cached) && Object.keys(cached).sort().join(',') === 'added,files,removed' && Object.values(cached).every(value => int(value) !== null && int(value)! >= 0n))
                    return success(cached);
            }
            catch { /* Regenerate only this immutable commit-pair cache entry. */ }
            const ancestor = git('merge-base', base, head);
            if (ancestor.code !== 0)
                return { value: null, reason: 'merge_base_unavailable' };
            const diff = git('diff', '--no-ext-diff', '--no-textconv', '--numstat', '-z', ascii(strip(ancestor.stdout)), head, '--');
            if (diff.code !== 0)
                return { value: null, reason: 'source_unavailable' };
            const value = numstat(diff.stdout);
            try {
                this.io.write(target, Buffer.from(pythonJson(value)));
                this.prune();
            }
            catch { /* A read result does not depend on cache publication. */ }
            return success(value);
        }
        catch (error) {
            return { value: null, reason: error instanceof CommandTimeout ? 'timeout' : 'source_unavailable' };
        }
    }
}
