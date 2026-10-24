import { isAbsolute, relative, resolve, sep } from 'node:path';
import { realpathSync, statSync, accessSync, constants, existsSync } from 'node:fs';
import { runCommand, monotonicMilliseconds, CommandTimeout, type CommandRunner, type CommandResult } from './command.js';
import { which } from './commands.js';

/** Per-process policy only: never rewrite repository or user configuration. */
export const GIT_POLICY_VERSION = 1;
const BASE = ['core.fsmonitor=', 'safe.bareRepository=explicit'];
export class GitPolicyError extends Error {
    constructor(public readonly reason: 'filter_blocked' | 'policy_unavailable' | 'not_repo') { super(reason); }
}
export interface FilterEntry { scope: string; origin: string; key: string; name: string; field: string; value: string }
export function filterEntries(raw: string): FilterEntry[] {
    if (!raw) return [];
    const parts = raw.split('\0');
    if (parts.pop() !== '' || parts.length % 3) throw new GitPolicyError('policy_unavailable');
    const result: FilterEntry[] = [];
    for (let i = 0; i < parts.length; i += 3) {
        const scope = parts[i]!, origin = parts[i + 1]!, pair = parts[i + 2]!, at = pair.indexOf('\n');
        const key = pair.slice(0, at), match = /^filter\.(.+)\.(clean|smudge|process|required)$/u.exec(key);
        if (at < 0 || !match || !['system', 'global', 'local', 'worktree', 'command'].includes(scope)) throw new GitPolicyError('policy_unavailable');
        result.push({ scope, origin, key, name: match[1]!, field: match[2]!, value: pair.slice(at + 1) });
    }
    return result;
}
function inside(path: string, root: string): boolean {
    const part = relative(root, path);
    return !part || part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part);
}
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
function externalExecutable(path: string, roots: readonly string[]): string | null {
    try {
        const actual = realpathSync.native(path);
        if (roots.some(root => inside(actual, root)) || !statSync(actual).isFile() || /[\r\n\0]/u.test(actual)) return null;
        accessSync(actual, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
        return actual;
    } catch { return null; }
}
/** Known repository-installed drivers are pinned to a verified external executable. */
export function filterOverrides(entries: readonly FilterEntry[], roots: readonly string[], env: NodeJS.ProcessEnv): string[] {
    const overrides = new Map<string, string>();
    for (const entry of entries) {
        const origin = entry.origin.startsWith('file:') ? resolve(roots[0]!, entry.origin.slice(5)) : null;
        let repositoryOwned = ['local', 'worktree'].includes(entry.scope);
        if (origin) {
            try { repositoryOwned ||= roots.some(root => inside(realpathSync.native(origin), root)); }
            catch { throw new GitPolicyError('policy_unavailable'); }
        }
        if (!repositoryOwned || entry.field === 'required') continue;
        if (/[=\r\n\0]/u.test(entry.name)) throw new GitPolicyError('filter_blocked');
        if (!entry.value) { overrides.set(entry.key, ''); continue; }
        const lfs: Record<string, string> = { clean: 'clean -- %f', smudge: 'smudge -- %f', process: 'filter-process' };
        if (entry.value === 'git-lfs ' + lfs[entry.field]) {
            const found = which('git-lfs', env), executable = found && externalExecutable(found, roots);
            if (!executable) throw new GitPolicyError('filter_blocked');
            overrides.set(entry.key, quote(executable) + ' ' + lfs[entry.field]);
            continue;
        }
        const crypt = /^(?:"([\p{L}\p{N}\p{M}_./\\:+@ -]+)"|([\p{L}\p{N}\p{M}_./\\:+@-]+)) (clean|smudge)( --key-name [\w-]+)?$/u.exec(entry.value);
        const program = crypt?.[1] ?? crypt?.[2];
        if (program && isAbsolute(program) && /(?:^|[/\\])git-crypt(?:\.exe)?$/u.test(program) && crypt![3] === entry.field) {
            const executable = externalExecutable(program, roots);
            if (executable) { overrides.set(entry.key, quote(executable) + ' ' + crypt![3] + (crypt![4] ?? '')); continue; }
        }
        throw new GitPolicyError('filter_blocked');
    }
    return [...overrides].map(([key, value]) => key + '=' + value);
}
/** Preserve existing user runtime pairs, append our policy, and reject malformed environments. */
export function gitEnvironment(env: NodeJS.ProcessEnv = process.env, overrides: readonly string[] = []): NodeJS.ProcessEnv {
    const raw = env.GIT_CONFIG_COUNT ?? '', count = raw === '' ? 0 : Number(raw);
    if (!/^(?:\d+)?$/u.test(raw) || !Number.isSafeInteger(count) || count > 1024) throw new GitPolicyError('policy_unavailable');
    const next: NodeJS.ProcessEnv = { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
    for (let i = 0; i < count; i++) if (env['GIT_CONFIG_KEY_' + i] === undefined || env['GIT_CONFIG_VALUE_' + i] === undefined) throw new GitPolicyError('policy_unavailable');
    [...BASE, ...overrides].forEach((pair, i) => {
        const at = pair.indexOf('=');
        next['GIT_CONFIG_KEY_' + (count + i)] = pair.slice(0, at);
        next['GIT_CONFIG_VALUE_' + (count + i)] = pair.slice(at + 1);
    });
    next.GIT_CONFIG_COUNT = String(count + BASE.length + overrides.length);
    // Git parses command-scope parameters after COUNT. Keep user parameters but
    // append the policy last, including for Git children of provider programs.
    next.GIT_CONFIG_PARAMETERS = [env.GIT_CONFIG_PARAMETERS ?? '', ...[...BASE, ...overrides].map(quote)].filter(Boolean).join(' ');
    return next;
}
export class GitInvocation {
    private readonly deadline: number;
    readonly environment: NodeJS.ProcessEnv;
    constructor(readonly cwd: string, timeoutMs: number, readonly run: CommandRunner = runCommand,
        readonly monotonic = monotonicMilliseconds, env: NodeJS.ProcessEnv = process.env) {
        this.deadline = monotonic() + timeoutMs;
        this.environment = gitEnvironment(env);
    }
    command(args: readonly string[], overrides: readonly string[] = []): CommandResult {
        const timeoutMs = this.deadline - this.monotonic();
        if (timeoutMs <= 0) throw new CommandTimeout('Git deadline expired');
        return this.run({ executable: 'git', args: ['-C', this.cwd, '--no-optional-locks', ...[...BASE, ...overrides].flatMap(pair => ['-c', pair]), ...args] },
            { timeoutMs, environment: this.environment, maxOutputBytes: 4 * 1024 * 1024 });
    }
    /** Inspection commands do not scan tracked file contents or invoke filter programs. */
    worktreePolicy(seen = new Set<string>()): string[] {
        const config = this.command(['config', '--null', '--includes', '--show-scope', '--show-origin', '--get-regexp', '^filter\\..*\\.(clean|smudge|process|required)$']);
        if (config.code !== 0 && !(config.code === 1 && !config.stdout.length)) throw new GitPolicyError(config.stderr.toString().includes('not a git repository') ? 'not_repo' : 'policy_unavailable');
        const entries = filterEntries(config.stdout.toString('utf8'));
        const index = this.command(['ls-files', '--stage', '-z', '--full-name', '--', ':/']);
        if (index.code !== 0) throw new GitPolicyError(index.stderr.toString().includes('not a git repository') ? 'not_repo' : 'policy_unavailable');
        const submodules = index.stdout.toString('utf8').split('\0').filter(row => row.startsWith('160000 ')).map(row => row.slice(row.indexOf('\t') + 1));
        if (!entries.length && !submodules.length) return [];
        const roots = this.command(['rev-parse', '--show-toplevel', '--absolute-git-dir', '--path-format=absolute', '--git-common-dir']);
        if (roots.code !== 0) throw new GitPolicyError('policy_unavailable');
        const paths = roots.stdout.toString('utf8').trimEnd().split(/\r?\n/u);
        if (paths.length !== 3 || paths.some(path => !isAbsolute(path))) throw new GitPolicyError('policy_unavailable');
        const canonical = paths.map(path => realpathSync.native(path)), top = canonical[0]!;
        if (seen.has(top) || seen.size >= 64) throw new GitPolicyError('policy_unavailable');
        seen.add(top);
        const overrides = filterOverrides(entries, canonical, this.environment);
        for (const submodule of submodules) {
            const child = resolve(top, submodule);
            if (!inside(child, top) || child === top) throw new GitPolicyError('policy_unavailable');
            if (!existsSync(resolve(child, '.git'))) continue; // An uninitialized module cannot scan a worktree.
            const nested = new GitInvocation(child, this.deadline - this.monotonic(), this.run, this.monotonic, this.environment).worktreePolicy(seen);
            for (const value of nested) {
                const key = value.slice(0, value.indexOf('='));
                if (overrides.some(previous => previous.startsWith(key + '=') && previous !== value)) throw new GitPolicyError('policy_unavailable');
                if (!overrides.includes(value)) overrides.push(value);
            }
        }
        return overrides;
    }
}
