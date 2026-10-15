/** Inherited by test child processes; accidental interpreter/compiler calls fail loudly. */
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const forbidden = /^(?:python(?:\d+(?:\.\d+)*)?|py|pip(?:\d+)?|pipx|gcc|g\+\+|clang(?:\+\+)?|cl|cc)(?:\.exe|\.cmd)?$/iu;
for (const name of ['spawn','spawnSync','execFile','execFileSync']) {
  const original = cp[name];
  cp[name] = function(executable,...args) {
    const base=String(executable).replaceAll('\\','/').split('/').at(-1);
    if (forbidden.test(base)) throw new Error('Python-free validation rejected '+base);
    return original.call(this,executable,...args);
  };
}
syncBuiltinESMExports();
