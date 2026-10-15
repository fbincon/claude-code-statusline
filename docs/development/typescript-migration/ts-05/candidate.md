# Build and accept the engineering candidate

**English** | [简体中文](candidate.zh-CN.md)

Use Node **24.21.0**, npm **11.19.0** and the locked TypeScript **5.9.3**.
Ordinary development, generation, tests, documentation and candidate builds need
no Python or native compiler. Four business packages remain independent; the
test-support workspace and maintenance tools are development dependencies only.

## Development

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run docs:check
npm run generate:check
```

`check` includes real native child processes, contention, killed writers, atomic
publication, terminal recovery, all 161 frozen cases and complete responsibility
ledgers. Three tightly hash-bound CLI text differences remain approved. Tests
report platform skips explicitly. Use `npm run generate` after changing shared
resources; it never updates the Python archive.

## Fixed-source build

```bash
SOURCE_COMMIT=$(git rev-parse HEAD)
npm run candidate:build -- --commit "$SOURCE_COMMIT" --output /absolute/new-candidate
```

The full SHA selects tracked source bytes, independently of local edits. Two
temporary exports each use their own initially empty npm cache, `npm ci
--ignore-scripts`, compilation and generated-resource checks. Only identical tgz
bytes pass. Network access is required for locked build dependencies; installation
of the resulting artifact is offline. No model calls occur.

The private package is `@fbincon/statusline-ts05-candidate`, version
`0.0.0-ts05.g<12-character-commit>`. Its application identity remains separate in
`candidate.json`; it does not allocate a public version. npm
[bundleDependencies](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bundledependencies)
includes the four business packages, lossless-json 4.3.1, Koffi 3.3.3 and the four
locked Koffi prebuilds: Linux x64, Windows x64, macOS x64 and macOS ARM64.
Windows ARM uses the x64 Node process under emulation. Other targets are not
claimed. Both Mods, five languages, skill templates, resource ownership maps and
licenses are included; tests, archive, host declarations, compilers, development
caches and private reports are excluded.

Outputs are the universal candidate tgz, `statusline-ts05-source-<sha>.tgz`,
`SHA256SUMS` and `build-manifest.json`. Build logs and `build-report.json` hold
timestamps and machine paths outside the deterministic package. The source tgz
contains the tracked source and a hash-bound `.candidate-source.json`, including
the frozen archive. It can rebuild without Git history:

```bash
# Extract the source tgz, enter statusline-source, then install pinned build dependencies.
npm ci --ignore-scripts --no-audit --no-fund
npm run candidate:build -- --commit FULL_SHA --source /absolute/source.tgz --output /absolute/new-rebuild
```

## Isolated installation and acceptance

Keep the candidate, source archive, `build-manifest.json` and `SHA256SUMS` together
under their generated filenames. Replace `candidate.tgz` below with the actual
generated filename; full verification checks the complete delivery bundle.
Every target uses the identical artifact:

```bash
npm run candidate:verify -- --artifact /absolute/candidate.tgz --commit FULL_SHA
npm run test:installed -- --artifact /absolute/candidate.tgz --commit FULL_SHA --report /absolute/installed.json
npm run test:mods -- --artifact /absolute/candidate.tgz --commit FULL_SHA --report /absolute/mods.json --claude /absolute/fixed-host
```

The installer copies Node outside the checkout and restricts PATH to that copy.
It creates an empty cache and runs npm with `--offline --ignore-scripts`.
Acceptance covers both editors, special-character paths, old owned Python entry
upgrades, relocation, reinstall, explicit disablement, interrupted writes,
recovery, uninstall and compatible before-image backups. The installed Python
product and real Claude settings are untouched. Installed evidence binds source,
lock, runtime, native dependencies and tgz digests.

Windows first performs a separately reported, 60-second-bounded system PowerShell
readiness check. It loads only OS modules/providers and their text formatter; it
does not execute Node, the candidate or acceptance input. Fresh ARM runners can
exceed 20 seconds before PowerShell's first script statement. Every subsequent
application/shell acceptance call retains the original 20-second bound, starts a
new process and must pass without retries. Failed/missing preparation is not a pass.

For a manual temporary installation, run `npm install --prefix /absolute/test-prefix
--cache /absolute/empty-cache --offline --ignore-scripts --no-audit --no-fund
/absolute/candidate.tgz`, then invoke `node
/absolute/test-prefix/node_modules/@fbincon/statusline-ts05-candidate/bin/claude-statusline.js`
with an explicit `--config-dir /absolute/test-config` on management commands.
Use absolute Node/JS argv for host binding. The npm `.cmd` wrapper retains its
Windows limitations; PowerShell `.ps1`, Git Bash and direct Node invocation are
separate acceptance paths.

`doctor` diagnoses pending transactions; `recover --dry-run` inspects and
`recover` explicitly reconciles them. Preserve compatible backups and the old
Python environment when testing upgrades. See the unchanged
[recovery protocol](../ts-04/recovery.md). Do not replace arbitrary backups or
foreign settings. Display schema 8, editor protocol 11, runtime protocol 2/v1 and
task schema 4 remain compatible.

## CI evidence and handoff

CI builds once, then downloads the same package for eight platform targets and
thirteen fixed Claude host combinations. `release:prepare` requires every
receipt and rejects missing, failed, skipped, duplicated or differently sourced
results. Claude 2.1.296 has no usable exact-host declarations; that is recorded
as unavailable, never a typecheck pass. Earlier supported hosts retain type
checks; the runtime Mod starts at 2.1.289.

TS-05 stores engineering artifacts only. Public preview versions, tags, registry
publication, Releases and final installed-product cutover belong to TS-06.
Real suspend, Windows 10, macOS 14 Intel and WSL desktop acceptance remain TS-06
requirements. D06's historical FAIL is retained; PERF-01 measurement/optimization
follows TS-06 and is not a candidate gate.

## Historical reference and optional tools

`archive/python/manifest.json` maps original paths and hashes. The manual entry
reconstructs the fixed historical checkout, verifies all 318 archived Python
sources, replays 161 reference cases, runs the archived Python suite, independently
recaptures twelve oracle files, and exercises mixed Python/Node locks and rollback:

```bash
# Supply Python 3.14.4; the runner creates its own temporary installed environment.
npm run reference:verify -- --python /absolute/reference-python --report /absolute/new-reference.json
```

The runner creates a private venv, installs hash-locked dependencies from
[reference-requirements.txt](../../../../tools/migration/ts-05/reference-requirements.txt)
and installs the frozen package there. This requires network access to PyPI and
does not rely on or modify an existing `claude-statusline` installation. Evidence
records the console entry and dependency hashes. It never refreshes goldens or
modifies archive bytes. Historical Python publication
workflows are archived; only `reference.yml` can run Python and only by manual
dispatch. Original phase conclusions and sources remain recorded.

Use `benchmark -- --validate --output NEW_DIRECTORY` for functional fixtures;
descriptive measurement and `benchmark:compare` are opt-in and do not claim D06
success. `acceptance:power` records operator-initiated power events;
`acceptance:terminal` opens operator-driven checks. `capture:render` reconstructs
captured cells with explicit fonts and provenance; it is not an OS screenshot.

`acceptance:paid` defaults to revalidating existing private records. New model
calls additionally need `--run-real-calls`, the existing shared USD 10 ledger,
a cap, a new directory, an installed JS entry and pinned 2.1.296 executable.
Install its optional SDK only with `npm ci --prefix tools/acceptance --ignore-scripts`.
Unknown costs retain the full reservation and block another call. TS-05 uses
existing records and mock tests, not new paid sessions or human/physical claims.
