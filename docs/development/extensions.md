# Extension implementation and validation

**English** | [简体中文](extensions.zh-CN.md)

This page describes extension registration, validation, source management,
command execution and link handling contracts. Configuration and examples are
in the [user guide](../EXTENSIONS.md); the original implementation and release
evidence is in the [delivery record](history/deliveries/extensions.md#extension-implementation-and-validation).

## Responsibilities and contracts

- Core extension rules validate versioned registrations, scalar observations,
  scope, restricted JSON Pointer and freshness. Display references use opaque
  local bindings; portable imports and exports explicitly remove binding IDs.
- The existing catalog owns capabilities for the affected components. The shared
  editor form filter consumes those descriptors, as do CLI field validation and
  configuration explanation. Old unrelated formatting overrides remain readable.
- Platform adapters bound file reads and subprocess output. POSIX process groups
  and a Windows kill-on-close Job Object terminate descendants; Windows creates
  the tool suspended and assigns it before resuming. The static supervisor never
  interpolates arguments into Shell source.
  POSIX uses an `execve` handoff so an unrecognized executable cannot trigger
  the implicit `/bin/sh` fallback of `execvp`, even on older Node runtimes
  ([exec family contract](https://man7.org/linux/man-pages/man3/exec.3.html)).
  The Windows supervisor is an isolated Node process using the existing native
  adapter, avoiding a PowerShell launch and C# compilation for every command.
  The command receives its separately serialized minimum environment, including
  the caller's HOME; the supervisor does not grant it the host's full environment.
  Package management starts from its independent recovery copy before loading
  native code, so replacing the original package cannot lock its own adapter.
- CLI source services own the separate registry transaction, short-lived refresh
  jobs, revision checks, observation cache and GitHub provider. Jobs have one
  exclusive execution claim, a deadline, cancellation state and a source revision.
  No renderer launches a provider refresh. Local JSON rendering can maintain its
  private last-known-value cache; diagnosis reads without publishing that cache.
- The shared source manager drives both editors. Frontends adapt rendering and
  transport only. Source persistence is separate from display Save and host Apply.
- Link targets remain attached to styled grapheme units and preview spans.
  Clipping/wrapping reconstructs closed OSC 8 ranges; separators and decorations
  do not inherit the preceding target. External input never supplies raw controls.

The full [delivery record](history/deliveries/extensions.md#extension-implementation-and-validation) is in the development history. The links below open its moved sections.

- <a id="completed-validation-and-delivery"></a>[Completed validation and delivery](history/deliveries/extensions.md#completed-validation-and-delivery)
- <a id="source-and-automated-gates"></a>[Source and automated gates](history/deliveries/extensions.md#source-and-automated-gates)
- <a id="installed-behavior-and-evidence-boundaries"></a>[Installed behavior and evidence boundaries](history/deliveries/extensions.md#installed-behavior-and-evidence-boundaries)
- <a id="public-delivery"></a>[Public delivery](history/deliveries/extensions.md#public-delivery)
- <a id="corrections-and-recovery"></a>[Corrections and recovery](history/deliveries/extensions.md#corrections-and-recovery)
