/** Prepare the CI command host without executing any candidate code or input. */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { POWERSHELL_BOOTSTRAP, POWERSHELL_FLAGS, powershellEnvironment, shellReceipt } from '../migration/ts-04/shell.js';

export function prepareWindowsPowerShell() {
    if (process.platform !== 'win32') throw new Error('Windows PowerShell preparation requires Windows');
    const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    // Fresh ARM runners can spend >20s initializing Windows PowerShell itself,
    // before executing the first script statement. This bounded infrastructure
    // phase touches only system modules. Application/shell calls remain at 20s.
    const timeout = 60000, started = performance.now();
    const command = POWERSHELL_BOOTSTRAP +
        "if (-not (Test-Path -LiteralPath $PSHOME)) { throw 'PowerShell home is missing' }; " +
        "[void](Split-Path $PSHOME -Parent); $prepared = 'ts05-shell-ready' | Out-String -Stream; [Console]::WriteLine($prepared); " +
        '[Console]::WriteLine($PSVersionTable.PSVersion.ToString());';
    const result = spawnSync(executable, [...POWERSHELL_FLAGS, command], {
        env: powershellEnvironment(process.env), input: '', encoding: 'utf8',
        timeout, windowsHide: true, maxBuffer: 1024 * 1024,
    });
    const lines = (result.stdout ?? '').trim().split(/\r?\n/u);
    return {
        status: result.status === 0 && !result.error && lines.length === 2 && lines[0] === 'ts05-shell-ready' && /^\d+\.\d+\.\d+\.\d+$/u.test(lines[1]!) ? 'pass' : 'fail',
        purpose: 'system-shell-readiness', candidate_invoked: false, node: process.version,
        powershell_version: lines[1] ?? null, stdout: result.stdout,
        receipt: shellReceipt(executable, 'system-modules-only', result, performance.now() - started, timeout),
    };
}
