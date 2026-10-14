import { readFileSync, writeFileSync } from 'node:fs';
import { decode, encode } from '@fbincon/statusline-core/json';
import { handlers, runCase, type Case } from './scenarios.js';

const fixture = decode(readFileSync(process.argv[2]!, 'utf8')) as Case;
const handler = handlers[fixture.kind];
if (!handler) throw new Error(`Unimplemented case kind: ${fixture.kind}`);
writeFileSync(process.argv[3]!, encode(await runCase(fixture, handler)) + '\n');
