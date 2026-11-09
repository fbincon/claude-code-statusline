# Native editor capacity and recovery

**English** | [简体中文](native-capacity.zh-CN.md)

[Issue #154](https://github.com/fbincon/claude-code-statusline/issues/154) tracks oversized Client props; [issue #155](https://github.com/fbincon/claude-code-statusline/issues/155) separately tracks oversized Client drawings. Both occur with valid configurations. A successful save can precede a failed redraw, so an empty pane is never evidence that the write failed.

## Presentation boundary

The host owns the complete Editor, catalog, baseline, draft, manager candidates and libraries. `lib/session.ts` projects the existing pure drawing rules into a detached, flat frame of visible Box/Text nodes and primitive attributes. Children reference earlier nodes. The Client materializes that presentation and sends ordered input; it no longer reconstructs an Editor. Hidden preview scopes and off-page data do not cross this port.

Both `ui.message` and `ui.render` use the same projection. Epochs, generations, cumulative key batches and acknowledgements retain their existing ordering and deduplication. An empty input batch reports an actual Client resize once; actual region dimensions remain separate from the bounded presentation dimensions used for drawing and key paging.

While handling keys, bound the Client-reported viewport by the area assigned to it by its enclosing pane. Some hosts report the larger terminal viewport on a key event. Drawing and keyboard paging must use the same fitted area, including immediately after End or a resize.

Props, the enclosing Pane and the Client drawing have separate preflights: 48,000 conservatively serialized characters, 10,000 values and depth 16. Non-ASCII escape expansion is included. These are internal safety budgets, not an implementation of Claude's validator; actual host mounting remains mandatory. Projection first reduces page height, then display width, retaining the 32×12 minimum, selected content, preview colors and usable paging. The capacity notice leads the section title so clipping and another active notice cannot hide it. An unrepresentable minimum enters recovery instead of trimming the stored configuration.

Blank space uses a single height-bearing Box. Frame sides use fixed nodes, rather than wrappers for every empty row. Preview and chrome runs merge adjacent identical styles after grapheme-safe clipping. Production sample rendering and saved configuration stay independent of presentation fitting.

## Failure and save outcomes

A rejected projection or enclosing tree is replaced with a small host-only recovery view. A compatible `ui.*` observer handles only the owned Pane/Client's `ui.fault`; Claude 2.1.287/288 retain preflight and manual external Retry/Close controls. Newer hosts can report load, render and run faults. Fault reasons are display text, never instructions or recovery commands.

Recovery retains the received host draft. Retry advances the Client epoch and mount identity, replacing an unmounted instance; it never submits a save. The recovery view distinguishes the last successful save, a pending write and an unknown outcome. Unknown outcomes keep Retry/Close blocked and expose the existing read-only saved-state check. Revision checks, locks, backups and atomic backend publication are unchanged.

The [shared contracts](contracts.md) document the current display and editor interfaces.

## Required checks

The [capacity generator](../../tools/generation/native-capacity.ts) builds cases from the production description, shared editor rules and production rendering with injected observations. Cases cover the observed 72×213 geometry, extreme sizes and registered languages. Generated modules are split to meet the host size limit. The [evidence verifier](../../tools/checks/ci-section-evidence.ts) derives the current case count from the immutable source's language registry.

`test:mods` runs product Mod tests and a disposable capacity Mod with the shipped Client and projection code. Applicable cases verify mounting, input acknowledgement or extreme-size projection in the actual host test engine. Integration tests independently inject enclosing-tree preflight failures and actual Client validation failures after successful and uncertain saves. Record caught diagnostic rejections as diagnostic results.

Select the required installed, runtime and host combinations from [current TypeScript checks](testing.md#current-typescript-checks), bound to one source and artifact digest. Run `npm run mods:prepare` before local Mod tests and use exact declarations for the observed `claude --version`. On 2.1.310, prepare them in an interactive session without submitting a prompt and wait for a complete, stable bundle with the host compiler settings and all required tool declarations. The 2.1.296 declaration gap remains explicitly unavailable.

Run the applicable installed Linux Native and external PTY journeys, verify save readback and terminal captures, and record the artifact, source, host and platform. Record PTY reconstructions as automated evidence and track physical and human results separately. See [testing and acceptance](testing.md) and the [capacity capture gallery](../images/native-capacity/README.md).

```bash
npm run mods:prepare
claude plugin test mods/statusline-native
npm run test:native-capacity -- --output dist/validation/native-capacity/new-host-run
npm run capture:native-capacity -- --artifact "$ARTIFACT" --commit "$SOURCE_COMMIT" --output dist/validation/native-capacity/new-installed-run
```

## Historical v3.9.1 acceptance

- <a id="delivery-record"></a>[Delivery record](history/deliveries/native-capacity-v3.9.1.md#delivery-record)
- <a id="final-stable-delivery"></a>[Final stable delivery](history/deliveries/native-capacity-v3.9.1.md#final-stable-delivery)
