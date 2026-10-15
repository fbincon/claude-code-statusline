import { spawn } from 'node:child_process';
import type { LaunchSpec } from '@fbincon/statusline-core/integration/binding';
export { binding } from '@fbincon/statusline-core/integration/binding';
export type { LaunchSpec } from '@fbincon/statusline-core/integration/binding';

export interface ProcessResult { code: number | null; stdout: string; stderr: string; timedOut: boolean }

export function nodeBinding(entry: string): LaunchSpec { return { executable: process.execPath, args: [entry] }; }

/** Execute argv without a shell; callers explicitly supply environment and cwd when isolated. */
export function run(spec: LaunchSpec, args: readonly string[], input = '', timeoutMs = 30_000,
  env: NodeJS.ProcessEnv = process.env, cwd?: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.executable, [...spec.args, ...args], { env, cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
    child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') reject(error); });
    child.stdin.end(input, 'utf8');
  });
}
