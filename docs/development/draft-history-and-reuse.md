# Draft history, structural review and reuse

**English** | [简体中文](draft-history-and-reuse.zh-CN.md)

## Implementation and compatibility

UX-03, COMPOSITION-04 and IMPORT-02 started from `bae8e70e6e7f254b22ec5f87fa61c052aa6575ac` (v3.12.0). All slices shipped together in v3.13.0 on 2026-10-29; status is **DONE**. The post-publication findings below remain open without a patch release. [User workflows](../DRAFT_HISTORY.md).

Core owns session history, semantic differences, structural repair candidates, style-field compatibility and group reference closure. CLI owns bounded file parsing, source/target revision checks and existing locked transactions. External TUI and Native adapt the shared managers. Generated Mod resources remain owned by the resource generator.

Editor protocol 29 adds `review_reuse` with `{draft,path,profile,request}`. `path:null` selects the supplied current draft; portable and single-profile files retain separate parsers. A style request selects source/destination scope/IDs and explicit visual fields; a groups request selects scope/group IDs, outside-reference policy and explicit-layout permission. The result contains a complete validated candidate, semantic changes, identity mappings, dependencies, unresolved local bindings and blocking reasons. Matching frontends strictly validate response shapes. Display schema 16, portable/profile 1, runtime 3 and source registry 3/jobs 4 remain unchanged.

History is bounded to 100 steps/16 MiB of serialized snapshots. Only accepted draft transitions record snapshots; numeric preview stages remain cancellable. New edits remove redo. Confirmed saves and explicit discard/reload clear history. Unknown saves retain the pending snapshot and freeze transitions. Independent source authorization, UI-language saves, host Apply and package execution are not restored by undo. Existing source-draft pins include current, baseline, undo and redo bindings.

Structural proposals retain the complete base, target identity and mutation generation. Missing unit references and undersized columns are pruned, with individually valid relationships preferred. Remaining invalid relationships are explicitly removed in the proposal; unrelated relationships remain. Full draft validation still rejects invalid groups, ordering and spacer placement. Acceptance is one transition; stale acceptance fails without changing the draft. CLI retains default refusal and requires the exact reviewed alignment IDs plus expected revision under the transaction lock.

Style reuse has a fixed visual whitelist and capability-aware format intersection. Whole-group reuse closes selected group/instance/alignment references, maps identities together and retains necessary row spacers. Outside references require expansion or explicit exclusion. Automatic-to-explicit conversion requires its own permission. Cross-configuration binding references are cleared; explicit post-acceptance rebinding filters kind/scope without enabling or executing sources. CLI additionally requires the reviewed semantic source digest so a changed file cannot silently replace a reviewed input.

Conflict comparison reads the same pinned target and retains all drafts/history. The three comparisons show baseline/draft/current. Keeping the draft adopts only a matching reviewed target/installation revision; the subsequent Save still uses the ordinary locked transaction. A second external edit conflicts again. Reload requires explicit discard; export uses the existing protected portable exporter. Native sends only visible bounded frames; history and candidates remain host-owned.

Native offers Ctrl+_ undo and Ctrl+R redo, with U/R also available inside Changes and history. Ctrl+Z remains handled when forwarded, but the Unix host intercepts it to suspend Claude before Client delivery. The installer leaves global host keybindings alone. The maintainer explicitly accepted this verified compatibility adjustment on 2026-10-29; it is not recorded as a passed Native Ctrl+Z terminal test. See the [usage and host reference](../DRAFT_HISTORY.md).

## Required validation

- Focused core, CLI and both-editor tests cover atomic history, cancellation, bounds, forks, save boundaries, stale responses/proposals, independent effects, exact reference repairs, style preservation, group closure and source isolation.
- Installed receipt `draft_reuse` requires six languages, 40/80/120 columns, installed-module history/structural/style/group workflows, save/reopen, real revision conflicts and unknown-save reconciliation. Existing installed obligations remain mandatory.
- Preserve all 217 existing capacity cases; append 26 history/recovery/structure/reuse pages at 32×12 and large/tall geometry, for 243 actual-host cases. Preserve eight installation targets, 32 Node cases and sixteen fixed hosts. Local 2.1.312 results supplement the pinned matrix.
- Both-editor installed PTYs, matching artifact captures, generation, source/document checks and final PR/main/tag gates remain required. Paid models are excluded. Automated terminals and reconstructed cells are not human desktop or physical power evidence.

