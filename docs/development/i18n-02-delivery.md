# Incremental language workflow implementation

**English** | [简体中文](i18n-02-delivery.zh-CN.md) · [Design](i18n-workflow.md) · [Work package](development-plan.md#i18n-02)

## Starting point and compatibility preparation

Implementation starts at `745336e969937c56d12e6866cd05fa56debf429a`, product v3.14.0, on 2026-10-30 (Asia/Shanghai). Each of the six canonical packs contains 2,311 keys. The 92 generated resources pass the existing drift check; language inputs are unchanged from accepted v3.14.0 source `4146e2738ac390743c5d2d284ac91d7ac4dfc8f0`.

Compatibility [PR #187](https://github.com/fbincon/claude-code-statusline/pull/187) merged as `f4f5b944cd1e446ace650da26740517bca1fda3e`. Its final head `30d606e464b91ed5343c096f921324e84e01a89a` passed the local Linux scoped task and all three-platform [PR checks](https://github.com/fbincon/claude-code-statusline/actions/runs/40966696928); [main verification](https://github.com/fbincon/claude-code-statusline/actions/runs/40967505441) passed through the accepted-base verifier. Actual package comparison proved equivalent runtime payloads; no product matrix was selected. This preparation retained strict complete packs. The feature delivery activates metadata, effective-resource generation, authoring tools and frontend origin handling together.

The build-only analyzer lives in `tools/generation/i18n/`; versioned data lives in its `data/` directory. Inputs are registered as build responsibilities requiring generation, consuming frontend checks and actual package comparison. Raw dictionaries remain in the canonical resource directory. The analyzer reads declared byte maps without Git, network, clock or filesystem access; its accepted-base exporter preserves the analyzer alongside the independent evidence readers.

`release:prepare --candidate` separates product acceptance from publication readiness. Existing `--stable` and `--preview`, complete-source tag promotion, maintenance-source release binding, and npm publication require release-ready languages for activated sources. Original complete/maintenance envelopes retain their schema and identities, with an optional versioned `language` field. Missing new-format evidence cannot use the pre-v3.15 compatibility path. Historical `sourceHashes()` and `policyDigest()` retain their meanings.

Records bind the exact source commit and deterministic report to English, raw translations, acceptance/context/terminology/policy/history and generator inputs. Reports distinguish presence, current validity, acceptance, fallback and retired entries. Accepted provenance preserves the actual validation scope; structural checks do not establish native-speaker review. New unsafe templates fail even when English fallback would be available.

## Effective resources and authoring

The feature keeps all six raw packs unchanged. Each language initially receives 2,311 matching baseline records from the independently verified original PR run `40905911155` (attempt 2), acceptance artifact `12920128077`, ZIP SHA-256 `001ab7e32a3fa899d2abaf3e2f8879f606f307a615fccafa6fdc5ddb65f6ddc8`. Version-controlled snapshots bind every raw language; runtime generation needs no network or repository history. Three immediate-UI/display-save labels per language then receive explicit context/terminology annotations and current contextual validation through the real `validate`/`accept` commands. Each language has 2,308 baseline and three current validated records. No raw phrase was changed and no native-speaker review is inferred.

The analyzer produces one deterministic effective dictionary and origin map. Node UI resources remain aggregated; Native UI dictionaries and fallback lists remain split per language; statusline modules contain only effective `statusline.*` messages. Package staging replaces raw JSON with effective JSON. The runtime package contains neither lifecycle history nor acceptance records. English and Simplified Chinese must be complete during generation; unfinished B entries use current English. Public release requires all A/B entries accepted. Explicit future C registration requires maintenance scope and truthful disclosure; no additional selectable language ships.

Developer commands are `languages report`, `freeze`, `validate`, `accept` and `release-check`, exposed through `npm run languages -- ...`; `languages:coverage` aliases the JSON report. Freeze reads fixed commits and does not build, test, call the network or mutate sources. Validation records exact source/translation/generator inputs and actual contextual review. Only explicit acceptance publishes matching records and preserves previous contracts. Changing the input invalidates a pending validation file. `generate`, `generate:check` and `check` keep their existing integration roles.

Pure `messageOrigin` preserves English fallback evidence in both editors' prepared search without changing ranking or highlights. Accepted technical words identical to English retain their accepted language. UI language, output language and host Apply persistence remain independent. Display schema 17 and editor protocol 30 remain unchanged. No dictionaries, reports or history are added to Client props; existing props/Pane/Client budgets and save recovery remain enforced.

## Validation and delivery status

The focused compatibility tests cover source/translation/context/terminology changes, historical placeholders and deletions, duplicate/unsafe inputs, intentional English terms, future community disclosure, exact package resources and rejected evidence tampering. The independent-verifier regression also replaces HEAD's analyzer with a no-op and confirms that accepted-base code still rejects changed bytes.

I18N-02 remains in progress until the full workflow and its release acceptance complete. Scope includes v3.15.0 publication, Gitee synchronization and test-machine verification, with no paid model calls. Only the six previously accepted issue #96 gaps remain unverified; no new automated failure is waived. New post-publication findings receive issues without a patch release.
