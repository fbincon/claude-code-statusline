# Setup and complete appearance implementation

**English** | [简体中文](setup-appearance.zh-CN.md)

The development baseline is `a268fcb3b2ed8ad89da07d7e36e70fa8f4e691f2` (v3.4.0 plus repository cleanup). This work implements SETUP-01, APPEARANCE-01 and APPEARANCE-02 for v3.5.0. SHOWCASE-01 and external data sources remain separate work.

## Implementation

- The CLI setup service inspects files without write probes or installation locks, fingerprints reviewed resources, and saves the user-default display before independently applying integration. `ConfigurationService.saveDisplay` neither requires existing integration nor applies host preferences. The installer rechecks reviewed resources under its file lock. Durable backups and recovery journals retain partial-commit truth.
- A shared pure setup reducer and the existing Quick setup reducer drive the terminal wizard. Both configuration editors share Quick setup Save as and all appearance fields; native copies are generated. Host Apply stays independent. Shared-profile saves expose affected projects.
- Three complete entries extend the existing preset registry. Their single-profile JSON examples are deterministic generator outputs, without project bindings, host preferences or collector authorization. Saved copies retain their own identities and are not refreshed from built-ins.
- Powerline uses common geometry for explicit rows, automatic wraps, spacers and subagents. Color sequence is assigned after fitting and scoped to one render. Legacy semantic colors and geometry remain defaults. ASCII task/agent indicators retain distinguishable states.

## Interfaces and compatibility

Display schema 9 adds `powerline` with `padding`, `separator`, `start_cap`, `end_cap`, `color_mode`. Editor protocol 16 carries it, and adds the new preset metadata and CLI option descriptions. Runtime 2, lifecycle 4, portable 1, UI preferences 1 and profile collection/export 1 are unchanged. Schema 1–8 reads migrate only in memory; writes retain compatible backups. Older frontend/backend protocol pairs remain rejected.

The 161 frozen fixtures are unchanged. Their comparison explicitly translates only known display schema/default fields, derived revisions, portable/config bytes, new descriptor fields and the existing protocol metadata. Rendering values and original input/backup bytes remain compared. The existing CLI-help exception uses a new exact hash for the added setup command; no new arbitrary comparison exception is allowed.

## Verification and delivery

The maintainer's [2026-10-23 decision](../releases/approvals/v3.5.0.json) accepts only the six existing unverified observations in [#96](https://github.com/fbincon/claude-code-statusline/issues/96). It does not waive new failures or claim human desktop/power acceptance.

Feature tests cover setup read-only behavior, scoped saves, conflicts, migration backups, partial failures/recovery, schemes, controls, Unicode and widths. Installed acceptance additionally runs cancellation, display-only save and integration in POSIX PTYs or a Windows console, with synthetic host-version evidence identified explicitly. Fixed official-host tests remain separate and use no model requests.

Release completion requires final-head/main/tag matrices, eight installed targets, 32 Node cases, thirteen hosts, independent package/source rebuilds, six-language installed captures, four verified attachments and npm/GitHub/Gitee public download checks. Exact PR, source, artifact and publication identities are recorded here after those gates complete; implementation alone is not publication evidence.

[Setup](../SETUP.md) · [Schemes](../SCHEMES.md) · [Appearance](../APPEARANCE.md) · [Capture provenance](../images/setup-appearance/README.md)