## Local development checks

On 2026-10-29, the final source check passes 1,407 tests with six platform-only skips, 86 generated resources, 3,764 documentation links, archive and migration inventories. Local Claude 2.1.312 passes all 169 product Mod tests and exact declarations/typechecking. Its actual-host capacity run passes all 243 cases. The first capacity run exposed two read-only export-path projection failures; copying input view state fixes them, and both original assertions plus a pure regression remain. These source checks supplement the immutable candidate, pinned platform/host and publication evidence below.

The first immutable candidate additionally passed all 25 installed categories. Its 42 real PTY journeys found the Native Ctrl+Z interception; the other 41 passed. The collector's old expected total of 34 and Native's unsupported `paste` event-property checks were corrected before final acceptance. Initial failed runs remain diagnostic evidence and are not promoted to release receipts.

The second candidate passed all 25 installed categories, all 42 journeys and a delivered-source rebuild with identical bytes. Screenshot review then removed group-only policy hints and an empty ID tab from style review. Minimum-size review now reserves a visible difference row; group dependency decisions remain available through paging. Core regressions cover all six languages and the minimum body, and actual-host capacity assertions check visible differences and policy paging. The final source must repeat source-bound acceptance. One superseded Windows ARM job timed out preparing system PowerShell before invoking any candidate; this is retained as a failed environment attempt, never accepted as product evidence.

Subsequent local runs retained two environment/observer failures: `/tmp` user quota interrupted fixture creation/package execution, and a task-page Refresh arrived after backend stdout but before the host applied its completed presentation. Use an isolated disk-backed temporary directory and wait for the observed read-only header plus read timestamp before Refresh; retain the assertion that a second backend read completes. These repairs do not waive failed runs or change product behavior.

## Delivery evidence

