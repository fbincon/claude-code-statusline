<a id="display-schemes-project-selection-and-task-inspection"></a>

# Profiles, project selection and task inspection

**English** | [简体中文](profiles-projects-tasks.zh-CN.md)

User contracts are documented in [profiles](../PROFILES.md) and [task details](../TASK_DETAILS.md). Original implementation and release evidence is in the [delivery record](history/deliveries/profiles-projects-tasks.md#display-schemes-project-selection-and-task-inspection).

## Architecture and contracts

Core defines complete display schemes, stable identities, target descriptors, the shared editor manager and the pure task-detail projection. Platform resolves native directory identities and supplies bounded read-only files. CLI coordinates existing configuration transactions and read models. The external TUI and native Client adapt the same scheme manager. Native task inspection has a separate pane and remains part of the existing native Mod.

`profiles_read`, `profiles_apply`, `profile_import`, `profile_export` and `task_details` accept an optional explicit target; their scoped results include target identity, matching root, fallback reason and shared bindings. Legacy unscoped operations retain their existing default-configuration behavior. The generated native request/parser is exercised against every operation.

The version-1 collection holds profiles and project bindings in one user file. A profile stores only a DisplayDraft. The existing default file remains an independent snapshot and downgrade path. New files join the existing recovery allowlist and export protection.

Scoped revisions cover collection state, the selected configuration, installation identity and target. Save-as plus binding is one transaction. Readers never create the collection. Render selection stays outside management initialization and uses no Git or network lookup. A disabled custom-agent display emits no overrides, preserving the host's default rows even when another project needs the shared callback.

## Read-only task evidence

Inspection reads known session task/live files through the bounded diagnostic-file capability, then uses the existing lifecycle decoder, snapshot metrics and timer rules. It does not call collectors, reconcile bindings or persist a new lifecycle representation.

Explicit session identity is required. Current pointers, unique prompt aliases and already-published ownership determine selection. Missing/ambiguous association, future snapshots, incomplete waits and unknown timing stay distinguishable. Parent relationships come from attributed metadata; absent or cyclic relationships do not manufacture a complete tree. Each contributing source retains its own observation time.

Native on-demand agent names are supplied separately and joined only to attributable IDs. They are not persisted. Cross-file snapshots are not atomic and the bounded existing stores are not a full history. Interface support must be established per terminal host.

The full [delivery record](history/deliveries/profiles-projects-tasks.md#display-schemes-project-selection-and-task-inspection) is in the development history. The links below open its moved sections.

- <a id="validation-record"></a><a id="validation-and-delivery-record"></a>[Validation and delivery record](history/deliveries/profiles-projects-tasks.md#validation-and-delivery-record)
- <a id="corrections-and-recovery"></a>[Corrections and recovery](history/deliveries/profiles-projects-tasks.md#corrections-and-recovery)
- <a id="known-gaps"></a>[Known gaps](history/deliveries/profiles-projects-tasks.md#known-gaps)
