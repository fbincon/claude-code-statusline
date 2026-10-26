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

`test:mods` runs ordinary product Mod tests plus a disposable capacity Mod using the shipped Client and projection code. All 197 cases must pass; the receipt records actual-host acceptance. The original diagnostic probes' caught rejections do not count as successful regression results. Integration tests independently inject enclosing-tree preflight failures and actual Client validation failures after successful and uncertain saves.

The required matrix retains the earlier thirteen host combinations and adds Linux, Windows and macOS with Claude 2.1.310. All sixteen receipts, eight installed targets and 32 Node runtime cases must match one source commit and artifact digest. Local test metadata is derived from the actual `claude --version`; run `npm run mods:prepare` before direct Mod tests. On 2.1.310, exact declarations are emitted by an interactive session that receives no prompt. The older 2.1.296 declaration gap remains explicitly unavailable.

Final candidate acceptance also requires the twelve real Linux native PTY trigger journeys, external-editor controls, save/readback and inspected terminal captures. Record source/artifact identities and host/platform details. PTYs and reconstructed captures are automated evidence, not new human desktop or physical acceptance.

```bash
npm run mods:prepare
claude plugin test mods/statusline-native
npm run test:native-capacity -- --output dist/validation/native-capacity/new-host-run
npm run capture:native-capacity -- --artifact "$ARTIFACT" --commit "$SOURCE_COMMIT" --output dist/validation/native-capacity/new-installed-run
```

## Delivery record

The v3.9.1 implementation is undergoing final candidate validation. PR/main/tag, immutable artifact, installed PTY and public-channel receipts will be recorded here when completed. No publication is asserted by this implementation record.

Only the six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) are accepted by the [version-specific decision](../releases/approvals/v3.9.1.json); they remain unverified. Every new automated failure or missing receipt blocks release.