The accepted source is `200df8fcea2b3f6d1a40885305b6b19bf28f9d05` in [PR #177](https://github.com/fbincon/claude-code-statusline/pull/177). The merge is `b58227b3aee7ea19dbe52e51fa5cbb42ff113e79`; annotated tag object `d2bccc1e47695730babc6d36b4eac7fcfc776cd4` points to the accepted source, reachable from main. Promotion preserves original candidate artifact `12864489146` and acceptance artifact `12866824651`; it does not rebuild or relabel their source.

| Stage | Evidence | Result |
| --- | --- | --- |
| Final PR | [40798745153](https://github.com/fbincon/claude-code-statusline/actions/runs/40798745153) | Complete candidate evidence; 8 installations, 32 Node cases, 16 fixed hosts |
| Main | [40809667058](https://github.com/fbincon/claude-code-statusline/actions/runs/40809667058) | Accepted-source verification and Linux/Windows/macOS integration |
| Annotated tag | [40809978482](https://github.com/fbincon/claude-code-statusline/actions/runs/40809978482) | Original immutable bytes and evidence chain |
| OIDC dry run | [40810725313](https://github.com/fbincon/claude-code-statusline/actions/runs/40810725313) | Passed without npm writes |
| OIDC publication | [40810879215](https://github.com/fbincon/claude-code-statusline/actions/runs/40810879215) | New version published; bytes and selectors verified |
| Public downloads | [40811437241](https://github.com/fbincon/claude-code-statusline/actions/runs/40811437241) | All 6 Linux/Windows/macOS × Node 22/24 jobs passed |

The final immutable candidate passes all 25 installed categories, 42 both-editor real PTY journeys and 243 actual-host capacity assertions, retaining the earlier 217 cases. Extended captures pass all six languages, 948 dark/light terminal reconstructions and four monochrome cases, restoring terminal attributes. The [eight new-page examples](../images/draft-history-reuse/README.md) retain source, raw-cell, PNG, font and crop digests. These are automated terminal observations, not human desktop or physical power acceptance.

Two independent local builds, the original CI build and two delivered-source rebuild rounds produce identical bytes. The four downloaded GitHub draft assets match the same immutable files before publication:

| File | SHA-256 |
| --- | --- |
| `fbincon-claude-code-statusline-3.13.0.tgz` | `ec7fdf4df2dd739c82366e4230a33f8cef1a83c8e7864d407a783128ca6da66c` |
| `claude-code-statusline-3.13.0-source.tar.gz` | `475146ed39c25c57f1b9e3453e98428fd5554a1bea01722fda99289b5c6d37df` |
| `build-manifest.json` | `12c3f76e60ba9f2d51214c5e413e058cda9c7e55014f63b53a3973eda66f61dc` |
| `SHA256SUMS` | `08288f53d5b30f21b868b5fd14cdbf4a5b4b0f6cfd5062ed9f6e7332b4c8dc53` |

[GitHub stable Latest](https://github.com/fbincon/claude-code-statusline/releases/tag/v3.13.0), [npm 3.13.0](https://www.npmjs.com/package/@fbincon/claude-code-statusline/v/3.13.0) and [Gitee Release](https://gitee.com/fbincon/claude-code-statusline/releases/tag/v3.13.0) are published. GitHub release immutability is enabled. `latest=3.13.0` and `beta=3.0.0-beta.1`; exact-version and latest public installations pass. npm 11.19.0's TUF/pacote verifier validates two signatures and two attestation bundles for the published outer package; the verified integrity matches these bytes. Provenance identifies the tag, source and actual OIDC run. This is distinct from the failed full-tree audit in #178 below. Gitee main/tag were synchronized with explicit refspecs; all four anonymous attachment downloads match, using a freshly resolved native-interface route with normal TLS after a CDN timeout.

## Actual-machine validation and post-publication findings

The persistent test installation upgraded from 3.12.0 to 3.13.0 through transaction `pkg-62f03225-299c-486a-abb7-24b07fbf8101`; package and applicable integration completed successfully. The first read-only review stopped after registry ECONNRESET; inspection confirmed no remaining npm process or package mutation before retry. All 1,055 installed inventory files match the accepted artifact, and the configured statusline command renders the supplied sample successfully. External and Native actual-installation flows pass history/compare/export, style paste/undo, complete-group import/undo and atomic alignment repair/undo.

Display/UI bytes and modes remain identical, absent source/profile files remain absent, and unrelated Claude settings are preserved. Only the owned Native `backendVersion` changes to 3.13.0. Host-profile bytes/modes and temporary API-key approval/tip state are restored; request transcripts and incident evidence are retained. Raw logs, receipts and machine paths stay in ignored validation storage.

Three findings remain separate from the six #96 gaps:

- [#178](https://github.com/fbincon/claude-code-statusline/issues/178): `npm audit signatures` traverses bundled private workspace packages and fails with registry E404. The full-tree audit is not recorded as passed; the scoped outer-package signature/provenance verification above passed.
- [#179](https://github.com/fbincon/claude-code-statusline/issues/179): an ad-hoc real-profile Native diagnostic made **two unintended model requests**, violating the no-paid-model instruction. A generic API-key-helper warning matched an overly broad automatic dialog handler, and real settings overrode the synthetic provider environment. The process was stopped. Claude recorded about **USD 0.0955**; the actual provider charge is unverified. These failed diagnostics are not zero-call receipts. The successful Native rerun uses an unprivileged Linux user/network namespace with no routes, verifies outbound ENETUNREACH and observes no API requests. Further tooling changes belong to the issue.
- [#180](https://github.com/fbincon/claude-code-statusline/issues/180): the Native visual-style entry remains English in the Simplified Chinese interface despite translated canonical keys. Functional navigation used the observed caption; it does not establish complete localization of the new Native entry labels.

The release gates and immutable-candidate acceptance made no paid model calls. The unintended post-publication requests above remain explicitly recorded. No product correction, new tag or patch publication follows these findings. The [version-specific approval](../releases/approvals/v3.13.0.json) accepts only the same six existing [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) gaps as unverified; no new automated failure is waived. The evidence follow-up includes PNG assets outside the documentation allowlist and therefore requires the full product CI matrix.
