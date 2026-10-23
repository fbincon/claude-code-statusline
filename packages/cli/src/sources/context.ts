import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { SourceContext } from '@fbincon/statusline-core/contracts/ui';
import { projectPaths } from '@fbincon/statusline-platform/project-paths';
export function contextFor(project: string | null, session: string | null = null, agent: string | null = null): SourceContext {
    const context: SourceContext = { project: project ? projectPaths.canonical(resolve(project)) : null, session, agent, branch: null, head: null };
    if (!context.project)
        return context;
    try {
        const git = (args: string[]) => execFileSync('git', ['-C', context.project!, 'rev-parse', ...args], { encoding: 'utf8', timeout: 1000, maxBuffer: 65536, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).trim();
        const lines = git(['--show-toplevel', '--abbrev-ref', 'HEAD']).split(/\r?\n/u), head = git(['--verify', 'HEAD']);
        if (lines.length === 2 && /^[a-f0-9]{40,64}$/u.test(head)) {
            context.project = projectPaths.canonical(lines[0]!) ?? context.project;
            context.branch = lines[1] === 'HEAD' ? null : lines[1]!;
            context.head = head;
        }
    }
    catch { /* A local source does not require a Git repository. */ }
    return context;
}
/** Local change detector only: no gh call or credential-store access on render. */
export function authRevision(env: NodeJS.ProcessEnv = process.env): string {
    const root = env.GH_CONFIG_DIR ?? (process.platform === 'win32' ? join(env.APPDATA ?? homedir(), 'GitHub CLI') : join(env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'gh'));
    let metadata = '';
    try {
        const s = statSync(join(root, 'hosts.yml'), { bigint: true });
        metadata = [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':');
    }
    catch { /* gh can use environment authentication. */ }
    // Only the aggregate digest is retained. No token or individual token digest is returned.
    return createHash('sha256').update(JSON.stringify([root, metadata, env.GH_HOST ?? '', ...['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN'].map(key => env[key] ?? '')])).digest('hex');
}
