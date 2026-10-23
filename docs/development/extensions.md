# Extension implementation and validation

**English** | [简体中文](extensions.zh-CN.md)

This change implements EXTENSIONS-01, LINKS-01, WORKFLOW-01, COMMAND-01 and
CAPABILITIES-01 from baseline `9b783c9b92135607cb5f234a9c53314553fe9ecf`.
CI-01, dependency-update automation and SHOWCASE-01 remain outside this work.
See the [user guide](../EXTENSIONS.md) for configuration and examples.

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
  Windows supervisor bootstrap reads only OS folder variables from the loaded
  profile and explicitly loads system PowerShell modules. The command receives
  its separately serialized minimum environment, including the caller's HOME;
  bootstrap folder recovery does not grant it the host's full environment.
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

Display schema is 10; editor protocol is 17. Registry and observation versions
are independently 1. Runtime 2, lifecycle 4, portable 1, UI preferences 1 and
profile collection/export 1 retain their versions. Existing IDs and default
selections remain unchanged; the catalog adds three main types and one subagent
type, for 66 main and 17 subagent types including text and spacer.

## Evidence requirements

The ordinary suite includes source contract, file failure, last-good retention,
scope mismatch, argv, timeout, cancellation, process tree, GitHub fixture,
portable isolation and six-language shared editor journeys. Native Mod tests
exercise source entry, explicit refresh and close cancellation. Installed
acceptance requires four extension scenarios: local opt-in, command refresh,
portable binding isolation and OSC 8/plain-text output.

Required delivery evidence remains final PR/main/tag CI, eight installation
targets, 32 Node cases, thirteen fixed hosts, independent identical builds and a
delivered-source rebuild, installed terminal captures, draft attachments, OIDC
npm publication and three-channel public download/installation verification.
The release verifier now also requires the installed extension receipt.

Implementation and validation are in progress. No release or complete platform
acceptance is claimed by this document yet. Record exact PR/source/tag/artifact
identities and checks here after they complete. Raw reports stay in ignored
validation directories.

The [v3.6.0-specific decision](../releases/approvals/v3.6.0.json) accepts only the
six existing [#96 observations](https://github.com/fbincon/claude-code-statusline/issues/96).
They remain unverified. Protocol/PTY checks do not claim human clicking, desktop
focus or physical power verification.
