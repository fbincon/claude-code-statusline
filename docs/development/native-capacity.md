# Native editor capacity and recovery

**English** | [简体中文](native-capacity.zh-CN.md)

[Issue #154](https://github.com/fbincon/claude-code-statusline/issues/154) tracks oversized Client props; [issue #155](https://github.com/fbincon/claude-code-statusline/issues/155) separately tracks oversized Client drawings. Both occur with valid configurations. A successful save can precede a failed redraw, so an empty pane is never evidence that the write failed.

## Presentation boundary

The host owns the complete Editor, catalog, baseline, draft, manager candidates and libraries. `lib/session.ts` projects the existing pure drawing rules into a detached, flat frame of visible Box/Text nodes and primitive attributes. Children reference earlier nodes. The Client materializes that presentation and sends ordered input; it no longer reconstructs an Editor. Hidden preview scopes and off-page data do not cross this port.

Both `ui.message` and `ui.render` use the same projection. Epochs, generations, cumulative key batches and acknowledgements retain their existing ordering and deduplication. An empty input batch reports an actual Client resize once; actual region dimensions remain separate from the bounded presentation dimensions used for drawing and key paging.

Props, the enclosing Pane and the Client drawing have separate preflights: 48,000 conservatively serialized characters, 10,000 values and depth 16. Non-ASCII escape expansion is included. These are internal safety budgets, not an implementation of Claude's validator; actual host mounting remains mandatory. Projection first reduces page height, then display width, retaining the 32×12 minimum, selected content, preview colors and usable paging. The capacity notice leads the section title so clipping and another active notice cannot hide it. An unrepresentable minimum enters recovery instead of trimming the stored configuration.

Blank space uses a single height-bearing Box. Frame sides use fixed nodes, rather than wrappers for every empty row. Preview and chrome runs merge adjacent identical styles after grapheme-safe clipping. Production sample rendering and saved configuration stay independent of presentation fitting.

## Failure and save outcomes

A rejected projection or enclosing tree is replaced with a small host-only recovery view. A compatible `ui.*` observer handles only the owned Pane/Client's `ui.fault`; Claude 2.1.287/288 retain preflight and manual external Retry/Close controls. Newer hosts can report load, render and run faults. Fault reasons are display text, never instructions or recovery commands.

Recovery retains the received host draft. Retry advances the Client epoch and mount identity, replacing an unmounted instance; it never submits a save. The recovery view distinguishes the last successful save, a pending write and an unknown outcome. Unknown outcomes keep Retry/Close blocked and expose the existing read-only saved-state check. Revision checks, locks, backups and atomic backend publication are unchanged.

This is a private Mod/Client port change. Display schema 15, editor protocol 24, portable/profile envelopes, sources and runtime formats remain unchanged.

## Required checks

`tools/generation/native-capacity.ts` rebuilds the original 195 named cases from the production description, shared editor rules and production rendering with injected observations. Generated values are deduplicated and split below the host's source-module size limit. Two additional cases cover the captured 72×213 geometry and extreme dimensions. No fixture executes a source command or contacts a model.

`test:mods` runs ordinary product Mod tests plus a disposable capacity Mod using the shipped Client and projection code. All 197 cases must pass in the actual host test engine: 196 mount the Client and acknowledge input, and one checks extreme-dimension projection. The original diagnostic probes' caught rejections do not count as successful regression results. Integration tests independently inject enclosing-tree preflight failures and actual Client validation failures after successful and uncertain saves.

The required matrix retains the earlier thirteen host combinations and adds Linux, Windows and macOS with Claude 2.1.310. All sixteen receipts, eight installed targets and 32 Node runtime cases must match one source commit and artifact digest. Local test metadata is derived from the actual `claude --version`; run `npm run mods:prepare` before direct Mod tests. On 2.1.310, exact declarations are emitted by an interactive session that receives no prompt. Preparation clears the generated directory and waits for the complete, stable bundle, including the host's compiler settings and every requested tool declaration. A partial file or stale compiler configuration is not sufficient. The older 2.1.296 declaration gap remains explicitly unavailable.

Final candidate acceptance also requires the applicable real Linux native/external PTY journeys, saved-state readback and terminal captures. The [v3.10.0 delivery](appearance-preview-diagnosis.md) extends the original seventeen journeys to twenty-three with color, scenario and file-diagnosis flows in both editors. Record source/artifact identities and host/platform details. PTYs and reconstructed captures are automated evidence, not new human desktop or physical acceptance.

[Selected installed candidate captures](../images/native-capacity/README.md) show quick setup, gradients, saved instances and tall-pane resizing.

```bash
npm run mods:prepare
claude plugin test mods/statusline-native
npm run test:native-capacity -- --output dist/validation/native-capacity/new-host-run
npm run capture:native-capacity -- --artifact "$ARTIFACT" --commit "$SOURCE_COMMIT" --output dist/validation/native-capacity/new-installed-run
```

## Delivery record

Final pre-merge Linux x64 validation on 2026-10-26 passed the full repository check (1,250 passed, five existing platform skips), 144 native product tests, both official Mod suites and available exact 2.1.310 types, and all 197 capacity cases. The installed suite passed all 23 tests. These local results do not substitute for the sixteen-platform/host CI receipts.

Candidate `6bf142621c4b139baaf7c6096dec95b6a7ca66c0` produced two byte-identical packages with SHA-256 `d03bbcd1842adada3236424ea632223db72256558987e858b356f2775957a192`. All seventeen installed PTY journeys passed: the original twelve native triggers, added foreground-gradient and explanation journeys, and three external controls. The 24-instance case wrote once and read back all instances; the tall case retained its unsaved copy after resizing. Normal-journey logs contained no host capacity rejection. Source commands and paid model tests were not run. The collector now waits for observed command registration and selects the actual import row; earlier collector failures were not counted as passes.

The first CI attempts exposed incomplete 2.1.310 declaration generation: the interactive process could stop after its main declaration appeared but before its compiler configuration was written. Fresh-bundle waiting and explicit isolated onboarding preferences fixed this acceptance-tool issue. The [Windows diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/40327432302) passed exact generation and TypeScript checks; fresh Linux 2.1.310 and 2.1.287 checks also passed. macOS CI also exposed the `/var` versus `/private/var` temporary-directory alias; preparation now uses the canonical real directory and normalized Windows spelling when recording the trusted test workspace. The temporary diagnostic workflow was removed. The separate extended installed external suite passed 792 light/dark captures across all six languages and four monochrome/dumb-terminal controls, with terminal modes and configuration restored.

The Windows 2.1.296 run also exposed a 20-second timeout in a host-preference test's repeated field selection. The selector now starts at the host-preference end of the form and reuses the Client identity from its visible frame, eliminating redundant host queries. Behavior assertions and the original deadline remain unchanged; the local 143-test suite passed after this change.

## Final stable delivery

Completed on 2026-10-27 (Asia/Shanghai). [PR #158](https://github.com/fbincon/claude-code-statusline/pull/158) merged the reviewed head `d48d471527ff7b604eceb610736a71b2febb2da5`. Release source is [`5dbfc00381a140917d15cedf63094d01abdc6d1d`](https://github.com/fbincon/claude-code-statusline/commit/5dbfc00381a140917d15cedf63094d01abdc6d1d); annotated tag `v3.9.1` has object `d1a4a3dd6efe054812e7eb004daea929ac508345`.

| Gate | Final result |
| --- | --- |
| [Reviewed PR](https://github.com/fbincon/claude-code-statusline/actions/runs/40336709149) | All 59 applicable jobs and Complete candidate evidence passed |
| [Merged main](https://github.com/fbincon/claude-code-statusline/actions/runs/40346292097) | Same complete matrix passed, attempt 2 |
| [Annotated tag](https://github.com/fbincon/claude-code-statusline/actions/runs/40357902282) | Same complete matrix passed, attempt 2 |
| Stable readiness | Eight installed targets, 32 Node cases and sixteen hosts matched the release source and package digest |
| [OIDC dry-run](https://github.com/fbincon/claude-code-statusline/actions/runs/40370465179) | Tag, ancestry, main/tag gates, artifact bytes and registry state passed |
| [npm publication](https://github.com/fbincon/claude-code-statusline/actions/runs/40370705542) | First attempt published with OIDC; attempt 2 verified the existing identical public version |
| [Public downloads](https://github.com/fbincon/claude-code-statusline/actions/runs/40372098760) | All six Linux/Windows/macOS × Node 22.23.4/24.22.1 jobs passed, including twelve exact-version/latest installations |

The documentation-only job was intentionally skipped in the full product runs. Main's first attempt hit a historical npm archive connection timeout. The tag's first Windows 2.1.288 attempt passed native validation, tests, exact types and all 197 capacity cases, then exceeded the existing npm deadline during a historical upgrade. Targeted retries completed both gates without changing assertions, deadlines or source. Failed attempts remain recorded and are not counted as passing evidence.

The final package separately passed all 197 actual-host capacity cases, 23 installed checks, seventeen installed PTY journeys, 792 light/dark captures across six languages and four monochrome/dumb-terminal controls. Configuration and terminal restoration assertions passed. Five final-package native cell reconstructions were inspected; this remains automated PTY and agent inspection evidence.

| Issue | Separate regression evidence |
| --- | --- |
| [#154: Client props](https://github.com/fbincon/claude-code-statusline/issues/154) | Production setup, import, profiles, sources, explanation, gradients and disabled-instance states remained operable. The real 24-instance journey saved exactly once, read back all instances and displayed the saved result. Recovery tests preserved successful/unknown outcomes and prevented retry from saving again. |
| [#155: Client drawing](https://github.com/fbincon/claude-code-statusline/issues/155) | Host cases covered 32/72-column boundaries and 170/180/200-row panes. A real 200×220 terminal supplied the 72×213 Client; shrinking to 200×50 retained its unsaved copy, preview and footer. Normal-journey logs contained no capacity refusal. |

Two independent builds, the delivered-source rebuild, main/tag CI files, four downloaded GitHub draft assets and anonymous public GitHub/Gitee downloads were byte-identical:

| Delivery file | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.9.1.tgz` | `1a848e45519b5ecb75eb48f9893190b448c289c7e917049ac9b20c545327bf55` |
| `claude-code-statusline-3.9.1-source.tar.gz` | `92155721ec225f6c236264cd08a899f88ee8e6a5e0eb4fd415e195abba881d74` |
| `build-manifest.json` | `bee61414d37adf21e33338bf03240f7fbe2d6eddaaae950d7d37eba2b0abdef9` |
| `SHA256SUMS` | `c2e5f616a013da01586676216c25c06a6f9cc82bbdd039a2ee929546de65b417` |

npm accepted the first OIDC publication and issued provenance, but registry propagation exceeded the verifier's three-minute window. After anonymous metadata and tarball checks confirmed the exact SHA-256/SHA-512 and selectors, the failed publishing job was rerun. It took the read-only `already-published` path and passed; it did not upload another package. Public provenance identifies the release commit, `refs/tags/v3.9.1` and the first publication attempt. npm `latest` is `3.9.1`; `beta` remains `3.0.0-beta.1`.

[GitHub v3.9.1](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.9.1) is stable/Latest with immutable assets. [Gitee v3.9.1](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.9.1) has the same release source, annotated tag and four verified attachments, with platform-specific download notes. An empty-cache offline installation of the anonymously downloaded Gitee package passed version, rendering and configuration smoke checks. Local anonymous GitHub/npm exact-version and latest installations also passed.

The Linux test machine was upgraded through the supported package command from 3.9.0 to 3.9.1. Installed source identity and doctor checks passed. Real installed external/native PTYs opened Quick setup, cancelled without saving, and exercised the native tall-pane resize and close path with Claude 2.1.310. Display and UI-preference files remained byte-identical to the initial snapshots; the only integration-settings change was the managed backend version. The upgraded formal installation remains in place.

Raw logs, captures, private snapshots and receipts remain in ignored validation storage. No paid model tests or new human desktop/physical acceptance were performed.

Only the six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted by the [version-specific decision](../releases/approvals/v3.9.1.json); they remain unverified. Every new automated failure or missing receipt blocks release.
