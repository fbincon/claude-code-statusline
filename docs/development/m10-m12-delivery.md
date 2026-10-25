# M10–M12 implementation and delivery

**English** | [简体中文](m10-m12-delivery.zh-CN.md)

The approved order is IMPORT-01, APPEARANCE-04, COMPOSITION-03, then one v3.9.0 release PR. Starting main: `7d73a2c9f7418f59f781fe71a0e9e66f4db18a2a`; its documentation CI passed. Feature acceptance, final release-source gates and public publication are separate.

## IMPORT-01

Implementation is in progress. Protocol 22 adds optional exact selection keys to the existing import operations; display schema remains 13, with portable/profile envelopes remaining 1. The shared selector and differences are generated from core into the native editor. Whole scoped sections retain valid internal identities; main and subagent ID namespaces remain independent. No arbitrary component merge or host-authorization transfer is introduced.

CLI and both editors support the global and complete-section slices. Named/profile/project saves reuse revision-checked transactions and retain identity/bindings. Installed receipts add four selective-import cases to the existing twenty categories. See [usage and target rules](../PROFILES.md#selective-import).

Focused core, transaction and external-editor tests passed; the local official native Mod suite passed 133 tests. Full source, installed and fixed-host matrix acceptance is pending. No public release has been made.

## Remaining work

APPEARANCE-04 and COMPOSITION-03 are not started. Their planned schema/protocol pairs are 14/23 and 15/24. SHOWCASE-01 remains outside this delivery. The six historical [issue #96](https://github.com/fbincon/claude-code-statusline/issues/96) gaps remain unverified; only those gaps are accepted for the approved release after all final automated gates pass.
