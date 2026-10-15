import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { library } from '@fbincon/statusline-platform/native';
const [mode, path, ...args] = process.argv.slice(2);
if (mode === 'tmux') {
    const lib = library(process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6');
    if (lib.func('int ioctl(int fd, unsigned long request, ...)')(0, process.platform === 'darwin' ? 0x20007461 : 0x540e, 'int', 0))
        throw new Error('Cannot acquire controlling terminal');
    process.exitCode = spawnSync(path!, args, { stdio: 'inherit' }).status ?? 2;
}
else {
    const raw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.setRawMode(raw);
    }
    writeFileSync(path!, JSON.stringify({ input_tty: !!process.stdin.isTTY, output_tty: !!process.stdout.isTTY, cwd: process.cwd(), argv: args }), { mode: 0o600 });
    if (mode === 'hold')
        setInterval(() => { }, 1000);
}
