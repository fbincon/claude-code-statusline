import * as fs from 'node:fs';
import { lock, atomicWrite } from '@fbincon/statusline-platform/files';
import { sample } from '@fbincon/statusline-platform/clocks';
import { encode } from '@fbincon/statusline-core/json';

const [operation, path, action, extra] = process.argv.slice(2);
if (operation === 'clock') process.stdout.write(encode(sample()));
else if (operation === 'echo') {
  process.stdout.write(JSON.stringify({ args: process.argv.slice(3), stdin: fs.readFileSync(0, 'utf8') }));
} else if (operation === 'wait') setTimeout(() => {}, 60_000);
else if (operation === 'lock') {
  const release = lock(path!);
  if (action === 'hold') { process.stdout.write('locked\n'); setTimeout(release, 60_000); }
  else {
    try {
      if (action === 'increment') atomicWrite(extra!, String(Number(fs.readFileSync(extra!, 'utf8')) + 1));
      else process.stdout.write('locked\n');
    } finally { release(); }
  }
} else if (operation === 'crash-write') {
  atomicWrite(path!, 'new-complete-value', point => {
    if (point === action) { fs.writeSync(1, 'ready\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60_000); }
  });
} else throw new Error('Unknown test-only operation');
