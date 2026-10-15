import { accessSync, constants, realpathSync, readFileSync, statSync } from 'node:fs';
import { delimiter, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import type { LaunchSpec } from './launch.js';
export function expandUser(value: string): string {
    return value === '~' ? homedir() : /^~[/\\]/u.test(value) ? join(homedir(), value.slice(2)) : value;
}
export function normalizedPath(value: string): string {
    const path = resolve(expandUser(value));
    return process.platform === 'win32' ? path.toLowerCase() : path;
}
export function resolvedPath(value: string): string {
    const path = resolve(expandUser(value));
    try {
        return realpathSync.native(path);
    }
    catch {
        const parent = dirname(path);
        return parent === path ? path : join(resolvedPath(parent), relative(parent, path));
    }
}
export function which(name: string, environment: NodeJS.ProcessEnv = process.env): string | null {
    if (name.includes('\0'))
        return null;
    const paths = /[/\\]/u.test(name) ? [''] : (environment.PATH ?? '').split(delimiter);
    const extensions = process.platform === 'win32' ? (environment.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';') : [''];
    for (const folder of paths)
        for (const suffix of ['', ...extensions.filter(e => !name.toLowerCase().endsWith(e.toLowerCase()))]) {
            const path = resolve(folder, name + suffix);
            try {
                if (statSync(path).isFile()) {
                    accessSync(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
                    return path;
                }
            }
            catch { /* Try the next PATH entry. */ }
        }
    return null;
}
/** POSIX shlex tokenization, used for identity only; this never executes a shell. */
export function splitCommand(value: unknown): string[] | null {
    if (typeof value !== 'string')
        return null;
    let quote = '', word = '', active = false;
    const result: string[] = [];
    for (let i = 0; i < value.length; i++) {
        const c = value[i]!;
        if (!quote && /[ \t\r\n]/u.test(c)) {
            if (active)
                result.push(word);
            word = '';
            active = false;
            continue;
        }
        if (c === quote) {
            quote = '';
            continue;
        }
        if (!quote && (c === "'" || c === '"')) {
            quote = c;
            active = true;
            continue;
        }
        if (c === '\\' && quote !== "'") {
            const next = value[++i];
            if (next === undefined)
                return null;
            if (quote === '"' && next !== '"' && next !== '\\')
                word += '\\';
            word += next;
            active = true;
            continue;
        }
        word += c;
        active = true;
    }
    if (quote)
        return null;
    if (active)
        result.push(word);
    return result;
}
export function quoteArgument(value: string): string {
    if (/[\0\r\n]/u.test(value))
        throw new TypeError('Unsafe command argument');
    return '"' + value.replace(/[\\"$`]/gu, '\\$&') + '"';
}
export function commandFor(launch: LaunchSpec, operation: string): string {
    if (!['render', 'render-subagents', 'hook', 'slash-hook'].includes(operation))
        throw new TypeError('Unsupported command operation');
    if (process.platform === 'win32' && !launch.args.length)
        return `claude-statusline.exe ${operation}`;
    return [...[launch.executable, ...launch.args].map(quoteArgument), operation].join(' ');
}
export function ownedCommand(command: unknown, operation: string, launch: LaunchSpec): boolean {
    const argv = splitCommand(command);
    if (!argv || argv.length !== launch.args.length + 2 || argv.at(-1) !== operation)
        return false;
    if (JSON.stringify(argv) === JSON.stringify(splitCommand(commandFor(launch, operation))))
        return true;
    if (argv.slice(1, -1).some((arg, index) => arg !== launch.args[index]))
        return false;
    let candidate = argv[0]!;
    if (!launch.args.length && !/[/\\]/u.test(candidate) && (candidate === 'claude-statusline' || candidate.toLowerCase() === 'claude-statusline.exe'))
        return true;
    if (normalizedPath(candidate) === normalizedPath(launch.executable))
        return true;
    const decoded = candidate.replaceAll('\\$', '$').replaceAll('\\`', '`');
    if (typeof command === 'string' && command.trim() === commandFor({ executable: decoded, args: launch.args }, operation))
        candidate = decoded;
    if (normalizedPath(resolvedPath(candidate)) === normalizedPath(resolvedPath(launch.executable)))
        return true;
    const found = which(candidate);
    return found !== null && normalizedPath(found) === normalizedPath(launch.executable);
}
export function claudeLaunch(executable = 'claude', windows = process.platform === 'win32', find: typeof which = which): LaunchSpec {
    let found = find(executable);
    if (!found)
        throw new Error('errors.capabilities.claude_code_is_not_in_path');
    // npm installs a POSIX shim beside the Windows .cmd entry. An extensionless
    // PATH hit must not be handed to CreateProcessW as if it were a PE binary.
    if (windows && !extname(found)) {
        const wrapper = find(found + '.cmd');
        if (wrapper && normalizedPath(wrapper) === normalizedPath(found + '.cmd'))
            found = wrapper;
    }
    const path = resolvedPath(found);
    if (!windows || !['.cmd', '.bat'].includes(extname(path).toLowerCase()))
        return { executable: path, args: [] };
    for (const root of [join(dirname(path), 'node_modules/@anthropic-ai/claude-code'), join(dirname(dirname(path)), '@anthropic-ai/claude-code')]) {
        try {
            const data = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
                bin?: string | Record<string, string>;
            };
            const entry = typeof data.bin === 'string' ? data.bin : data.bin?.claude;
            if (typeof entry !== 'string')
                continue;
            const target = resolvedPath(join(root, entry)), rel = relative(resolvedPath(root), target);
            if (rel.startsWith('..') || isAbsolute(rel) || !statSync(target).isFile())
                continue;
            if (extname(target).toLowerCase() === '.exe')
                return { executable: target, args: [] };
            const node = find('node');
            if (node && ['.js', '.cjs', '.mjs'].includes(extname(target).toLowerCase()))
                return { executable: resolvedPath(node), args: [target] };
        }
        catch { /* A malformed shim cannot authorize shell execution. */ }
    }
    throw new Error('errors.capabilities.cannot_safely_resolve_claude_batch_wrapper_use');
}
export function detectClaudeVersion(): readonly number[] | null {
    try {
        const launch = claudeLaunch();
        const result = spawnSync(launch.executable, [...launch.args, '--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true, shell: false });
        const match = result.stdout?.match(/(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)/u);
        return result.status === 0 && match ? match.slice(1).map(Number) : null;
    }
    catch {
        return null;
    }
}
