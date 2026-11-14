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

<a id="known-validation-gaps"></a>

Ordinary tests use isolated configuration and installation directories. Follow [candidate acceptance](#candidate-build-and-isolated-installation) for installed-package and host checks. Terminal, physical and paid scenarios have separate entry points. Record PTY reconstruction, operator observations and physical results separately. The six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified. Historical release decisions, including [v3.1.0](../releases/approvals/v3.1.0.json), retain their original scope; they are not passes for newer packages or exemptions from new failures.

Current native-capacity rules and applicable host checks are in [capacity and recovery](native-capacity.md). The [delivery index](history/README.md#delivery-records) links feature-specific evidence; counts in those records describe their named versions, not a fresh run against current main.

## Current TypeScript checks

The [CI execution and promotion policy](ci-maintenance.md#candidate-promotion-across-pr-main-and-tag) separates draft feedback, complete candidate acceptance and integration/release verification. This page owns the acceptance-matrix counts: a complete core candidate covers 8 installations, 32 Node cases, 16 hosts and all applicable native-capacity cases. Other guides link here instead of restating them. Main's three-platform smoke is additional evidence for the original package; it cannot stand in for missing PR acceptance. Tests cover wrong or expired runs/artifacts, duplicate receipts, changed source/tree/base/policy, moved tags, compiler-output provenance and failed/skipped dependencies. Manual diagnostics and local smoke records are not releasable acceptance.

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

The build exports the selected Git tree, checks its file inventory and blob identities, then builds in two independent directories with locked dependencies and empty npm caches. The two package tarballs must match byte for byte. Build dependencies require network access. Keep the candidate tgz, the source archive, `build-manifest.json` and `SHA256SUMS` together under their generated names. Field-level release asset schemas are in the [release guide](../RELEASING.md#release-asset-schemas). Set `CANDIDATE_TGZ` to the absolute path of the generated candidate package.

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

> **Scope:** The default dispatch input builds the current candidate. `language_input=v3.16.1` only reproduces the historical #198 measurement; current acceptance uses the default input. See the [v3.16.1 delivery record](history/deliveries/runtime-source-save-fixes.md#final-release).

The candidate exercises every registered UI/output language pair. Each UI language gets a driver that calls the installed CLI entry function. For each output language the driver checks the bytes before and after preview, applies the original revision, then reopens the saved configuration in a fresh process and renders at 120 columns. One pair per UI language uses real CLI pipes for all six operations. Together those cold pairs cover every UI and output language. With twelve languages the suite checks all 144 pairs with at most 231 candidate Node starts.

Dispatch the CI workflow on the harness branch with `validation=language-comparison`. The default input is built once from the dispatch commit. Select `language_input=v3.16.1` with a compatible harness to reproduce the digest-pinned #198 package. The same package is tested on Linux x64, macOS Intel and a Windows ARM host with x64 Node. Windows runs both the development Node and 22.0.0. Each runner alternates the baseline and current drivers in three pairs and retains all samples, the package and harness identities, launch counts and semantic results. The comparison exercises the installed language case in isolation. Complete platform and release acceptance also require their other scenarios. [Installed acceptance deadlines](ci-maintenance.md#installed-acceptance-deadlines).

## Release approval and CI routing

The release and CI regression suites cover adding a version through data only, migration of all historical registrations, immutable-source registry/decision hashes, invalid or missing approval, and expired/mismatched evidence. Retry ordering also covers smaller IDs on later uploads, missing/tied timestamps and blocking an invalid newest artifact. Isolated Git merge/tag fixtures and mocked Actions archives exercise the production PR → main → tag selectors, original artifact identities and three-smoke aggregation. Approval, build, acceptance and trust-rule edits still change the source-bound policy digest, but equivalent accepted merges reuse the matrix. Tests cover product/generated inputs, new acceptance and screenshot tools, CI observation, release notes, dependencies, workflow/build/validator changes, batch ancestry, rewritten commits, head/base/tree mismatches and latest-run failures. The independent-verifier fixture replaces HEAD validators with no-ops while the frozen base rejects tampered bytes; workflow assertions require this check before restoration/promotion. Original job IDs, names, times and attempts are checked against Actions. Manual full runs and promotion shadow are excluded from release evidence. These fixtures create no repository release/tag and make no network or model calls. `npm run check` includes them; for core changes, the final PR matrix and main three-platform smokes provide real platform acceptance; focused main/tag/npm regressions remain separate from that matrix. See [CI routes](ci-maintenance.md#release-data-and-acceptance-policy).

## Git, terminal and package transactions

The v3.15.0+ installed-acceptance contract requires 27 check categories (26 for earlier versions), including Git policy, shared terminal capability, persistent first entry, explicit version management and the i18n workflow. Windows receipts include fifteen environment cases and nine real shell/entry combinations; environment simulation alone does not establish shell launch acceptance. See [implementation and diagnostic evidence](history/deliveries/m8-m9-delivery.md).

Package tests use temporary prefixes and configuration directories, a controlled loopback registry and real npm with lifecycle scripts disabled. They verify the public v3.7.0 archive digest before roundtrips, interruption and separate restoration. `TS06_LEGACY_370_ARTIFACT` may point to an already downloaded copy; the same digest check still applies. Runtime and official-host receipts must include every operation result. These tests do not change the developer's ordinary Claude configuration or make model calls. Current publication requirements are in the [release guide](../RELEASING.md#current-typescript-publication).

The versioned evidence tests reconstruct coverage in temporary Git repositories. They exercise v1 and v2 product sources through maintenance commits, tag verification and the npm evidence reader. Tests change the source epoch, history depth, original attempt and individual stage receipts, and require rejection. A fragment must identify the runner and the package, Node, npm and applicable Claude binaries used for its actual assertions.

Use the branch-only `tiered-probe` dispatch to exercise representative full and short histories, the three Windows ARM sections and fixed-host workers. It uses the same physical worker as automatic acceptance. Inspect each original fragment and its phase timings. A targeted retry retains other sections' identities. The diagnostic aggregate and artifacts are separate from promotable complete evidence.

Use a clean checkout per fixed host when running official Mod diagnostics locally. A previous host can leave ignored declarations under the plugin’s `.claude-plugin/types` directory. Record the exact host and declaration headers before accepting its type or test results. [Measured samples](ci-efficiency.md)

<a id="acceptance-receipt-envelope"></a>

## Acceptance receipts

Promotable, CI-bound evidence may carry the shared acceptance envelope. The envelope is additive: existing formats such as `ci-fragment` schema 2, `impact-product` schema 1 and release bindings remain authoritative and are not wrapped or replaced. Local diagnostics and draft reports may keep their own formats and must not be promoted.

```json
{
  "schema_version": 1,
  "kind": "acceptance-envelope",
  "status": "pass",
  "producer": { "kind": "showcase fixed samples" },
  "source": { "commit": "<40-hex>", "files_sha256": "<64-hex>", "tree": "<40-hex>" },
  "artifact": { "sha256": "<64-hex>", "filename": "...", "version": "..." },
  "runtime": { "node": "...", "node_sha256": "<64-hex>", "platform": "...", "arch": "...", "os_release": "...", "host": null },
  "checks": [{ "name": "...", "status": "pass", "detail": "..." }],
  "limitations": ["..."]
}
```

`source.commit` and `source.files_sha256` identify the accepted source; `tree` is optional. `artifact` may be `null` when no packaged artifact exists. `checks` must be non-empty, use unique names, use `pass` or `skip` statuses and include at least one `pass`. Each `limitations` entry must be non-empty, and the array must contain at least one entry. Unknown extension keys are allowed, and `produced_at` is optional.

`createAcceptanceEnvelope` and `validateAcceptanceEnvelope` live in `tools/checks/receipt.ts`. The `showcase` and `editor-capture` acceptance scripts are the current exemplars: their existing top-level receipts are unchanged and carry the envelope as an additive field. `official-tests` remains a CI-bound receipt with its own schema and validators; adopting the envelope there is a later additive change with a compatibility test.

<a id="acceptance-receipt-producers"></a>

## Acceptance receipt producers

Every non-test top-level TypeScript module under `tools/acceptance` has one registered role. The authoritative registry is the `ACCEPTANCE_PRODUCERS` constant in `tools/checks/acceptance-producers.ts`; the two tables below are checked projections. A new, removed or reclassified module must update the constant and both language tables in one change.

A new or changed release-promotable producer must add the nested `AcceptanceEnvelope` from [Acceptance receipts](#acceptance-receipt-envelope) to its successful report. Fail, diagnostic, manual, paid and physical paths must not carry a pass envelope; demonstration producers may carry it only when their registry entry is `adopted`, as `showcase` and `editor-capture` do. Existing `planned` entries are grandfathered until their next substantive change; new producers cannot use `planned`. `physical` remains `blocked-reader-first` until the promotion readers accept a new fragment schema. Deliberate reclassifications that change a fixed exception must also update `validateKnownExceptions` and, for `planned`, `PLANNED_ALLOWED`.

The strict CI evidence formats remain authoritative and are outside this registry: `ci-fragment` schema 2 exact top-level keys and exact `PhysicalIdentity`, `ci-section-evidence` exact report sections, release and evidence exact receipt sets, the `official-tests` schema embedded in `mods.json`, the `integration-smoke` schema 1 report and the legacy `runtime.json` readers. The registry classifies source files only; it does not duplicate coverage-plan obligations, producer or job identities, receipt file sets or release bindings.

Roles: `producer` owns a primary receipt; `diagnostic` writes a non-promotable diagnostic report; `helper` provides shared in-memory logic; `wrapper` adapts a process or section; `driver` prepares fixtures or capture data.

Evidence classes: `complete-acceptance` is full PR candidate evidence; `additional-smoke` is integration or release smoke that is not complete PR acceptance; `official-host` is fixed-host evidence; `demonstration` is documentation or demo evidence; `diagnostic` is non-promotable diagnostics; `manual`, `paid` and `physical` are operator, paid and physical evidence; `legacy` is legacy v1 evidence; `none` means no acceptance evidence.

Envelope statuses: `adopted` emits the nested envelope; `planned` is a grandfathered promotable producer not yet adopted; `embedded-via-parent` is an in-memory receipt persisted by a parent; `blocked-reader-first` is blocked by an exact-key reader; `diagnostic-opt-out`, `manual-opt-out` and `not-applicable` are explicit non-adoption states.

Validation paths: `ci` is a CI matrix or worker; `official-host` is a fixed official host; `local` is a local or offline run; `manual` is a manual or PTY capture; `paid` is a paid run; `physical` is operator physical evidence; `none` means no acceptance output.

Primary outputs are stable identifiers for the persisted receipt or report; logs, fixtures and media are not enumerated.

The registry is blocking: `npm run docs:check` and `npm run check` fail on drift, and `tools/acceptance/test/acceptance-producers.test.ts` covers the acceptance-family scoped route. Keep the machine columns identical in both languages; `Notes` may be translated. Do not use `|` inside a table cell.

<!-- acceptance-producers:start -->
| File | Role | Primary outputs | Promotable | Evidence class | Envelope | Validation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `artifact.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | In-memory artifact identity binder; no acceptance receipt. |
| `budget.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Paid-call ledger reserve and settle helper; not an acceptance receipt. |
| `budgets.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Deadline and phase budget constants. |
| `diagnostics.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Bounded sanitized log writer. |
| `editor-capture.ts` | `producer` | `editor-capture.json` | no | `demonstration` | `adopted` | `manual` | Manual PTY editor-cell reconstruction; nested envelope; demonstration only. |
| `editor-shells.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Windows editor shell command and environment builders. |
| `first-entry.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Child-program first-entry journey helper. |
| `fixture-processes.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Process ownership and termination helpers. |
| `git-policy.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Child-program Git policy helper. |
| `historical-inputs.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Checksum-pinned historical tarball preparation; CI input, not a receipt. |
| `historical-releases.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Archived release digest registry. |
| `install.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Isolated installation fixture. |
| `installed-admission.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Installed budget admission helper. |
| `installed-case.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Installed node:test case registration. |
| `installed-commands.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Installed command fixtures. |
| `installed-language-process.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Fork and IPC worker supervisor. |
| `installed-language-worker.ts` | `wrapper` | none | no | `none` | `not-applicable` | `none` | Copied installed-language worker. |
| `installed-language.ts` | `diagnostic` | `installed-language-sample` | no | `diagnostic` | `diagnostic-opt-out` | `ci` | Optional non-promotable language journey report. |
| `installed-plan.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Installed phase and selection plan. |
| `installed-supervisor.ts` | `diagnostic` | `events.jsonl` | no | `diagnostic` | `diagnostic-opt-out` | `local` | Watchdog and supervisor; writes promotable:false phase events. |
| `installed.ts` | `producer` | `installed.json` | yes | `complete-acceptance` | `planned` | `ci` | Normal mode promotable; diagnostic-pattern mode writes fail and is non-promotable. |
| `integration-smoke.ts` | `producer` | `smoke.json` | yes | `additional-smoke` | `planned` | `ci` | Required additional three-platform smoke; not complete PR acceptance. |
| `language-budget.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Language deadlines and admission. |
| `language-comparison.ts` | `diagnostic` | `installed-language-comparison` | no | `diagnostic` | `diagnostic-opt-out` | `ci` | CI language diagnostic; promotable:false. |
| `mod-types.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Host declaration preparation; writes metadata, not a receipt. |
| `mods.ts` | `producer` | `mods.json` | yes | `official-host` | `planned` | `official-host` | v1 mods evidence and v2 official-host sections. |
| `native-capacity-pty.ts` | `producer` | `pty-reports` | no | `manual` | `manual-opt-out` | `manual` | Manual PTY capacity capture; documentation evidence. |
| `native-capacity.ts` | `producer` | `mods.json:capacity` | yes | `official-host` | `embedded-via-parent` | `official-host` | In-memory capacity receipt persisted in mods.json. |
| `native-stability.ts` | `producer` | `native-stability.json` | yes | `official-host` | `embedded-via-parent` | `official-host` | Transient stability report embedded in the physical fragment. |
| `official-tests.ts` | `producer` | `mods.json:official_tests` | yes | `official-host` | `embedded-via-parent` | `official-host` | In-memory official-test batches persisted in mods.json; its own schema remains authoritative. |
| `paid-evidence.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Paid evidence validators. |
| `paid.ts` | `producer` | `paid-ledger` | no | `paid` | `manual-opt-out` | `paid` | Operator paid acceptance; requires budget and shared ledger. |
| `phase-budget.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | In-memory phase receipt builder. |
| `physical-budgets.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Physical budget calculations and preflight. |
| `physical-sections.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | In-memory section orchestrator; persists through physical.ts. |
| `physical.ts` | `producer` | `fragment.json` | yes | `complete-acceptance` | `blocked-reader-first` | `physical` | Exact-key fragment; reader-first schema migration required before envelope adoption. |
| `power-evidence.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | OS power evidence validators. |
| `power.ts` | `producer` | `power-observation` | no | `physical` | `manual-opt-out` | `physical` | Operator suspend/reboot evidence; cannot be automated. |
| `render-capture.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | PNG and JSON capture sidecar; not an acceptance receipt. |
| `runtime-shared.ts` | `producer` | `runtime.json` | no | `legacy` | `not-applicable` | `local` | Legacy v1 shared-runtime producer; no in-repo caller; runtime.json still accepted by legacy readers. |
| `runtime.ts` | `producer` | `runtime.json` | no | `legacy` | `not-applicable` | `local` | Legacy v1 runtime producer; no in-repo caller; runtime.json still accepted by legacy readers. |
| `scoped-test-files.ts` | `wrapper` | none | no | `none` | `not-applicable` | `none` | Scoped test-file worker inside the supervisor. |
| `setup-appearance-capture.ts` | `producer` | `samples.json` | no | `manual` | `manual-opt-out` | `manual` | Manual setup and appearance capture; documentation evidence. |
| `setup-appearance-driver.ts` | `driver` | none | no | `none` | `not-applicable` | `none` | Installed-renderer sample driver; writes fixtures, not a receipt. |
| `short-history.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Short-history observer. |
| `showcase-driver.ts` | `driver` | none | no | `none` | `not-applicable` | `none` | Showcase sample-data driver; writes fixture data, not a receipt. |
| `showcase-journeys.ts` | `producer` | `journey-receipt.json` | no | `manual` | `manual-opt-out` | `local` | Manual journey recording; may persist in-progress and failed states. |
| `showcase-operations.ts` | `producer` | `summary.json` | no | `manual` | `manual-opt-out` | `manual` | Manual operations walkthrough; writes a failure summary when the run fails. |
| `showcase-paid.ts` | `producer` | `receipt.json` | no | `paid` | `manual-opt-out` | `paid` | Paid showcase capture; never runs in CI. |
| `showcase-replay.ts` | `producer` | `replay-receipt.json` | no | `manual` | `manual-opt-out` | `local` | Offline replay; pass-only result written at the end. |
| `showcase.ts` | `producer` | `receipt.json` | no | `demonstration` | `adopted` | `manual` | Fixed-sample demonstration; nested envelope; not CI or release evidence. |
| `supervised-node.ts` | `wrapper` | none | no | `none` | `not-applicable` | `none` | stdout and stderr file-tail process wrapper. |
| `task-fixture.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Task-store fixture writer. |
| `task-input-pty.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | PTY task-input journey. |
| `terminal-evidence.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | Terminal evidence assessor. |
| `terminal.ts` | `producer` | `interaction.json` | no | `physical` | `manual-opt-out` | `physical` | Operator real-terminal evidence; cannot be automated. |
| `trace-process.ts` | `wrapper` | none | no | `none` | `not-applicable` | `none` | Optional diagnostics preload. |
| `version-management-official.ts` | `producer` | `version-history` | yes | `official-host` | `embedded-via-parent` | `official-host` | Transient history and version report embedded in the physical fragment. |
| `version-management.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | In-memory version and history builder; temporary traces only. |
| `windows-shell.ts` | `helper` | none | no | `none` | `not-applicable` | `none` | In-memory PowerShell readiness receipt. |
<!-- acceptance-producers:end -->

## Installed performance experiments

[PERF-01](history/performance/perf-01.md) owns the separately identified installed TS-to-TS
method. Use artifact-mode `benchmark`/`benchmark:compare`; the legacy workspace
worker remains descriptive and is not installed-command timing. Counters run
separately from timed samples; cold/append preparation restores the whole usage
index. Linux GNU time records fresh-child peak RSS. Product correctness is the
hard gate; its recorded result does not require a minimum speedup or a Python-budget pass.

### Future performance reports

New performance reports use this structure. The five historical reports linked from the [performance index](history/README.md#performance-reports) remain frozen; do not rewrite them.

```markdown
# <Report title>

- **Status:** proposed, running, completed or failed.
- **Baseline source:** exact source commit/tree and the accepted baseline identity.
- **Artifact identity:** package and source hashes, Node/runtime and host identity.
- **Method:** benchmark command, scenario, sample count and warm/cold preparation; link PERF-01 for the installed method.
- **Results:** separate timed samples from counters; record actual values and the raw report path.
- **Limits:** missing hosts, skipped cases, measurement uncertainty and non-comparable data.
```

## External TUI product regressions

The TUI package owns pure rendering/state regressions without importing the CLI. Tests assert complete separator styling, exact labels and literal values, context-specific key hints, Unicode clipping and pending-edit markers across all registered languages, seven sizes and four color depths. Existing migration-named backend/PTY tests retain their responsibility ledger. Current protocol and save boundaries are in [transport and response envelopes](contracts.md#transport-and-response-envelopes) and [revision and transactions](contracts.md#revision-and-transactions); installed captures and delivery evidence are preserved in the [external TUI parity](history/migration/external-tui-parity.md) and [regression](history/migration/external-tui-regressions.md) records. Reconstructed cells do not establish human desktop or power acceptance.

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

The v3.12.0 source and package checks cover independent command approval, retained controls and protected cleanup. [Acceptance and delivery](source-command-package-management.md#acceptance-and-delivery).
