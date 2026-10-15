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
/** npm's stock .ps1 shim uses Management's Split-Path/Test-Path; PowerShell's
 * native stdin formatter also calls Utility's Out-String. Resolve both directly
 * and reject unexpected autoload dependencies in the deliberately reduced
 * environment. Keep all loading inside the same smoke timeout.
 */
export const POWERSHELL_BOOTSTRAP = "$ErrorActionPreference = 'Stop'; $PSModuleAutoLoadingPreference = 'None'; " +
    ['Management', 'Utility'].map(name => `Import-Module ($PSHOME + '\\Modules\\Microsoft.PowerShell.${name}\\Microsoft.PowerShell.${name}.psd1') -ErrorAction Stop; `).join('');

/** Windows PowerShell initializes .NET known folders before the command starts.
 * A fabricated USERPROFILE is not a loaded Windows user profile. Bootstrap the
 * shell with the actual OS profile, then restore isolated product paths inside
 * the command before launching Node. No PowerShell profile script is loaded.
 */
export function powershellEnvironment(isolated: NodeJS.ProcessEnv, operatingSystem: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const result = { ...isolated };
    for (const name of ['USERPROFILE', 'HOME', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'SystemDrive', 'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432', 'CommonProgramFiles', 'CommonProgramFiles(x86)', 'CommonProgramW6432']) {
        if (operatingSystem[name] !== undefined) result[name] = operatingSystem[name];
        else delete result[name];
    }
    // A PowerShell 7 parent can leak incompatible module paths through Node.
    for (const name of Object.keys(result)) if (name.toUpperCase() === 'PSMODULEPATH') delete result[name];
    return result;
}
export function powershellIsolation(isolated: NodeJS.ProcessEnv): string {
    const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
    // Keep the shell's OS cache/known-folder environment valid. Removing those
    // with a cmdlet autoloads modules under an invalid profile before Node runs.
    // Only product home paths change; CLAUDE_CONFIG_DIR and restricted PATH were
    // isolated at process creation. Null assignment requires no module autoload.
    return ['USERPROFILE', 'HOME'].map(name =>
        `$env:${name} = ${isolated[name] === undefined ? '$null' : quote(isolated[name]!)}; `).join('');
}
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
