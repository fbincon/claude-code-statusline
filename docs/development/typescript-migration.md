# TypeScript migration plan and progress

**English** | [简体中文](typescript-migration.zh-CN.md)

Updated: **2026-10-15** (Asia/Shanghai). Reference implementation: **v2.0.0**, commit `9b6d2fab4bf165be280d428a874521bfbf02c7e1`.

Migrate the Python implementation to TypeScript while retaining the statusline's behavior, existing user configuration and supported workflows. This plan records scope, dependencies, decisions, acceptance gates and handoffs for later sessions and maintainers. Both language versions belong in the repository; private machine records and raw acceptance data remain outside tracked documentation.

## Current decision, 2026-10-15

Complete TS-01–TS-06 before further performance optimization. The maintainer approved the [D06 applicability amendment](typescript-migration/ts-02/D06.md#applicability-amendment-2026-10-15): full D06 measurement and passing performance budgets no longer block TS-03–TS-06, including preview and stable delivery. The independent [PERF-01](performance/perf-01.md) follows TS-06 and remains **NOT_STARTED**.

**TS-03/03-F are DONE under the revised non-performance criteria.** The latest D06 measurement remains **FAIL: 104 pass / 60 fail / 28 inconclusive**. Preserve the [two-round review](typescript-migration/ts-03/PERFORMANCE-OPTIMIZATION.md), numerical policy and all original evidence; a changed stage gate does not turn a failed measurement into a pass.

Relative latency/RSS regression may be deferred. Functional or stability failures, including operations prevented by host timeouts, lost events, failed saves or memory exhaustion, remain actionable. Existing timeout, bounded-resource, locking, atomic-write, clock-precision and collector-count contracts, and physical/desktop and installation/recovery acceptance remain required.

## Current state

| Item | State |
| --- | --- |
| Feasibility review | Completed by source, test-structure and workflow inspection |
| Planning documentation | Established; documentation validation is recorded in the activity log |
| Implementation | **TS-01–TS-03 DONE**; TS-03 closes on existing [functional and CI evidence](typescript-migration/ts-03/README.md#closure-2026-10-15) under the revised criteria |
| Current task scope | TS-04 IN_PROGRESS: both editors, installation and explicit recovery; TS-05/TS-06 and PERF-01 remain NOT_STARTED |
| Runtime and distribution | Node 24.21.0/npm/64-bit selected; D01–D06 DECIDED; explicit [release-before checks](typescript-migration/ts-02/LINUX-20261014.md#approved-stage-and-release-gates) remain |
| Target release and schedule | Unassigned; later candidate/delivery tasks determine versions and schedule |
| Next implementation work | [04-C installation validation](typescript-migration/ts-04/README.md), followed by installation/recovery |

The maintainer approved TS-04 implementation with isolated installation acceptance and explicit recovery. Keep the installed Python product intact. The [TS-04 record](typescript-migration/ts-04/README.md) tracks five implementation batches; this stage creates no release. Existing repository authorization governs commits, PRs, merging and task-driven Gitee synchronization.

TS-03 covers all 161 fixed cases with the same three approved CLI text differences and audits all 516 IDs: 471 ported, 45 complete tests assigned to TS-04, plus remaining assertions in eight mixed tests. Latest local TS validation passed 556/557 tests with one platform skip; the final [PR #85](https://github.com/fbincon/claude-code-statusline/pull/85) head passed all 43 CI jobs and eight source-bound receipts before merge `7eae7c4`. These are existing implementation results, not tests newly run by this planning change. [Closure and evidence](typescript-migration/ts-03/README.md#closure-2026-10-15).

## Baseline and scope

The initial inventory counts Git-tracked files at the reference commit. Physical lines include comments and blank lines; test method counts are static definitions, not a new test-run result.

| Area | Files | Physical lines or tests |
| --- | ---: | ---: |
| Python under `src`, including the build entry | 153 | 28,429 lines, including 1,946 generated lines |
| Python under `tests`, including helpers | 96 | 20,388 lines; 815 test method definitions |
| Python under `tools` | 42 | 9,921 lines |
| TypeScript under `mods`, including tests | 70 | 18,413 lines, including 11,208 generated lines |

The existing TypeScript includes 4,196 handwritten production lines. Its editor logic, translation data, Unicode implementation and observation queues provide reusable components; generated types and fixtures are not completed backend migration work.

The behavioral baseline is the [architecture](architecture.md), [configuration contracts](contracts.md), [rendering contracts](rendering.md), [task timing](timer.md), [runtime observations](live.md), [CLI reference](../reference/cli.md) and [v2.0.0 release record](../releases/v2.0.0.md). Historical release checks are supporting evidence, not new TypeScript acceptance.

| Contract | Baseline |
| --- | --- |
| Display configuration | Schema 8; display versions 1–7 migrate in memory before an explicit save |
| Editor backend | Protocol 11 |
| Runtime observations | Protocol 2, with existing version-1 compatibility |
| Task lifecycle | Schema 4, with existing historical reads and frozen values |
| Other persistent formats | Portable envelope 1, UI preferences 1, feature settings 1, runtime preferences 2 |
| Display catalog | 62 main types and 16 subagent types, including text and spacer in each scope |
| Languages | `en`, `zh-CN`, `zh-Hant`, `ja`, `ko` for independent UI and output selection |

The intended scope covers production Python, external TUI and platform helpers, CLI/install/doctor/uninstall, both Mod integrations, generation scripts, maintained tests, benchmark tooling, acceptance tools, packaging, CI and developer/user documentation. Migrate or retire obsolete Python-only tools with a recorded replacement or reason. Completion requires that normal supported runtime, build, test and release workflows no longer depend on Python. Preserve the frozen Python oracle, fixtures and historical comparison harness/provenance in an isolated archival environment outside those workflows for PERF-01; retain coverage when replacing active Python-backed tests. Performance optimization and final full-product measurement are outside migration completion.

Feature additions, visual redesign, new metric meanings, a persistent daemon and new platform support are outside the initial migration. Existing Python import APIs, `python -m` entry points and pipx installation need an explicit retirement/transition decision under D05. Preserve user-facing capabilities; do not silently narrow platform support or lose user data to simplify implementation.

## Compatibility requirements

1. Preserve public CLI operations, documented options, environment variables, stdout/stderr separation and exit behavior. Keep text output for `render`, `id`/`content` NDJSON for `render-subagents`, and structured editor/runtime responses. Invalid renderer/hook input retains its existing quiet failure behavior.
2. Preserve display instances, IDs, layout references, disabled overrides, language and explicit opt-outs. Reads, previews, import review and dry runs must not rewrite configuration. Keep UI language, display language, tool configuration and Claude preferences independent.
3. Preserve strict runtime validation of untrusted JSON. TypeScript types do not replace input validation. Keep error codes, unknown/null/zero distinctions, source attribution, conflict checks and unrelated Claude settings.
4. Preserve atomic publication, backups, rollback, private file handling and lock-protected transactions. Define compatible locking or a verified exclusive cutover before different implementations can access the same mutable store.
5. Preserve task ownership, Stop candidates, continuation, overlapping waits, Agent report delivery, deduplication, incomplete evidence and frozen outcomes. Native turn duration must not overwrite total task duration.
6. Preserve suspend-aware, reboot-aware timing and lossless persisted integers. Do not round existing nanosecond fields through JavaScript `number` before converting to `bigint`. Any new disk representation requires versioned reading, migration and recovery tests.
7. Preserve fixed Unicode/grapheme width behavior, ANSI reset/background rules, layout and per-instance formatting. Repeated metrics share raw observations and must not add transcript/Git reads or duplicate usage totals.
8. Preserve both editors and the separation of host Apply from tool Save. Keep Mod host calls in their supported entry points; shared browser/Client code must not acquire Node filesystem/process dependencies.
9. Keep rendering and passive observations local. Retain current opt-in and capability rules and the documented macOS Client input limitation until new evidence supports a change.

A language change alone does not require a schema bump. If semantics or representation must change, record the affected contract, transition, compatibility window and rollback in a decision before switching writers.

## Proposed architecture

Use one TypeScript business core for configuration validation, catalog/form definitions, rendering and lifecycle rules. Keep filesystem, clocks, process identity, terminal I/O and host APIs behind explicit adapters. The CLI and the two existing Mods remain separate entry points with only compatible pure modules shared between them.

D01–D06 select Node 24.21.0/npm, compiled ESM, node:test, Koffi/strict lossless JSON and raw TTY/VT. The future workspace separates core, platform, CLI and TUI packages. Independent executables are optional; TS-02 created no production scaffold.

Keep render/hook entry points small and exclude editor resources from their eager imports. Move canonical rules to TypeScript/shared data as each subsystem migrates, with deterministic generated resources and drift checks. Retain the Python reference separately for comparisons instead of maintaining two evolving sources of truth.

## Decisions and technical risks

Decision states are `OPEN`, `DECIDED` or `SUPERSEDED`. A decided row must link a record of the chosen option, alternatives, consequences, recovery behavior and implementation/probe evidence.

| ID | State | Decision | Required evidence | Needed by |
| --- | --- | --- | --- | --- |
| [D01](typescript-migration/ts-02/D01.md) | DECIDED | Runtime, minimum version, package/tooling layout and optional standalone builds | Supported OS/architecture matrix, small render startup/RSS measurements, dependency and asset loading, both Mod validation paths | TS-02 |
| [D02](typescript-migration/ts-02/D02.md) | DECIDED | Clock APIs, boot/process identities and lossless integer encoding | Sleep/resume, wall-clock adjustment, reboot, process reuse and unavailable API cases; old JSON reads and frozen values; native dependency packaging if required | TS-02 |
| [D03](typescript-migration/ts-02/D03.md) | DECIDED | Cross-process locks and durable writes | Concurrent updates, process death, Windows sharing violations, temporary-file cleanup, symlink/reparse handling and mixed-version cutover | TS-02 |
| [D04](typescript-migration/ts-02/D04.md) | DECIDED | External TUI input/output and terminal launching | Raw keys including Ctrl+S, resize, terminal restoration, Unicode cells, tmux, Windows console and macOS Terminal helper probes | TS-02 |
| [D05](typescript-migration/ts-02/D05.md) | DECIDED | Installation, old-entry retirement, upgrade and rollback | Existing pipx/PATH detection, Windows executable or argv strategy, ownership, plugin/backend binding, opt-out preservation and compatible-backup recovery | Strategy in TS-02; complete in TS-04 |
| [D06](typescript-migration/ts-02/D06.md) | DECIDED; applicability amended 2026-10-15 | Preserved performance measurement policy and targets | Frozen `3c448b8` policy and historical results unchanged; final-product measurement/optimization belongs to PERF-01 and does not block migration or release | Policy fixed in TS-02; PERF-01 after TS-06 |

The highest-risk source boundaries are [platform clocks](../../src/claude_statusline/platforms/clocks.py), [file locking/publication](../../src/claude_statusline/platforms/files.py), [serialized timers](../../src/claude_statusline/runtime/timing/clock.py), [submission byte cursors](../../src/claude_statusline/runtime/tasks/evidence.py), [semantic revisions](../../src/claude_statusline/config/revisions.py), [CLI ownership](../../src/claude_statusline/integration/ownership.py) and [external terminal handling](../../src/claude_statusline/ui/terminal.py).

In particular, UTF-8 byte offsets are not JavaScript string lengths; canonical revision hashing needs explicit serialization rules; `.cmd` launchers do not automatically preserve the current Windows `.exe` contract. Check runtime behavior against the [Node process-launch documentation](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows). If evaluating standalone delivery, verify the actual targets and asset behavior in the [Node SEA](https://nodejs.org/api/single-executable-applications.html) or [Bun executable](https://bun.sh/docs/bundler/executables) documentation for the selected version.

## Stages and progress

Use `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `VALIDATING` and `DONE` as stage states. `DONE` requires all currently applicable exit criteria and evidence. Migration status and measured performance status are independent under the D06 amendment. `BLOCKED` records a concrete missing dependency and the action that resolves it. Record the active worker/chat, branch, commit and PR when work begins; leave them unassigned beforehand.

| Stage | Deliverable | Depends on | State | Owner and evidence |
| --- | --- | --- | --- | --- |
| TS-01 | Frozen baseline and behavioral inventory | Implementation task begins | DONE | Codex; `fbincon/ts-01-baseline`; tested `ddc9dde`; [PR #75](https://github.com/fbincon/claude-code-statusline/pull/75); [inventory and evidence](typescript-migration/ts-01/README.md) |
| TS-02 | Platform probes and decisions D01–D06 | TS-01 | DONE | Codex; `fbincon/ts-02-linux-acceptance`; [PR #76](https://github.com/fbincon/claude-code-statusline/pull/76) and [PR #77](https://github.com/fbincon/claude-code-statusline/pull/77); [integration and evidence](typescript-migration/ts-02/LINUX-20261014.md) |
| TS-03 | Shared core, backend and runtime migration | TS-02 | DONE | Codex; implementation [PR #85](https://github.com/fbincon/claude-code-statusline/pull/85), merge `7eae7c4`; [closure under revised criteria](typescript-migration/ts-03/README.md#closure-2026-10-15) |
| TS-04 | Both editors, installation and recovery | TS-03 | IN_PROGRESS | Codex; `fbincon/ts-04-installation`; [batches and evidence](typescript-migration/ts-04/README.md) |
| TS-05 | Complete tooling, CI and release candidate | TS-04 | NOT_STARTED | Unassigned |
| TS-06 | Preview validation and stable delivery | TS-05 | NOT_STARTED | Unassigned |

Independent follow-up: **PERF-01 — NOT_STARTED**, dependent on TS-06 DONE. Its [plan](performance/perf-01.md) records future work and evidence; it is not TS-07 and does not keep a completed migration open.

### TS-01 Baseline and behavioral inventory

- Confirm the reference commit and account for later stable fixes before starting. Freeze the Python reference and comparison harness; do not move the comparison baseline silently.
- Map public commands, protocols, schemas, environment variables and source modules to behavioral cases. Classify tests as behavior to port, fixture to reuse or Python-only implementation detail to retire with a reason.
- Run the applicable existing checks in isolated environments and record versions, passed/failed/skipped counts and known limitations. Capture deterministic render/protocol fixtures and lifecycle event sequences without private transcript content.
- Inventory every Python tool and its intended TypeScript replacement, retained historical purpose or retirement reason. Inventory supported targets separately from targets actually covered by CI.

**Exit:** a traceable case/tool inventory and reproducible Python baseline exist; any baseline failure or coverage gap has an explicit disposition. Historical release success alone does not close this stage.

**TS-01 handoff:** DONE. The reference remains `9b6d2fa`. [161 fixed cases, the complete inventory and validation dispositions](typescript-migration/ts-01/README.md) passed local replay and the 14-job CI / 13-job Mod matrices at `ddc9dde4c0d0836fef583087a9252fee2bd6bf66`. Final reviewed/merged commits and Gitee synchronization are recorded in [PR #75](https://github.com/fbincon/claude-code-statusline/pull/75). At the TS-01 handoff, D01–D06 remained OPEN. Current decisions and evidence are recorded in the TS-02 handoff below; no production TS release version is assigned.

### TS-02 Platform probes and runtime choice

- Prove lossless reads/writes and clock/process identity adapters on intended targets, including documented degradation when APIs are unavailable.
- Exercise lock contention, crash recovery, atomic replacement and legacy-writer exclusion. Run a minimal external terminal loop and verify exit/signal cleanup.
- Prove CLI execution from a shell and from the Mod's argv-based process API, including paths containing spaces/Chinese characters. Check Git Bash and PowerShell independently.
- Measure a minimal complete render path and startup controls. Decide D01–D06 with evidence; define benchmark conditions and budgets before comparing the full migrated candidate.

**Exit:** each required platform has probe evidence or an explicitly resolved support decision. Native dependencies, launcher strategy, state encoding and terminal approach have concrete designs. Broad migration waits for unresolved foundational decisions.

**TS-02 handoff:** [D01–D06 records and reproducible probes](typescript-migration/ts-02/README.md) retain the immutable Python reference. The maintainer approved npm-first, 64-bit TS delivery in a future major release and retirement of Python import/module/pipx and old Windows `.exe` entry points, with historical Python packages retained for compatibility and rollback. These are future-product decisions, not changes to the released installation. Automated native, installed-package, real-host argv and performance evidence is distinct from physical suspend/reboot and desktop input/focus acceptance. The integrated matrix and physical Linux power/desktop evidence satisfy the amended stage gate below. D01–D06 are DECIDED and TS-02 is DONE; TS-03 was NOT_STARTED at the 2026-10-14 handoff. See the stage table for current status.

**2026-10-14 stage-gate amendment:** The maintainer explicitly approved deferring unavailable physical macOS sleep, Windows 10, physical macOS 14 Intel, WSL desktop and remaining target-specific human/power acceptance until before release. Support promises are unchanged and missing checks are not passed. Integrated CI and this physical Linux sleep/reboot/GNOME/popup passed, closing the amended TS-02 gate. At that handoff TS-03 had not started. [Integration and deferred checklist](typescript-migration/ts-02/LINUX-20261014.md). Historical branch: `fbincon/ts-02-linux-acceptance`.

### TS-03 Shared core and backend

- Move configuration models, strict validation, catalog, instance editing, formatting, localization, deterministic Unicode resources, previews and production rendering into the shared core.
- Migrate Git/transcript/usage caches, byte cursors, task reducer/store, clock logic and runtime observations; retain bounded history and demand-driven collection.
- Implement public configuration commands and the `ui`, `runtime`, `render`, `render-subagents`, `hook` and `slash-hook` backend contracts. Preserve canonical revisions and structured errors or implement the recorded transition.
- Port relevant tests with each module. Feed the same fixtures/events and injected time/process observations to isolated Python/TypeScript instances; compare output and resulting semantic state. Record every intentional difference.
- Move generation ownership to TypeScript/shared data without creating competing definitions. Keep both Mods validating against the selected contract.

**Exit:** applicable functional cases match, regression tests cover state/concurrency boundaries, and the migrated core has no production Python call-through. Changing module names or merely passing the type checker does not establish parity. Under the D06 amendment, performance measurement and passing budgets are no longer stage-exit conditions.

**TS-03 completion handoff (2026-10-15):** the six implementation batches and two performance rounds merged through PRs #78–#85. Under the [D06 amendment](typescript-migration/ts-02/D06.md#applicability-amendment-2026-10-15) and [existing non-performance evidence](typescript-migration/ts-03/README.md#closure-2026-10-15), TS-03/03-F are DONE. Machine contracts and the three approved CLI text differences remain unchanged. The latest D06 result is still FAIL; follow-up optimization belongs to PERF-01. TS-04 prerequisites are satisfied but its state remains NOT_STARTED. This task adjusts documentation only, with no installation switch or release.

### TS-04 Editors and installation

**Entry:** TS-03 has completed under the revised criteria. Implementation covers the 212 original TS-04 tests plus the [handoff](typescript-migration/ts-03/TS04-HANDOFF.md): 45 complete tests and the remaining assertions in eight mixed tests. The [265-entry ledger](typescript-migration/ts-04/README.md#responsibility-and-architecture) owns completion evidence.

- Reuse compatible native editor logic and adapt backend invocation; verify resource/version matching, ordered input, stale-response rejection and unknown-save-result handling.
- Replace the external curses adapter while retaining draft semantics, four pages, text input, save/cancel, import review, theme behavior and resize handling.
- Migrate install/doctor/uninstall, ownership, local marketplace/resource manifests, lifecycle/slash hooks, platform launchers and result bridges.
- Test new installation, repeated installation, Python-to-TypeScript upgrade, interruption/recovery, uninstall and downgrade to a compatible backup. Cover old executable/PATH collisions and explicitly disabled integrations.

**Exit:** installed candidate packages pass both-editor and transaction tests on required targets; documented recovery works; user configuration and unrelated Claude settings survive. Remaining platform limitations are explicit.

### TS-05 Tooling and release candidate

- Finish replacing maintained generation, documentation/distribution checks, benchmark, smoke and acceptance tools. Use the TS-01 inventory to remove remaining required Python dependencies without deleting behavioral coverage.
- Update CI for the selected runtime and OS/architecture matrix. Preserve both Mod validation/test coverage and exact-build host type checks where available.
- Build from a fixed commit, independently rebuild and verify artifact contents/checksums, then test installed packages outside the source checkout. Include locales, Unicode licensing, skills, Mod resources and ownership metadata.
- Run functional and stability acceptance and update installation, upgrade, recovery, development and release documentation. Preserve performance limitations and comparison resources; move full final-product measurement to PERF-01.

**Exit:** a reproducible candidate satisfies applicable non-performance engineering gates; normal runtime/build/test/release paths require no Python; every mapped test/tool has a verified replacement or justified retirement. Python compatibility and distribution transitions are documented; isolated historical references and comparison tools remain outside everyday workflows. Full D06 measurement and a passing result are not exit conditions.

### TS-06 Preview and stable delivery

- Complete the [deferred physical/desktop acceptance](typescript-migration/ts-02/LINUX-20261014.md#approved-stage-and-release-gates) before any TypeScript release; unsupported observations must not be converted into passes.
- Assign version identifiers and a preview/stable plan after the compatibility decisions. Keep the Python release and recoverable artifacts available during the transition.
- Validate the actual preview artifacts, target terminals and upgrade/recovery paths; record feedback and fixes against exact commits. Separate automated, PTY, visual and human evidence.
- Follow the [release process](../RELEASING.md), updated for the selected distribution. Verify required checks and released artifacts before task-driven synchronization of the validated GitHub commit/tags/assets to Gitee.
- Close remaining non-performance decisions and regressions, link final implementation/release evidence, and record the last supported Python release and transition instructions. Release notes disclose known performance regressions and recovery options.
- Record the delivered source commit, artifact checksums, runtime and dependency versions for PERF-01. Full performance measurement or optimization is not required in this stage.

**Exit:** the intended release is delivered with verified artifacts, applicable platform/physical/desktop and installation/recovery gates satisfied, and documented limitations/recovery. Disclosed D06 failures or inconclusive results do not block preview/stable delivery. A merged migration PR or a locally working executable is not a completed release.

## Acceptance matrix

| Area | Required cases | Evidence |
| --- | --- | --- |
| Output and protocols | All public commands; valid/invalid stdin; stdout purity, exit codes, strict schemas, version mismatch, errors and preview isolation | Golden outputs plus installed CLI/protocol tests |
| Configuration | Display v1–v8, portable files, stable IDs, disabled options, languages, future/invalid versions, no-write reads, revisions, conflicts, unrelated settings and rollback | Fixtures and transaction/failure tests |
| Lifecycle and usage | Queueing, parallel Agents, main wrap-up, Stop continuation, late/duplicate/out-of-order observations, overlapping/unknown waits, interruption, frozen history and restart | Deterministic event replay and state comparisons |
| Files and clocks | Contention and killed writers, Windows transient failures, unsafe paths, byte-cursor append/truncation/replacement, large integers, sleep, reboot and adjusted clocks | Independent-process tests and platform probes |
| Rendering and UI | All five languages; CJK/combining emoji; ANSI/background resets; text/Powerline; repeated instances; hidden/empty components; 40/80/120-column rows | Fixed observations, cell/output checks and installed PTY captures |
| Editor interaction | Native and external four-page editing, search, import review, separate Apply/Save, cancel, conflicts, keys and resize; existing minimum-size boundaries | Mod tests and external 64×18, 64×20, 80×24, 120×30, 80×48 PTY cases plus native size cases |
| Integration and distribution | Clean/repeated install, legacy upgrade, resource/ownership conflicts, opt-outs, unsupported/unknown host, failure recovery, uninstall and downgrade | Installed-artifact smoke and recovery records |
| Performance (PERF-01, after TS-06) | Startup/render/hook latency, RSS; 100/10,000/100,000 transcript rows; 0/8/32 Agents; cold/warm/append/cache-hit paths | Preserve D06 methods and history; measure the final installed product in PERF-01, outside migration/release gates |

Exact collector counts, bounded resources and existing timeout contracts remain functional/stability checks; performance deferral does not remove or relax them.

Use independent copies of configuration/runtime fixtures for the two implementations. Inject clocks and process identities; normalize only documented nondeterministic fields. A new implementation must not write into the Python reference's live directories. For each suspected mismatch, identify whether it is a regression or a separately documented existing defect; do not silently encode a defect as the new contract.

The baseline CI defines Linux, Windows and Intel/Apple Silicon macOS coverage in [CI](../../.github/workflows/ci.yml) and fixed Claude hosts in [Native Mod](../../.github/workflows/native.yml). The README also documents Windows x86/x64 and WSL; list unsupported or untested target combinations explicitly instead of assuming a runtime/package supports them. Claude Code 2.1.296 currently has runtime/installation coverage but lacks declarations from the existing preparation flow, so it must not be reported as passing exact-build type checks.

Migration stages and PRs do not require repeated full D06 runs. Existing functional, Mod, platform and tooling checks remain applicable; CI/toolchain migration stays in TS-05. PERF-01 performance comparisons use the same machine, fixtures, fixed source/harness revisions and documented cache conditions. Record runtime-only startup separately from full command latency; avoid comparing warmed long-lived TypeScript code to a newly launched Python process. Historical [v2.0 performance](performance-v2.0.0.md) informs case selection but is not a direct measurement of this migration. Do not promise faster execution or less memory before measurement.

Ordinary checks use temporary configuration and no paid model calls. Reuse captured lifecycle evidence where possible. Any necessary new paid acceptance follows the existing budget/ledger rules in [testing](testing.md); a rewrite does not reset the ledger. Linux CI, simulated clocks and PTY captures do not establish human Windows/macOS or physical suspend/resume acceptance.

## Session workflow and handoff

At the start of an implementation session, read this plan, relevant architecture/contracts and applicable repository instructions. Check the working tree and current HEAD, identify unfinished work and the active stage, then choose the next bounded deliverable whose dependencies are satisfied. Preserve unrelated changes. Use existing branch/worktree policy; do not automatically create a second implementation when one is active.

Keep stages reviewable through small changes with the relevant tests. A stage may span multiple PRs. Record both its tested commit and merged commit when they differ. If a later stable fix changes the baseline, record the new comparison revision and rerun affected cases; retain the original reference in history.

At each handoff update both language versions together: current state, stage table, decisions, evidence and next action. Keep raw output out of this plan. Store raw captures privately under a new ignored directory such as `dist/validation/typescript-migration/<stage>/<run>`; this is a proposed layout, not an existing evidence link. Commit a sanitized, self-contained result summary so another maintainer can assess it without that local directory. Record environment versions, commands, counts, failures/skips, commit/harness/artifact hashes and CI/PR links.

Use this handoff record when a stage becomes active:

```text
Date and timezone:
Stage and state:
Worker or chat reference:
Branch, tested commit, merged commit and PR:
Completed deliverable:
Checks and results, including skipped or unrun checks:
Decisions changed and remaining risks:
Evidence summary and private raw-data location:
Next concrete action:
Blocker and the action needed to resolve it, if any:
```

Check documentation after each update:

```bash
python3 -B tools/check_docs.py
git diff --check
```

The documentation checker is still Python at this planning stage; replace this instruction in TS-05. Do not delete the Python reference or mark full parity complete until its mapped behaviors have replacement evidence. Do not start coding or publishing merely because a future task appears in this document.

## Activity log

Older entries retain their then-current stage states and gates. Current rules are at the top of this plan and in the latest D06 amendment.

| Date | Work | Result and next action |
| --- | --- | --- |
| 2026-10-15 | Approved migration-first performance deferral; `fbincon/ts-migration-plan-performance-deferral` | Numerical D06 policy and evidence unchanged; performance no longer blocks TS-03–TS-06. Close TS-03/03-F on existing PR #85 evidence. TS-04–TS-06 and independent PERF-01 remain NOT_STARTED. Documentation/status changes only. |
| 2026-10-14 | TS-02 closure, [PR #77](https://github.com/fbincon/claude-code-statusline/pull/77) | Windows/macOS handoffs verified; Windows reboot identity corrected; real Linux s2idle/reboot and human GNOME/popup passed; integrated 8/14/13 CI jobs passed. Maintainer approved external gaps as mandatory before release. D01–D06 DECIDED, TS-02 DONE; next TS-03, not started. |
| 2026-10-12 | TS-02 probes and decisions, [PR #76](https://github.com/fbincon/claude-code-statusline/pull/76) | Locked Node 24.21.0 and pre-measurement D06 policy; native clock/identity, mixed locks, terminal, installation and real-host argv probes added. [Evidence and open gates](typescript-migration/ts-02/README.md). TS-02 VALIDATING; TS-03 has not started. |
| 2026-10-11 | Source feasibility review and initial bilingual plan | Baseline, scope, risks, six implementation/delivery stages and handoff rules recorded. `python3 -B tools/check_docs.py` passed with 1,313 relative links and bilingual-pair checks; `git diff --check` and bilingual stage/decision consistency checks passed. No application tests or implementation work ran. TS-01–TS-06 remain NOT_STARTED. Next implementation task starts with TS-01. |
| 2026-10-11 | TS-01 implementation and isolated reference validation | Complete source/test/tool inventories, 161 deterministic cases, guarded capture/verify commands and a dedicated CI gate added. Reference suite: 807 passed / 8 native-platform skips. Both fixed-host Mod suites and installed PTYs passed; original external label mismatch corrected in the harness only. State VALIDATING pending CI/PR. [Evidence](typescript-migration/ts-01/README.md). |
| 2026-10-11 | TS-01 exit gate completed | Two independent 161-case captures match; 12 verifier regressions pass. Implementation `ddc9dde` passed all 14 [CI jobs](https://github.com/fbincon/claude-code-statusline/actions/runs/38152166591) and 13 [Mod jobs](https://github.com/fbincon/claude-code-statusline/actions/runs/38152166593). Exact Python 3.14.4 fixes canonical diagnostic provenance; support matrix retained. Stage DONE; [PR #75](https://github.com/fbincon/claude-code-statusline/pull/75) records final merge/sync. Next: TS-02; D01–D06 OPEN. |

This log records milestones and decisions only. Detailed execution evidence belongs in linked results/PRs. The local-only roadmap may point here but must not maintain a separate migration status ledger.
