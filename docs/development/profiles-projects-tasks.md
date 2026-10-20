# Display schemes, project selection and task inspection

**English** | [简体中文](profiles-projects-tasks.zh-CN.md)

Implementation baseline: `58cafcc1f85aadd566a1c926549880814d3722a2`, after v3.3.0 delivery. User contracts are documented in [profiles](../PROFILES.md) and [task details](../TASK_DETAILS.md).

## Architecture and contracts

Core defines complete display schemes, stable identities, target descriptors, the shared editor manager and the pure task-detail projection. Platform resolves native directory identities and supplies bounded read-only files. CLI coordinates existing configuration transactions and read models. The external TUI and native Client adapt the same scheme manager. Native task inspection has a separate pane and remains part of the existing native Mod.

Editor protocol 15 adds `profiles_read`, `profiles_apply`, `profile_import`, `profile_export` and `task_details`. `read` and `apply` accept an optional explicit target; their scoped results include target identity, matching root, fallback reason and shared bindings. Legacy unscoped operations retain their existing default-configuration behavior. The generated native request/parser is exercised against every operation.

The version-1 collection holds schemes and project bindings in one user file. Display schema 8, runtime protocol 2, lifecycle 4, portable 1 and UI preferences 1 are unchanged. A scheme stores only a DisplayDraft. The existing default file remains an independent snapshot and downgrade path. New files join the existing recovery allowlist and export protection.

Scoped revisions cover collection state, the selected configuration, installation identity and target. Save-as plus binding is one transaction. Readers never create the collection. Render selection stays outside management initialization and uses no Git or network lookup. A disabled custom-agent display emits no overrides, preserving the host's default rows even when another project needs the shared callback.

## Read-only task evidence

Inspection reads known session task/live files through the bounded diagnostic-file capability, then uses the existing lifecycle decoder, snapshot metrics and timer rules. It does not call collectors, reconcile bindings or persist a new lifecycle representation.

Explicit session identity is required. Current pointers, unique prompt aliases and already-published ownership determine selection. Missing/ambiguous association, future snapshots, incomplete waits and unknown timing stay distinguishable. Parent relationships come from attributed metadata; absent or cyclic relationships do not manufacture a complete tree. Each contributing source retains its own observation time.

Native on-demand agent names are supplied separately and joined only to attributable IDs. They are not persisted. Cross-file snapshots are not atomic and the bounded existing stores are not a full history. Interface support must be established per terminal host.

## Validation record

Implementation validation is in progress; publication has not yet been recorded. Raw logs and receipts stay under ignored `dist/validation/v3.4.0/`.

Local development validation passed 1,069 tests: 1,065 passed, four platform skips and zero failures. All 41 generated resources, 2,567 documentation links, archive integrity and migration ledgers passed. Follow-up diagnosis checks also passed after selecting display and configuration metadata from one snapshot. Linux Claude Code 2.1.294 strict validation and official tests passed: 124 native-editor and 14 runtime tests, including scheme target/save and task-pane integration. Native declarations type-check against that exact host. These local results do not replace the final installed-package and platform gates.

The source uses Node 24.21.0/npm 11.19.0. Final acceptance must bind the final source and package to full PR/main/tag automation, installed targets, Node runtime cases, fixed hosts, generated resources, terminal captures and identical build/source-rebuild assets. Final counts and public URLs belong here only after they are verified.

## Known gaps

The [v3.4.0-specific maintainer decision](../releases/approvals/v3.4.0.json) accepts exactly the six existing observations in [#96](https://github.com/fbincon/claude-code-statusline/issues/96). Those observations remain unverified; new functionality, failed checks or missing automated receipts are not waived. CI, reconstructed PTYs, agent visual inspection, human desktop use and physical power evidence remain separate.
