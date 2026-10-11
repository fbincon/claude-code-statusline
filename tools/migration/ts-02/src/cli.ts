#!/usr/bin/env node
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { encode } from './json.js';
const [command, ...args] = process.argv.slice(2);
if (process.env.TS02_MEASURE === '1') process.on('exit', () => {
  process.stderr.write(JSON.stringify({ peak_rss_bytes: process.resourceUsage().maxRSS * 1024 }) + '\n');
});
try {
  if (command === 'render') {
    const { render } = await import('./render.js');
    process.stdout.write(render(readFileSync(0, 'utf8'), args[0]!, Number(args[1] ?? 80)));
  } else if (command === 'clock') {
    const { sample, processToken } = await import('./clocks.js');
    process.stdout.write(encode({ ...sample(), token: processToken(Number(args[0] ?? process.pid)) }) + '\n');
  } else if (command === 'lock') {
    const { lock, atomicWrite } = await import('./files.js');
    const release = lock(args[0]!);
    try {
      if (args[1] === 'hold') { process.stdout.write('locked\n'); await new Promise(r => setTimeout(r, 60000)); }
      else if (args[1] === 'increment') {
        const path = args[2]!;
        const count = Number(readFileSync(path, 'utf8'));
        atomicWrite(path, String(count + 1));
      } else process.stdout.write('locked\n');
    } finally { release(); }
  } else if (command === 'crash-write') {
    const { atomicWrite } = await import('./files.js');
    atomicWrite(args[0]!, 'new-complete-value', stage => {
      if (stage === args[1]) { process.stdout.write('paused\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); }
    });
  } else if (command === 'terminal') {
    const { terminal } = await import('./terminal.js'); terminal(args[0]!);
  } else if (command === 'launch-helper') {
    const { helper } = await import('./launchers.js'); helper(args[0]!, args[1]!);
  } else if (command === 'console-probe') {
    const { openSync, closeSync } = await import('node:fs');
    const { ReadStream, WriteStream } = await import('node:tty');
    const input = openSync('\\\\.\\CONIN$', 'r+'), output = openSync('\\\\.\\CONOUT$', 'w');
    const reader = new ReadStream(input), writer = new WriteStream(output);
    reader.setRawMode(true); const raw = reader.isRaw; reader.setRawMode(false);
    writeFileSync(args[0]!, JSON.stringify({ input: reader.isTTY, output: writer.isTTY, raw, restored: !reader.isRaw }));
    reader.destroy(); writer.destroy();
  } else if (command === 'echo') {
    process.stdout.write(JSON.stringify({ args, stdin: readFileSync(0, 'utf8') }) + '\n');
  } else if (command === 'bridge') {
    // Receipt backend used by temporary Mod copies on real official hosts.
    const input = readFileSync(0, 'utf8');
    appendFileSync(args[0]!, JSON.stringify({ command: args[1], input }) + '\n');
    process.stdout.write(JSON.stringify({ protocol_version: 2, ok: true, result: { accepted: 1, backend_version: '0.0.0' } }) + '\n');
  } else if (command === 'wait') { await new Promise(r => setTimeout(r, 60000)); }
  else if (command === 'rss') process.stdout.write(String(process.resourceUsage().maxRSS * 1024));
  else if (command === 'write') writeFileSync(args[0]!, args[1]!);
  else throw new Error('Unknown TS-02 probe command');
} catch (error) { process.stderr.write(String(error) + '\n'); process.exitCode = 1; }
