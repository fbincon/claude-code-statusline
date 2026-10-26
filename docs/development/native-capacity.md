# Native editor capacity and recovery

**English** | [简体中文](native-capacity.zh-CN.md)

[Issue #154](https://github.com/fbincon/claude-code-statusline/issues/154) tracks oversized Client props; [issue #155](https://github.com/fbincon/claude-code-statusline/issues/155) separately tracks oversized Client drawings. Both occur with valid configurations. A successful save can precede a failed redraw, so an empty pane is never evidence that the write failed.

## Presentation boundary

The host owns the complete Editor, catalog, baseline, draft, manager candidates and libraries. `lib/session.ts` projects the existing pure drawing rules into a detached, flat frame of visible Box/Text nodes and primitive attributes. Children reference earlier nodes. The Client materializes that presentation and sends ordered input; it no longer reconstructs an Editor. Hidden preview scopes and off-page data do not cross this port.

Both `ui.message` and `ui.render` use the same projection. Epochs, generations, cumulative key batches and acknowledgements retain their existing ordering and deduplication. An empty input batch reports an actual Client resize once; actual region dimensions remain separate from the bounded presentation dimensions used for drawing and key paging.

Props, the enclosing Pane and the Client drawing have separate preflights: 48,000 conservatively serialized characters, 10,000 values and depth 16. Non-ASCII escape expansion is included. These are internal safety budgets, not an implementation of Claude's validator; actual host mounting remains mandatory. Projection first reduces page height, then display width, retaining the 32×12 minimum, selected content, preview colors and usable paging. It shows a capacity notice. An unrepresentable minimum enters recovery instead of trimming the stored configuration.

Blank space uses a single height-bearing Box. Frame sides use fixed nodes, rather than wrappers for every empty row. Preview and chrome runs merge adjacent identical styles after grapheme-safe clipping. Production sample rendering and saved configuration stay independent of presentation fitting.

## Failure and save outcomes

A rejected projection or enclosing tree is replaced with a small host-only recovery view. A compatible `ui.*` observer handles only the owned Pane/Client's `ui.fault`; Claude 2.1.287/288 retain preflight and manual external Retry/Close controls. Newer hosts can report load, render and run faults. Fault reasons are display text, never instructions or recovery commands.

Recovery retains the received host draft. Retry advances the Client epoch and mount identity, replacing an unmounted instance; it never submits a save. The recovery view distinguishes the last successful save, a pending write and an unknown outcome. Unknown outcomes keep Retry/Close blocked and expose the existing read-only saved-state check. Revision checks, locks, backups and atomic backend publication are unchanged.

This is a private Mod/Client port change. Display schema 15, editor protocol 24, portable/profile envelopes, sources and runtime formats remain unchanged.

## Required checks

`tools/generation/native-capacity.ts` rebuilds the original 195 named cases from the production description, shared editor rules and production rendering with injected observations. Generated values are deduplicated and split below the host's source-module size limit. Two additional cases cover the captured 72×213 geometry and extreme dimensions. No fixture executes a source command or contacts a model.

`test:mods` runs ordinary product Mod tests plus a disposable capacity Mod using the shipped Client and projection code. All 197 cases must pass in the actual host test engine: 196 mount the Client and acknowledge input, and one checks extreme-dimension projection. The original diagnostic probes' caught rejections do not count as successful regression results. Integration tests independently inject enclosing-tree preflight failures and actual Client validation failures after successful and uncertain saves.

The required matrix retains the earlier thirteen host combinations and adds Linux, Windows and macOS with Claude 2.1.310. All sixteen receipts, eight installed targets and 32 Node runtime cases must match one source commit and artifact digest. Local test metadata is derived from the actual `claude --version`; run `npm run mods:prepare` before direct Mod tests. On 2.1.310, exact declarations are emitted by an interactive session that receives no prompt. Preparation clears the generated directory and waits for the complete, stable bundle, including the host's compiler settings and every requested tool declaration. A partial file or stale compiler configuration is not sufficient. The older 2.1.296 declaration gap remains explicitly unavailable.

Final candidate acceptance also requires the twelve real Linux native PTY trigger journeys, external-editor controls, save/readback and inspected terminal captures. Record source/artifact identities and host/platform details. PTYs and reconstructed captures are automated evidence, not new human desktop or physical acceptance.

[Selected installed candidate captures](../images/native-capacity/README.md) show quick setup, gradients, saved instances and tall-pane resizing.

```bash
npm run mods:prepare
claude plugin test mods/statusline-native
npm run test:native-capacity -- --output dist/validation/native-capacity/new-host-run
npm run capture:native-capacity -- --artifact "$ARTIFACT" --commit "$SOURCE_COMMIT" --output dist/validation/native-capacity/new-installed-run
```

## Delivery record

Pre-merge Linux x64 validation on 2026-10-26 passed the full repository check (1,249 passed, five existing platform skips), 143 native product tests, both official Mod suites and available exact 2.1.310 types, and all 197 capacity cases. The installed suite passed all 23 tests. These local results do not substitute for the sixteen-platform/host CI receipts.

Candidate `6bf142621c4b139baaf7c6096dec95b6a7ca66c0` produced two byte-identical packages with SHA-256 `d03bbcd1842adada3236424ea632223db72256558987e858b356f2775957a192`. All seventeen installed PTY journeys passed: the original twelve native triggers, added foreground-gradient and explanation journeys, and three external controls. The 24-instance case wrote once and read back all instances; the tall case retained its unsaved copy after resizing. Normal-journey logs contained no host capacity rejection. Source commands and paid model tests were not run. The collector now waits for observed command registration and selects the actual import row; earlier collector failures were not counted as passes.

The first CI attempts exposed incomplete 2.1.310 declaration generation: the interactive process could stop after its main declaration appeared but before its compiler configuration was written. Fresh-bundle waiting and explicit isolated onboarding preferences fixed this acceptance-tool issue. The [Windows diagnostic](https://github.com/fbincon/claude-code-statusline/actions/runs/40327432302) passed exact generation and TypeScript checks; fresh Linux 2.1.310 and 2.1.287 checks also passed. macOS CI also exposed the `/var` versus `/private/var` temporary-directory alias; preparation now uses the canonical real directory and normalized Windows spelling when recording the trusted test workspace. The temporary diagnostic workflow was removed. The separate extended installed external suite passed 792 light/dark captures across all six languages and four monochrome/dumb-terminal controls, with terminal modes and configuration restored.

PR/main/tag, final immutable artifact and public-channel receipts will be recorded here after their gates complete. No publication is asserted by this pre-merge record.

Only the six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted by the [version-specific decision](../releases/approvals/v3.9.1.json); they remain unverified. Every new automated failure or missing receipt blocks release.
