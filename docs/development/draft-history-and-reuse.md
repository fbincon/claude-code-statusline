# Draft history, structural review and reuse

**English** | [简体中文](draft-history-and-reuse.zh-CN.md)

## Implementation and compatibility

UX-03, COMPOSITION-04 and IMPORT-02 start from `bae8e70e6e7f254b22ec5f87fa61c052aa6575ac` (v3.12.0). All slices belong to one v3.13.0 delivery. Implementation is in progress; publication and platform acceptance are not yet claimed. [User workflows](../DRAFT_HISTORY.md).

Core owns session history, semantic differences, structural repair candidates, style-field compatibility and group reference closure. CLI owns bounded file parsing, source/target revision checks and existing locked transactions. External TUI and Native adapt the shared managers. Generated Mod resources remain owned by the resource generator.

Editor protocol 29 adds `review_reuse` with `{draft,path,profile,request}`. `path:null` selects the supplied current draft; portable and single-profile files retain separate parsers. A style request selects source/destination scope/IDs and explicit visual fields; a groups request selects scope/group IDs, outside-reference policy and explicit-layout permission. The result contains a complete validated candidate, semantic changes, identity mappings, dependencies, unresolved local bindings and blocking reasons. Matching frontends strictly validate response shapes. Display schema 16, portable/profile 1, runtime 3 and source registry 3/jobs 4 remain unchanged.

History is bounded to 100 steps/16 MiB of serialized snapshots. Only accepted draft transitions record snapshots; numeric preview stages remain cancellable. New edits remove redo. Confirmed saves and explicit discard/reload clear history. Unknown saves retain the pending snapshot and freeze transitions. Independent source authorization, UI-language saves, host Apply and package execution are not restored by undo. Existing source-draft pins include current, baseline, undo and redo bindings.

Structural proposals retain the complete base, target identity and mutation generation. Missing unit references and undersized columns are pruned, with individually valid relationships preferred. Remaining invalid relationships are explicitly removed in the proposal; unrelated relationships remain. Full draft validation still rejects invalid groups, ordering and spacer placement. Acceptance is one transition; stale acceptance fails without changing the draft. CLI retains default refusal and requires the exact reviewed alignment IDs plus expected revision under the transaction lock.

Style reuse has a fixed visual whitelist and capability-aware format intersection. Whole-group reuse closes selected group/instance/alignment references, maps identities together and retains necessary row spacers. Outside references require expansion or explicit exclusion. Automatic-to-explicit conversion requires its own permission. Cross-configuration binding references are cleared; explicit post-acceptance rebinding filters kind/scope without enabling or executing sources. CLI additionally requires the reviewed semantic source digest so a changed file cannot silently replace a reviewed input.

Conflict comparison reads the same pinned target and retains all drafts/history. The three comparisons show baseline/draft/current. Keeping the draft adopts only a matching reviewed target/installation revision; the subsequent Save still uses the ordinary locked transaction. A second external edit conflicts again. Reload requires explicit discard; export uses the existing protected portable exporter. Native sends only visible bounded frames; history and candidates remain host-owned.

Native offers Ctrl+_ undo and Ctrl+R redo, with U/R also available inside Changes and history. Ctrl+Z remains handled when forwarded, but the Unix host intercepts it to suspend Claude before Client delivery. The installer leaves global host keybindings alone. This verified host behavior changes the initial shortcut proposal; it is not recorded as a passed Ctrl+Z terminal test. See the [usage and host reference](../DRAFT_HISTORY.md).

## Required validation

- Focused core, CLI and both-editor tests cover atomic history, cancellation, bounds, forks, save boundaries, stale responses/proposals, independent effects, exact reference repairs, style preservation, group closure and source isolation.
- Installed receipt `draft_reuse` requires six languages, 40/80/120 columns, installed-module history/structural/style/group workflows, save/reopen, real revision conflicts and unknown-save reconciliation. Existing installed obligations remain mandatory.
- Preserve all 217 existing capacity cases; append 26 history/recovery/structure/reuse pages at 32×12 and large/tall geometry, for 243 actual-host cases. Preserve eight installation targets, 32 Node cases and sixteen fixed hosts. Local 2.1.312 results supplement the pinned matrix.
- Both-editor installed PTYs, matching artifact captures, generation, source/document checks and final PR/main/tag gates remain required. Paid models are excluded. Automated terminals and reconstructed cells are not human desktop or physical power evidence.

## Local development checks

On 2026-10-29, the complete source check passes 1,404 tests with six platform-only skips, 86 generated resources, 3,762 documentation links, archive and migration inventories. Local Claude 2.1.312 passes all 168 product Mod tests and exact declarations/typechecking. Its actual-host capacity run passes all 243 cases. The first capacity run exposed two read-only export-path projection failures; copying input view state fixes them, and both original assertions plus a pure regression remain. These are development-source checks; immutable candidate, pinned platform/host and publication evidence follow below.

The first immutable candidate additionally passed all 25 installed categories. Its 42 real PTY journeys found the Native Ctrl+Z interception; the other 41 passed. The collector's old expected total of 34 and Native's unsupported `paste` event-property checks were corrected before final acceptance. Initial failed runs remain diagnostic evidence and are not promoted to release receipts.

The second candidate passed all 25 installed categories, all 42 journeys and a delivered-source rebuild with identical bytes. Screenshot review then removed group-only policy hints and an empty ID tab from style review. Minimum-size review now reserves a visible difference row; group dependency decisions remain available through paging. Core regressions cover all six languages and the minimum body, and actual-host capacity assertions check visible differences and policy paging. The final source must repeat source-bound acceptance. One superseded Windows ARM job timed out preparing system PowerShell before invoking any candidate; this is retained as a failed environment attempt, never accepted as product evidence.

## Delivery evidence

Pending final source checks, installed/official-host/terminal acceptance, final PR/main/tag evidence, immutable four-file assets, npm OIDC, GitHub/Gitee publication, public downloads and test-machine upgrade/preferences verification. The [version-specific approval](../releases/approvals/v3.13.0.json) accepts only the six existing [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) gaps. Newly discovered post-publication local problems become issues while preserving the published version.
