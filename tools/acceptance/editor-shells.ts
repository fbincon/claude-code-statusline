import * as fs from 'node:fs';
import { join } from 'node:path';
import { POWERSHELL_BOOTSTRAP, powershellEnvironment, powershellIsolation } from '../migration/ts-04/shell.js';

export const EDITOR_SHELLS = ['powershell', 'cmd', 'git-bash'] as const;
export function editorShell(name: typeof EDITOR_SHELLS[number], directory: string, argv: readonly string[], environment: NodeJS.ProcessEnv) {
    const names = ['NODE', 'DRIVER', 'MODULES', 'OPERATION', 'CONFIG', 'RECEIPT', 'CHOICE'];
    const env: NodeJS.ProcessEnv = { ...environment, ...Object.fromEntries(names.map((key, index) => ['TS06_COLOR_' + key, argv[index]])) };
    const system = process.env.SystemRoot ?? 'C:\\Windows';
    if (name === 'powershell') {
        const command = POWERSHELL_BOOTSTRAP + powershellIsolation(env) + '& ' + names.map(key => '$env:TS06_COLOR_' + key).join(' ') + '; exit $LASTEXITCODE';
        return { argv: [join(system, 'System32/WindowsPowerShell/v1.0/powershell.exe'), '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], env: powershellEnvironment(env) };
    }
    if (name === 'cmd') {
        // An ASCII fixture filename avoids cmd.exe's special /c quoting rules.
        // Only fixed variable names enter the script; paths remain quoted data.
        fs.writeFileSync(join(directory, 'color-shell.cmd'), '@echo off\r\n' + names.map(key => '"%TS06_COLOR_' + key + '%"').join(' ') + '\r\nexit /b %errorlevel%\r\n');
        return { argv: [join(system, 'System32/cmd.exe'), '/d', '/c', 'color-shell.cmd'], env };
    }
    const bash = process.env.TS04_GIT_BASH ?? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git/bin/bash.exe');
    // Bash resolves its executable as a POSIX path; native Node receives the
    // remaining paths in Windows form without relying on MSYS argument rewriting.
    const command = 'exec 2>color-shell.stderr; export TERM=xterm-256color; exec ' + names.map((key, index) => index === 0 ? '"$(/usr/bin/cygpath -u "$TS06_COLOR_' + key + '")"' : '"$TS06_COLOR_' + key + '"').join(' ');
    return { argv: [bash, '--noprofile', '--norc', '-c', command], env };
}
