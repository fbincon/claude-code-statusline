# Setup and complete appearance implementation

**English** | [简体中文](setup-appearance.zh-CN.md)

This page describes the setup service, shared setup reducer, complete appearance entries and Powerline rules. Original verification and release evidence is in the [delivery record](history/deliveries/setup-appearance.md#setup-and-complete-appearance-implementation).

## Implementation

- The CLI setup service inspects files without write probes or installation locks, fingerprints reviewed resources, and saves the user-default display before independently applying integration. `ConfigurationService.saveDisplay` neither requires existing integration nor applies host preferences. The installer rechecks reviewed resources under its file lock. Durable backups and recovery journals retain partial-commit truth.
- A shared pure setup reducer and the existing Quick setup reducer drive the terminal wizard. Both configuration editors share Quick setup Save as and all appearance fields; native copies are generated. Host Apply stays independent. Shared-profile saves expose affected projects.
- Three complete entries extend the existing preset registry. Their single-profile JSON examples are deterministic generator outputs, without project bindings, host preferences or collector authorization. Saved copies retain their own identities and are not refreshed from built-ins.
- Powerline uses common geometry for explicit rows, automatic wraps, spacers and subagents. Color sequence is assigned after fitting and scoped to one render. Legacy semantic colors and geometry remain defaults. ASCII task/agent indicators retain distinguishable states.

## Interfaces and compatibility

Current display schema and editor protocol versions are tracked in the [protocol and schema versions](../reference/cli.md#protocol-and-schema-versions).

The full [delivery record](history/deliveries/setup-appearance.md#setup-and-complete-appearance-implementation) is in the development history. The links below open its moved sections.

- <a id="verification-and-delivery"></a>[Verification and delivery](history/deliveries/setup-appearance.md#verification-and-delivery)
- <a id="release-identity-and-automated-gates"></a>[Release identity and automated gates](history/deliveries/setup-appearance.md#release-identity-and-automated-gates)
- <a id="installed-artifacts-and-capture-evidence"></a>[Installed artifacts and capture evidence](history/deliveries/setup-appearance.md#installed-artifacts-and-capture-evidence)
- <a id="public-delivery"></a>[Public delivery](history/deliveries/setup-appearance.md#public-delivery)
- <a id="corrections-and-recovery"></a>[Corrections and recovery](history/deliveries/setup-appearance.md#corrections-and-recovery)
