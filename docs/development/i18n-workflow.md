# Multilingual development and release workflow

**English** | [简体中文](i18n-workflow.zh-CN.md) · [Current translation guide](i18n.md) · [Work package](history/work-package-designs.md#i18n-02) · [Roadmap](roadmap.md#milestones)

The [v3.16.0 twelve-language expansion](history/deliveries/language-expansion.md#final-release) delivered six additional UI/output languages and editor protocol 31. Its publication record preserves the original source identities and acceptance of 144 language combinations and 313 capacity cases.

**I18N-02 is delivered in v3.15.0.** The accepted compatibility foundation preceded activation of incremental generation and strict release readiness. The roadmap owns completion status; see the [implementation and actual evidence](history/deliveries/i18n-02-delivery.md#final-release) and [authoring commands](i18n.md#incremental-authoring). I18N-02 itself added no language; v3.16.0 expanded the registry afterward.

Follow the [Shared design rules](development-plan.md#design-rules), [Native capacity and recovery](native-capacity.md), [impact checks](impact-checks.md) and [source-bound promotion](../RELEASING.md#source-bound-ci-evidence-promotion). Current authoring commands and validation instructions are maintained in the translation guide.

<a id="support-policy"></a>

## Support policy

English remains the source and fallback language. All included languages ship in the same npm package and work offline. Documentation remains English/Simplified Chinese. This work introduces no language downloader, translation service, marketplace or separate language packages.

| Level | Languages | During development | Before a public release |
| --- | --- | --- | --- |
| A: core | `en`, `zh-CN` | Complete current messages and applicable validation accompany the change | Complete, safe and accepted for the current source |
| B: official complete | `zh-TW`, `zh-HK`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`, `id` | Missing, stale or pending entries may use current English | Every required entry is accepted; no missing/stale/pending entries or missing-translation fallback |
| C: community/preview | Future explicitly identified languages only | Safe English fallback is allowed | Disclose acceptance coverage, pending/stale entries and fallback; all effective messages remain safe |

Registered B languages cannot silently become C languages to unblock a release. Support level is separate from the number of populated keys. The original I18N-02 scope selected no new language or writing system; subsequent additions require a defined maintenance scope and relevant functional acceptance.

The workflow completes translation, contextual review, applicable checks and record updates within the authorized task. Validation produces a read-only receipt; explicit `accept` updates the matching acceptance record. This introduces no new reviewer role, signature or separate approval step. Report actual validation scope, including terminology and semantic review where applicable. Structural checks alone do not establish linguistic quality. Give destructive-action, recovery, authorization and numerical-meaning messages particular contextual attention; ordinary copy can be reviewed in batches.

<a id="translation-state"></a>

## Translation state and effective messages

Keep existence, safety, source currency and acceptance distinct. For non-English entries, effective resources use an accepted current translation or the current English template. English itself must be complete and safe. Do not fill raw language packs with English merely to satisfy coverage. An intentionally identical translation of a command or technical term can be valid and accepted.

| State | Meaning | Effective output and gate |
| --- | --- | --- |
| `accepted` | Source signature, translation hash and applicable acceptance record match | Use the translation and retain its acceptance method |
| `missing` | A required source key has no translation | Use English; A development and A/B release gates fail |
| `stale` | The source text or semantic contract changed | Retain the old entry for revision; use current English; A development and A/B release gates fail |
| `pending_validation` | Translation targets current source but required checks or records are unfinished | Complete those checks and records in the same workflow; use English until accepted; A development and A/B release gates fail |
| `obsolete` | A retired key has verifiable historical provenance | Exclude it from current resources and coverage denominators; retain it separately as history |
| `invalid` | Current/new content has invalid types, templates, unsafe text or unverified extra keys | Fail validation; fallback must not hide an invalid submission |

Each acceptance record binds a stable key, source signature, translation hash and acceptance method. The source signature covers English text, named-placeholder contracts and the version of context that affects meaning. Meaning changes with unchanged English require a context-version change or a new semantic key. Terminology changes invalidate affected entries, not every unrelated translation.

Use versioned, deterministic encoding and ordering for signatures. Do not trim or normalize away meaningful changes. Timestamps and execution references may document review, but the clock, network and iteration order must not change generated runtime resources. A translation edit invalidates its old acceptance even when the English is unchanged.

Apply the following rules to source changes.

| Change | Required handling |
| --- | --- |
| Add a key | Mark absent non-core translations missing; generate current English fallback |
| Change source meaning | Invalidate old acceptance and use current English until revalidated |
| Change placeholders | Quarantine verifiable old templates under their old contract; reject newly submitted mismatches; only current-contract templates enter runtime output |
| Delete a key | Retire verifiable old entries; never generate the retired key; reject unexplained extra or misspelled keys |

Historical isolation requires an unchanged entry and a verifiable accepted prior identity/contract supplied by version-controlled inputs. It cannot depend on a full Git checkout or a network lookup during generation. JSON parsing, duplicate-key and text-safety checks still apply to historical content. Relaxing missing-key completeness alone cannot identify stale meaning or prove that an extra key or old placeholder contract has valid historical provenance.

Reports distinguish raw presence, current valid translation, accepted translation, missing/stale/pending/invalid entries and effective English fallback. A complete generated key set is not 100% translation acceptance. For initial migration, use `baseline_accepted` only for matching, verifiable prior evidence, preserving its actual scope and limitations. Otherwise validate the current input and record `validated_accepted`; do not invent past review or rerun already covered checks solely because metadata is new.

<a id="ownership"></a>

## Resource ownership and interfaces

| Input or consumer | Responsibility |
| --- | --- |
| `packages/core/resources/i18n/languages.json` | Canonical ordered codes and autonyms; its current schema accepts only `code` and `name` |
| `packages/core/resources/i18n/locales/*.json` | Real raw translations; no acceptance records or artificial English filling |
| Build-only policy, context, terminology and per-language acceptance inputs | Separate from locale discovery and automatically packaged workspace resources; register ownership and validation inputs before activating their behavior |
| `tools/generation/resources.ts` | Analyze source state once, derive deterministic effective resources and reports, and check the appropriate gate |
| Shared core messages, search and rendering; generated Node/Native copies | Consume the same effective messages and necessary origin information; runtime code does not read acceptance history |

The [packer](../../tools/build/pack.ts) currently copies workspace `resources` recursively. Build-only metadata therefore needs a deliberately excluded location or explicit packaging rules, with package verification that it is absent. It must still be included in the reproducible source archive and the applicable source/report input identity. Do not place metadata JSON in `locales/`, where it would be discovered as a language pack.

Core retains pure message, search, Unicode and rendering rules; platform retains filesystem/process/terminal effects; CLI orchestrates services; TUI and Native adapt interaction. Preserve the per-language statusline modules and Native import-module boundary. Statusline rendering must not acquire the UI dictionary or acceptance history as a new dependency. Do not regenerate the Python archive.

The [translation guide](i18n.md#incremental-authoring) maintains developer commands. See the [shared contracts](contracts.md) for current product interfaces. Metadata and reports have internal versioned interfaces. Handle compatibility where data crosses an interface. Preserve historical `sourceHashes()` and `policyDigest()` meanings and receipt identities. Bind new inputs explicitly and provide compatible readers.

<a id="working-flow"></a>

## Development, translation and release flow

1. **Feature work:** maintain English and Simplified Chinese, detect all affected translation states immediately, and regenerate owned copies. Staleness detection starts with the source change, not at a later freeze.
2. **Organize translation:** optionally freeze a source commit plus catalog, context and policy digests; compare with a verified previous input to list added, changed, parameter-changed and deleted keys. Include English, Simplified Chinese reference, placeholders, use context, relevant terminology and applicable cell budgets. A subsequent source change creates a new freeze identity.
3. **Validate and accept:** revise translations, perform applicable checks and contextual review, then generate matching acceptance records. Include raw inputs and generated copies in the same change; regenerate copies instead of manually merging their contents. Translation can accompany feature work or use a focused maintenance PR.
4. **Release:** require the current A/B gate and truthful C disclosure against the exact selected resources. Fix missing, stale, pending or invalid entries within the task, rerunning only affected checks that cannot be reused. No additional internationalization approval is introduced.

Development and release share one generation rule. Do not emit different bytes for identical inputs through environment variables or a release generation mode. A development candidate may have valid B-language fallback without being linguistically release-ready; passing its product or maintenance acceptance must not bypass the release language gate on any publication route.

| Capability | Integration with existing tooling |
| --- | --- |
| Development check | Extend existing generation/check tasks with A completeness, state, safety and effective-resource checks |
| Report | Extend the meaning of coverage to distinguish raw, accepted and fallback states; derive machine-readable and readable reports from the same analysis |
| Freeze/incremental task list | Read fixed inputs and emit an identity/task list; do not mutate translations or acceptance, access the network or start a full build/test run |
| Release gate | Integrate A/B readiness and C disclosure with existing candidate/release verification and verified report reuse |

These capabilities are implemented through `generate`, `generate:check`, `languages:coverage`, `check` and the developer-only `languages` subcommands documented in the [translation guide](i18n.md#incremental-authoring). `docs:check` remains documentation validation. Reports are read-only with respect to source and acceptance; record updates are an explicit operation within the workflow. Share analysis and existing artifacts rather than adding four duplicate CI executions. Freeze, review and record completion are work steps, not additional permission requests.

<a id="frontend-contracts"></a>

## Frontend and Native contracts

UI language retains immediate independent persistence, including failed-write behavior and page/selection/search/input/draft preservation. Output language follows display-draft preview and Save/Cancel; Claude preferences retain separate Apply. Preserve `zh-Hant` canonicalization, explicit selection, read-only configuration loads, ownership/revision checks, locks, backups and recovery. No automatic system-language selection is introduced.

Production and previews use the same rendering rules with injected observations. Keep raw external errors, numbers, units, IDs, paths, commands and user labels intact. Required English omissions fail development checks without changing silent production render/hook failures or JSON/NDJSON stdout. Search uses the same effective text and stable matching/ranking rules; English fallback must retain English origin rather than appearing as evidence of another language's translation.

Apply the existing [Native presentation boundary](native-capacity.md#presentation-boundary):

- Host retains the complete editor, dictionaries, indexes, draft, candidates and history. Client receives only the visible flat Box/Text frame and necessary primitive attributes. Do not send all languages, acceptance history, reports or hidden pages in props.
- Preflight props, the enclosing Pane and the Client drawing independently, including ordinary Pane paths. The reviewed baseline budgets are 48,000 conservatively serialized characters, 10,000 values and depth 16, including non-ASCII escape expansion. They are internal safety budgets, not host hard limits or byte counts.
- Retain grapheme-safe projection, style/space coalescing, paging, selection and colored production previews. Reduce page height before display width, retain the existing minimum, and shrink presentation rather than stored configuration, translations or drafts.
- An unrepresentable minimum uses recovery outside the rejected tree. Keep saved, pending and unknown outcomes distinct; Retry remounts without resaving. Unknown writes retain existing read-only reconciliation and blocking rules. Preserve epoch/generation ordering, input deduplication, resize and late-response handling.

Keep imported Native modules below the current 1 MiB host limit using the existing split resources. Validate affected long text, Unicode, narrow/tall panes and recovery in existing actual-host suites. Serialization preflight, PTYs and reconstructed screenshots do not independently establish host or physical acceptance; this work does not require a complete host journey for each language.

<a id="ci-routing"></a>

## CI routing and PR → main → tag reuse

Use the existing `ImpactPlan` and protected `Complete candidate evidence` aggregate. The aggregate name does not require a product matrix for maintenance. [Impact checks](impact-checks.md) and [CI maintenance](ci-maintenance.md) remain authoritative; register new inputs and regression cases before activating them.

| Actual change | Expected responsibility and checks |
| --- | --- |
| Ordinary planning/contribution documentation | Documentation route plus the existing unconditional Action identity check |
| Existing translation values with unchanged keys/placeholders and exact generated copies | Existing presentation checks, including affected frontend/host and package obligations |
| Reporting tools, acceptance policy or metadata | Registered actual tool/policy/build responsibility; inspect effective runtime impact rather than trusting the filename |
| Generation, build or packaging rules | Required generation/build checks and actual package comparison; non-equivalent product changes require product acceptance |
| First fallback/state behavior, runtime logic, language registration, keys/placeholders or defaults | Product acceptance on the final ready-PR source |
| Mixed changes | Union and deduplicate applicable checks |
| Unknown ownership or unresolved comparison | Block promotion, resolve the classification/comparison and continue; neither skip it nor default to an expensive full matrix |

Essential language reports bind the source messages, raw translations, acceptance/context/policy inputs, generator identity and actual validation results. Attach them to existing relevant artifacts. Compatible report/schema readers and the release gate must work before development fallback is enabled, including complete-source promotion and maintenance-source publication. Incompatible changes require explicit compatibility verification using the accepted-base trust boundary, not a new validator accepting its own output.

Ready product PRs run the required complete acceptance once for the final source, incorporating the affected language cases. Ready maintenance PRs run their selected scoped tasks. Equivalent main merges retain the existing accepted-first-parent verification: complete-source merges also run the existing three-platform integration smoke; maintenance merges reuse scoped receipts without a new product candidate. The verifier's code comes from the actual accepted first parent, never restored candidate outputs.

Complete-source tags reuse verified original bytes and evidence. Maintenance-source tags build their own package, source archive, manifest and checksums, retain independent/source rebuilds, accepted-code comparison, three-platform installation smoke and source-bound release checks, and explicitly link original product coverage. Verify current language readiness through matching reports or a lightweight check of their deterministic inputs; do not repeat the full product or language matrix on main/tag. Original report source/execution identities remain unchanged and are linked to the new promotion/release identity.

Retain latest-applicable-run and newest-artifact selection, expiry and corruption checks. Missing, expired, failed or incompatible evidence blocks; an older green result or manual diagnostic is not a substitute. Repair or refresh only what is required through existing routes. Preserve current logical platform, runtime and host coverage and the [registered UI/output language combinations](i18n.md#validate-a-change), without multiplying every language by every host, platform and viewport. Do not add redundant dependency installation, generation, builds or per-language jobs. Ordinary documentation maintenance does not require downloading an old product candidate.

## Current language validation

Follow the [translation guide](i18n.md#validate-a-change) for changes to registered languages. For a new language, verify structure, templates, safety, generation, UI, output, search and applicable layouts. Cover UI/output language independence where affected. Define quantity expressions, short labels, plurals and bidirectional behavior for the selected language as applicable and verify them on relevant hosts.

Use [testing and acceptance](testing.md) to record automated checks, actual hosts, PTY reconstructions and human or physical results separately. Preserve logical coverage, evidence identities and recorded limits.

## Historical I18N-02 design and acceptance

The [original v3.14.0 design baseline](history/deliveries/i18n-02-delivery.md#original-design-baseline) records the six-language starting point. The links below open the original design and acceptance sections.

- <a id="delivery-boundaries"></a><a id="delivery-slices"></a>[Delivery boundaries](history/deliveries/i18n-02-delivery.md#delivery-boundaries)
- <a id="functional-acceptance-and-evidence-limits"></a><a id="acceptance"></a>[Functional acceptance and evidence limits](history/deliveries/i18n-02-delivery.md#functional-acceptance-and-evidence-limits)
