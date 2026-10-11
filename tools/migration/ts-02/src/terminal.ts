import { appendFileSync } from 'node:fs';
import { clip, displayWidth } from './generated/unicode.js';

export function frame(columns: number, rows: number): string {
  const label = columns < 64 || rows < 18 ? 'Need 64x18; Ctrl+C exits' : 'TS-02 中文 é 👩🏽‍💻 | Ctrl+S save | Ctrl+C cancel';
  const line = clip(label, Math.max(0, columns - 1));
  if (displayWidth(line) >= columns && columns > 0) throw new Error('Cell overflow');
  return '\x1b[H\x1b[2J\x1b[1m' + line + '\x1b[0m';
}
export function terminal(log: string): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('TTY required');
  const record = (event: string, data: unknown = null) => appendFileSync(log, JSON.stringify({ event, data }) + '\n');
  let stopped = false;
  const draw = () => { process.stdout.write(frame(process.stdout.columns, process.stdout.rows)); record('resize', [process.stdout.columns, process.stdout.rows]); };
  const finish = (reason: string, code: number) => {
    if (stopped) return;
    stopped = true;
    process.stdin.setRawMode(false); process.stdin.pause();
    process.stdout.write('\x1b[0m\x1b[?25h\x1b[?1049l');
    record('restored', reason); process.exitCode = code;
    process.stdin.removeAllListeners('data'); process.stdout.off('resize', draw);
  };
  process.stdin.setRawMode(true); process.stdin.setEncoding('utf8'); process.stdin.resume();
  process.stdout.write('\x1b[?1049h\x1b[?25l'); draw(); record('ready');
  process.stdin.on('data', (data: string) => {
    record('key', data);
    if (data.includes('\x13')) finish('save', 0);
    else if (data.includes('\x03')) finish('cancel', 130);
  });
  process.stdout.on('resize', draw);
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]] as const) process.once(signal, () => finish(signal, code));
  process.once('uncaughtException', error => { record('error', String(error)); finish('exception', 1); });
}
