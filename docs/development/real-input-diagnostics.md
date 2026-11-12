# Real-input diagnosis and host-field coverage

**English** | [简体中文](real-input-diagnostics.zh-CN.md)

This page describes real-input diagnosis, host-field interpretation and diagnostic evidence limits. The [user guide](../DIAGNOSTICS.md) defines the shipped command contract; original delivery evidence is in the [delivery record](history/deliveries/real-input-diagnostics.md#real-input-diagnosis-and-host-field-coverage).

## Architecture and contracts

Core owns host-field interpretation, configuration reasons, neutral render tracing and real-input report assembly. The existing sample adapter maps neutral layout results to its sample-specific reason codes. Production rendering keeps tracing opt-in. CLI owns explicit input parsing, display/settings reads and adaptation of existing stores; platform exposes bounded file reads without mutation or process methods.

The diagnostic adapter does not use `ConfigurationService.read`, which creates an installation lock. It uses individual read-only display/settings reads. Runtime observations never invoke collector classes, transaction services, directory scans, reconciliation, subprocesses or network clients. Published request/cost joins have a separate pure snapshot resolver; ordinary collection retains its existing reconciliation behavior. Frozen task snapshots can use the production timer formatter without collecting transcripts.

The ordinary worktree label remains preferred when both host fields exist. A linked Git worktree has a distinct label. Cache miss explanations remain host-reported hypotheses; detailed counts and timestamps stay in the report.

## Evidence and limits

Synthetic [host fixtures](../../tests/fixtures/diagnostics/host-input.json) bind field semantics to the official statusline documentation, inspected on 2026-10-19. They contain no real session data. The legacy Python corpus and archived receipts remain unchanged; comparison accepts only the new operation, explicit worktree metadata change and additive cause component at their exact paths.

Tests cover CLI/file/stdin/backend transport, all current languages, repeated instances and fitting, missing/invalid/zero values, session and prompt isolation, stale/future evidence, and read-only before/after store equality. Current language coverage is owned by [the translation guide](i18n.md). Sample and real output use the same fitting implementation. Separate tests exercise generated Mod protocol parsing and generic editor saving of the added component.

Known limits: source snapshots are not globally atomic; usage caches lack capture times; no transcript refresh or historical reconstruction occurs; absent commit-pair identity prevents branch-diff lookup. Existing physical/desktop/exact-host gaps in [#96](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified. The version-specific acceptance decision is recorded in the delivery record; all new functional and automated failures remain blocking.

The full [delivery record](history/deliveries/real-input-diagnostics.md#real-input-diagnosis-and-host-field-coverage) is in the development history. The links below open its moved sections.

- <a id="validation-record"></a>[Validation record](history/deliveries/real-input-diagnostics.md#validation-record)
- <a id="engineering-candidate"></a>[Engineering candidate](history/deliveries/real-input-diagnostics.md#engineering-candidate)
- <a id="release-validation--2026-10-20"></a>[Release validation — 2026-10-20](history/deliveries/real-input-diagnostics.md#release-validation--2026-10-20)
- <a id="published-delivery"></a>[Published delivery](history/deliveries/real-input-diagnostics.md#published-delivery)
