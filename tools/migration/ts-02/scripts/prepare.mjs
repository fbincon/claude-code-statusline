// Copy only the immutable shared Unicode kernel; never generate another owner.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../src/generated');
mkdirSync(target, { recursive: true });
for (const name of ['unicode.ts', 'generated-unicode.ts']) {
  writeFileSync(resolve(target, name), readFileSync(resolve(root, 'mods/statusline-native/lib', name)));
}
copyFileSync(resolve(root, 'LICENSE'), resolve(target, '../../LICENSE'));
copyFileSync(resolve(root, 'tools/unicode/UNICODE-LICENSE.txt'), resolve(target, '../../LICENSE-Unicode.txt'));
