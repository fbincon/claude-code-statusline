# Incremental language workflow implementation

**English** | [简体中文](i18n-02-delivery.zh-CN.md) · [Design](i18n-workflow.md) · [Work package](development-plan.md#i18n-02)

## Starting point and compatibility preparation

Implementation starts at `745336e969937c56d12e6866cd05fa56debf429a`, product v3.14.0, on 2026-10-30 (Asia/Shanghai). Each of the six canonical packs contains 2,311 keys. The 92 generated resources pass the existing drift check; language inputs are unchanged from accepted v3.14.0 source `4146e2738ac390743c5d2d284ac91d7ac4dfc8f0`.

The first PR prepares source-bound language analysis and evidence readers. It does **not** activate incremental generation: canonical packs still require complete keys/placeholders and there is no new runtime fallback behavior yet. The second PR supplies metadata, effective-resource generation, authoring tools and frontend origin handling together.

The build-only analyzer lives in `tools/generation/i18n/`; versioned data will live in its `data/` directory. Inputs are registered as build responsibilities requiring generation, consuming frontend checks and actual package comparison. Raw dictionaries remain in the canonical resource directory. The analyzer reads declared byte maps without Git, network, clock or filesystem access; its accepted-base exporter preserves the analyzer alongside the independent evidence readers.

`release:prepare --candidate` separates product acceptance from publication readiness. Existing `--stable` and `--preview`, complete-source tag promotion, maintenance-source release binding, and npm publication require release-ready languages once the policy is activated. Original complete/maintenance envelopes retain their schema and identities, with an optional versioned `language` field. Missing new-format evidence cannot use the pre-v3.15 compatibility path. Historical `sourceHashes()` and `policyDigest()` retain their meanings.

Records bind the exact source commit and deterministic report to English, raw translations, acceptance/context/terminology/policy/history and generator inputs. Reports distinguish presence, current validity, acceptance, fallback and retired entries. Accepted provenance preserves the actual validation scope; structural checks do not establish native-speaker review. New unsafe templates fail even when English fallback would be available.

## Validation and delivery status

The focused compatibility tests cover source/translation/context/terminology changes, historical placeholders and deletions, duplicate/unsafe inputs, intentional English terms, future community disclosure, exact package resources and rejected evidence tampering. The independent-verifier regression also replaces HEAD's analyzer with a no-op and confirms that accepted-base code still rejects changed bytes.

I18N-02 remains in progress until the full workflow and its release acceptance complete. Scope includes v3.15.0 publication, Gitee synchronization and test-machine verification, with no paid model calls. Only the six previously accepted issue #96 gaps remain unverified; no new automated failure is waived. New post-publication findings receive issues without a patch release.
