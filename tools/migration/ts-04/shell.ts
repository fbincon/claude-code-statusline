import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export interface ShellReceipt {
  executable: string;
  operation: string;
  elapsed_ms: number;
  timeout_ms: number;
  status: number | null;
  signal: string | null;
  error: { name: string; code?: string; message: string } | null;
  stderr: string;
}

/** A shell smoke must never wait for terminal input or an interactive prompt. */
export const POWERSHELL_FLAGS = ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command'];
export function shellReceipt(executable: string, operation: string, result: SpawnSyncReturns<string>, elapsed: number, timeout: number): ShellReceipt {
  const error = result.error as (Error & { code?: string }) | undefined;
  return {
    executable, operation, elapsed_ms: Math.round(elapsed), timeout_ms: timeout,
    status: result.status, signal: result.signal,
    error: error ? { name: error.name, code: error.code, message: error.message } : null,
    stderr: result.stderr ?? '',
  };
}
export function runShell(executable: string, args: string[], operation: string, env: NodeJS.ProcessEnv, input = '') {
  const started = performance.now(), timeout = 20000;
  const result = spawnSync(executable, args, { env, input, encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return { result, receipt: shellReceipt(executable, operation, result, performance.now() - started, timeout) };
}
