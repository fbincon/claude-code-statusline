import { execFileSync } from 'node:child_process';

/** Git reads shared by the development verifier and the minimum-Node smoke. */
export function git(...args: string[]): string {
    return execFileSync('git', ['--no-replace-objects', ...args], {
        encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}
