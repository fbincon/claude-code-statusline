# Testing and acceptance

**English** | [简体中文](testing.zh-CN.md)

Select validation from the actual change and preserve each result's source/artifact identity. [Impact checks](impact-checks.md) define responsibility classification and local tasks; [CI maintenance](ci-maintenance.md) defines the protected aggregate, evidence expiry and PR/main/tag promotion. Development setup is in the [development guide](README.md).

| Work | Required evidence |
| --- | --- |
| Documentation/templates | Accurate current behavior, bilingual agreement, working links/anchors/navigation, `docs:check` and whitespace checks |
| Images, recordings and demonstrations | Planned media checks plus readable output, matching installed package, input/configuration provenance and reproducible operations; [SHOWCASE-01](showcase.md) records this separately from documentation acceptance |
| Tools, tests, presentation or CI policy | The applicable `ci:plan`/`ci:check` tasks; package-sensitive classification must resolve its comparison |
| Core behavior/runtime dependencies | Complete product checks and the applicable installed/runtime/host matrix |
| Terminal, physical or paid work | Explicitly scoped collection, source-bound reports and actual limitations; paid calls need an approved budget and shared ledger |

Ordinary tests use isolated configuration and installation directories. Follow [candidate acceptance](#candidate-build-and-isolated-installation) for installed-package and host checks. Terminal, physical and paid scenarios have separate entry points. Record PTY reconstruction, operator observations and physical results separately. The six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified.

Current native-capacity rules and applicable host checks are in [capacity and recovery](native-capacity.md). The [delivery index](history/README.md#delivery-records) links feature-specific evidence; counts in those records describe their named versions, not a fresh run against current main.

## Current TypeScript checks

The [CI execution and promotion policy](ci-maintenance.md#candidate-promotion-across-pr-main-and-tag) separates draft feedback, complete candidate acceptance and integration/release verification. A complete core candidate covers 8 installations, 32 Node cases, 16 hosts and all applicable native-capacity cases. Main's three-platform smoke is additional evidence for the original package; it cannot stand in for missing PR acceptance. Tests cover wrong or expired runs/artifacts, duplicate receipts, changed source/tree/base/policy, moved tags, compiler-output provenance and failed/skipped dependencies. Manual diagnostics and local smoke records are not releasable acceptance.

For maintenance, run `npm run ci:plan` and the selected `ci:check` tasks. For core changes, run `npm run check` and the applicable complete product acceptance. [Impact checks](impact-checks.md)
Normal workflows do not launch Python. All 161 frozen cases and the three approved text differences remain; real Node contention, atomic writes, process termination and terminal restoration still run. Missing 2.1.296 declarations are not a typecheck pass. Full D06 measurement belongs to PERF-01; its historical FAIL remains.

Cleanup regressions use isolated temporary directories to verify previews, complete removal, repeated execution, symbolic-link boundaries, and preservation of source and historical records. Before a clean rebuild, use `npm run clean -- --dry-run` and `npm run clean`; see the [development guide](README.md#clean-compiled-outputs) for their scope.

<a id="candidate-build-and-isolated-installation"></a>

### Build and install an isolated candidate

Use the [pinned development toolchain](README.md#prepare-a-development-environment) and select the full commit SHA. Run from the repository root. The output directory must be new.

```bash
SOURCE_COMMIT=$(git rev-parse HEAD)
CHECK_ROOT=$(mktemp -d)
npm run candidate:build -- --commit "$SOURCE_COMMIT" --output "$CHECK_ROOT/candidate"
```

The build exports the selected Git tree, checks its file inventory and blob identities, then builds in two independent directories with locked dependencies and empty npm caches. The two package tarballs must match byte for byte. Build dependencies require network access. Keep the candidate tgz, the source archive, `build-manifest.json` and `SHA256SUMS` together under their generated names. Set `CANDIDATE_TGZ` to the absolute path of the generated candidate package.

```bash
CANDIDATE_TGZ="/absolute/path/to/the/generated-candidate.tgz"
npm run candidate:verify -- --artifact "$CANDIDATE_TGZ" --commit "$SOURCE_COMMIT"
```

The engineering package is `@fbincon/statusline-ts05-candidate` with version `0.0.0-ts05.g<12-character-commit>`. Its application version is recorded separately in `candidate.json`. Use a temporary prefix, empty npm cache and explicit Claude configuration directory for manual checks.

```bash
npm install --prefix "$CHECK_ROOT/prefix" --cache "$CHECK_ROOT/npm-cache" \
  --offline --ignore-scripts --no-audit --no-fund "$CANDIDATE_TGZ"
CANDIDATE_JS="$CHECK_ROOT/prefix/node_modules/@fbincon/statusline-ts05-candidate/bin/claude-statusline.js"
node "$CANDIDATE_JS" --version
node "$CANDIDATE_JS" install --config-dir "$CHECK_ROOT/claude-config" --dry-run
```

In PowerShell, assign absolute paths to the equivalent variables and invoke the installed JavaScript entry with `node`. For integration testing, bind the matching Node executable and JavaScript entry. Inspect pending transactions with `doctor` and `recover --dry-run` against the same test configuration. See [installation and recovery](contracts.md#candidate-installation-and-recovery).

For acceptance, pass the same artifact and commit to each runner, with a fresh report path for each platform and fixed host. Replace the example host path with the selected Claude executable. The installed runner uses an isolated prefix and configuration with lifecycle scripts disabled. Official-host checks record the exact host and the availability of matching declarations.

```bash
npm run test:installed -- --artifact "$CANDIDATE_TGZ" --commit "$SOURCE_COMMIT" \
  --report "$CHECK_ROOT/installed.json"
CLAUDE_HOST="/absolute/path/to/fixed-claude"
npm run test:mods -- --artifact "$CANDIDATE_TGZ" --commit "$SOURCE_COMMIT" \
  --report "$CHECK_ROOT/mods.json" --claude "$CLAUDE_HOST"
```

Use the [source-bound CI rules](ci-maintenance.md#candidate-promotion-across-pr-main-and-tag) for matrix selection and evidence reuse. Record actual checks, platform and runtime identity, package hash, limitations and any intentional skips. A local candidate report provides evidence for its own execution.

### Terminal, physical and paid acceptance

- Run `acceptance:terminal` for explicitly selected interactive scenarios with isolated settings and a source-bound report. Record the operator's observations separately from automated PTY checks. [Terminal runner](../../tools/acceptance/terminal.ts)
- Use `acceptance:power` before and after an actual operator-initiated suspend or reboot. Record the event, host and observed outcome. [Power runner](../../tools/acceptance/power.ts)
- Run paid scenarios only with explicit scope, budget and a shared ledger. The paid runner requires `--run-real-calls` for new model requests. Preserve failed, retried and uncertain calls with their reservations. [Paid runner](../../tools/acceptance/paid.ts)
- Use the separate `reference:verify` procedure to reproduce the historical Python baseline. [Frozen Python archive](../../archive/python/README.md)

### Installed language combinations

The candidate exercises every registered UI/output language pair. Each UI language gets a driver that calls the installed CLI entry function. For each output language the driver checks the bytes before and after preview, applies the original revision, then reopens the saved configuration in a fresh process and renders at 120 columns. One pair per UI language uses real CLI pipes for all six operations. Together those cold pairs cover every UI and output language. With twelve languages the suite checks all 144 pairs with at most 231 candidate Node starts.

Dispatch the CI workflow on the harness branch with `validation=language-comparison`. The default input is built once from the dispatch commit. Select `language_input=v3.16.1` with a compatible harness to reproduce the digest-pinned #198 package. The same package is tested on Linux x64, macOS Intel and a Windows ARM host with x64 Node. Windows runs both the development Node and 22.0.0. Each runner alternates the baseline and current drivers in three pairs and retains all samples, the package and harness identities, launch counts and semantic results. The comparison exercises the installed language case in isolation. Complete platform and release acceptance also require their other scenarios. [Installed acceptance deadlines](ci-maintenance.md#installed-acceptance-deadlines).

## Release approval and CI routing

The release and CI regression suites cover adding a version through data only, migration of all historical registrations, immutable-source registry/decision hashes, invalid or missing approval, and expired/mismatched evidence. Retry ordering also covers smaller IDs on later uploads, missing/tied timestamps and blocking an invalid newest artifact. Isolated Git merge/tag fixtures and mocked Actions archives exercise the production PR → main → tag selectors, original artifact identities and three-smoke aggregation. Approval, build, acceptance and trust-rule edits still change the source-bound policy digest, but equivalent accepted merges reuse the matrix. Tests cover product/generated inputs, new acceptance and screenshot tools, CI observation, release notes, dependencies, workflow/build/validator changes, batch ancestry, rewritten commits, head/base/tree mismatches and latest-run failures. The independent-verifier fixture replaces HEAD validators with no-ops while the frozen base rejects tampered bytes; workflow assertions require this check before restoration/promotion. Original job IDs, names, times and attempts are checked against Actions. Manual full runs and promotion shadow are excluded from release evidence. These fixtures create no repository release/tag and make no network or model calls. `npm run check` includes them; for core changes, the final PR matrix and main three-platform smokes provide real platform acceptance; focused main/tag/npm regressions remain separate from that matrix. See [CI routes](ci-maintenance.md#release-data-and-acceptance-policy).

## Git, terminal and package transactions

Installed acceptance now requires twenty check categories, including Git policy, shared terminal capability, persistent first entry and explicit version management. Windows receipts include fifteen environment cases and nine real shell/entry combinations; environment simulation alone does not establish shell launch acceptance. See [implementation and diagnostic evidence](m8-m9-delivery.md).

Package tests use temporary prefixes and configuration directories, a controlled loopback registry and real npm with lifecycle scripts disabled. They verify the public v3.7.0 archive digest before roundtrips, interruption and separate restoration. `TS06_LEGACY_370_ARTIFACT` may point to an already downloaded copy; the same digest check still applies. Runtime and official-host receipts must include every operation result. These tests do not change the developer's ordinary Claude configuration or make model calls. Current publication requirements are in the [release guide](../RELEASING.md#current-typescript-publication).

The versioned evidence tests reconstruct coverage in temporary Git repositories. They exercise v1 and v2 product sources through maintenance commits, tag verification and the npm evidence reader. Tests change the source epoch, history depth, original attempt and individual stage receipts, and require rejection. A fragment must identify the runner and the package, Node, npm and applicable Claude binaries used for its actual assertions.

Use the branch-only `tiered-probe` dispatch to exercise representative full and short histories, the three Windows ARM sections and fixed-host workers. It uses the same physical worker as automatic acceptance. Inspect each original fragment and its phase timings. A targeted retry retains other sections' identities. The diagnostic aggregate and artifacts are separate from promotable complete evidence.

Use a clean checkout per fixed host when running official Mod diagnostics locally. A previous host can leave ignored declarations under the plugin’s `.claude-plugin/types` directory. Record the exact host and declaration headers before accepting its type or test results. [Measured samples](ci-efficiency.md)

## Installed performance experiments

[PERF-01](performance/perf-01.md) owns the separately identified installed TS-to-TS
method. Use artifact-mode `benchmark`/`benchmark:compare`; the legacy workspace
worker remains descriptive and is not installed-command timing. Counters run
separately from timed samples; cold/append preparation restores the whole usage
index. Linux GNU time records fresh-child peak RSS. Product correctness is the
hard gate; its recorded result does not require a minimum speedup or a Python-budget pass.

## External TUI product regressions

The TUI package owns pure rendering/state regressions without importing the CLI. Tests assert complete separator styling, exact labels and literal values, context-specific key hints, Unicode clipping and pending-edit markers across all registered languages, seven sizes and four color depths. Existing migration-named backend/PTY tests retain their responsibility ledger. Installed captures and delivery evidence are recorded separately in [the external TUI follow-up](external-tui-parity.md); reconstructed cells do not establish human desktop or power acceptance.

## Historical Python and migration-stage records

[Historical acceptance records](history/acceptance-records.md) preserve the original commands, stage conclusions and limitations. The original section links are below.

- <a id="i18n-02-acceptance"></a>See the [original v3.15.0 I18N-02 acceptance scope](history/acceptance-records.md#i18n-02-acceptance).
- <a id="local-checks"></a>[Local checks](history/acceptance-records.md#local-checks)
- <a id="installed-package-checks"></a>[Installed package checks](history/acceptance-records.md#installed-package-checks)
- <a id="real-timer-acceptance"></a>[Real timer acceptance](history/acceptance-records.md#real-timer-acceptance)
- <a id="client-and-external-entry-checks"></a>[Client and external-entry checks](history/acceptance-records.md#client-and-external-entry-checks)
- <a id="display-metric-checks-and-performance"></a>[Display metric checks and performance](history/acceptance-records.md#display-metric-checks-and-performance)
- <a id="phase-4-verification"></a>[Phase 4 verification](history/acceptance-records.md#phase-4-verification)
- <a id="v150a1-candidate-evidence"></a>[v1.5.0a1 candidate evidence](history/acceptance-records.md#v150a1-candidate-evidence)
- <a id="v150-stable-acceptance"></a>[v1.5.0 stable acceptance](history/acceptance-records.md#v150-stable-acceptance)
- <a id="independent-runtime-checks"></a>[Independent runtime checks](history/acceptance-records.md#independent-runtime-checks)
- <a id="phase-5-metric-migration"></a>[Phase 5 metric migration](history/acceptance-records.md#phase-5-metric-migration)
- <a id="real-phase-5-acceptance"></a>[Real Phase 5 acceptance](history/acceptance-records.md#real-phase-5-acceptance)
- <a id="v160-stable-acceptance"></a>[v1.6.0 stable acceptance](history/acceptance-records.md#v160-stable-acceptance)
- <a id="v161-external-tui-grouping-checks"></a>[v1.6.1 external TUI grouping checks](history/acceptance-records.md#v161-external-tui-grouping-checks)
- <a id="task-timing-preview-validation"></a>[Task timing preview validation](history/acceptance-records.md#task-timing-preview-validation)
- <a id="v170-stable-acceptance"></a>[v1.7.0 stable acceptance](history/acceptance-records.md#v170-stable-acceptance)
- <a id="tui-polish-acceptance"></a>[TUI polish acceptance](history/acceptance-records.md#tui-polish-acceptance)
- <a id="client-footer-and-letter-controls"></a>[Client footer and letter controls](history/acceptance-records.md#client-footer-and-letter-controls)
- <a id="native-theme-acceptance"></a>[Native theme acceptance](history/acceptance-records.md#native-theme-acceptance)
- <a id="external-terminal-color-acceptance"></a>[External terminal color acceptance](history/acceptance-records.md#external-terminal-color-acceptance)
- <a id="bilingual-interface-acceptance"></a>[Bilingual interface acceptance](history/acceptance-records.md#bilingual-interface-acceptance)
- <a id="statusline-localization-acceptance"></a>[Statusline localization acceptance](history/acceptance-records.md#statusline-localization-acceptance)
- <a id="discovery-and-import-review-acceptance"></a>[Discovery and import review acceptance](history/acceptance-records.md#discovery-and-import-review-acceptance)
- <a id="representative-rendering-benchmarks"></a>[Representative rendering benchmarks](history/acceptance-records.md#representative-rendering-benchmarks)
- <a id="grapheme-and-preview-style-acceptance"></a>[Grapheme and preview-style acceptance](history/acceptance-records.md#grapheme-and-preview-style-acceptance)
- <a id="appearance-acceptance"></a>[Appearance acceptance](history/acceptance-records.md#appearance-acceptance)
- <a id="component-composition-acceptance"></a>[Component composition acceptance](history/acceptance-records.md#component-composition-acceptance)
- <a id="ts-03-e-rendering-acceptance"></a>[TS-03 E rendering acceptance](history/acceptance-records.md#ts-03-e-rendering-acceptance)
- <a id="ts-04-installed-acceptance"></a>[TS-04 installed acceptance](history/acceptance-records.md#ts-04-installed-acceptance)

[Source and package execution boundaries and additional acceptance](source-command-package-management.md) document protocol 28, separate command approval, retained controls and protected cleanup.
