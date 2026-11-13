# Publishing npm, GitHub and Gitee Releases

**English** | [简体中文](RELEASING.zh-CN.md)

GitHub is the primary repository for review, CI and Releases. npm distributes the TypeScript package, and Gitee mirrors the verified code and release files. For installation, start with the [user guide](USER_GUIDE.md#installation-and-integration). For procedures and evidence tied to earlier versions, use the [delivery and history index](development/history/README.md).

[Preparation](#current-typescript-publication) · [Release note template](#release-note-template) · [Source and evidence](#source-bound-ci-evidence-promotion) · [Tag and draft](#release-identity-and-immutable-assets) · [npm OIDC](#npm-trusted-publishing-with-github-actions) · [Public downloads](#github-publication-and-public-verification) · [Gitee](#gitee-code-and-release-synchronization) · [Delivery record](#record-delivery)

<a id="current-typescript-publication"></a>

## Prepare a TypeScript release

1. Confirm the release scope, channel and [application version](../packages/core/src/release.ts). Use the pinned development toolchain and branch from current `main` under the contribution branch naming convention. Update the bilingual changelog and versioned notes, and regenerate owned resources when their canonical inputs change. Follow the [contribution guide](../CONTRIBUTING.md) and [development guide](development/README.md).
2. For stable publication, add the maintainer's decision JSON and register its version, path and exact approval date. The verifier reads both files from the immutable source archive. The decision covers that version and the six existing unverified gaps, while every required automated gate still applies. Use the [approval registry](releases/approvals/registry.json) and [release data policy](development/ci-maintenance.md#release-data-and-acceptance-policy).
3. Run the checks selected by the impact plan. Require **Complete candidate evidence** on the final reviewed PR head and wait for successful main verification after merging. Public previews and stable versions both require complete A/B language readiness. Use [impact checks](development/impact-checks.md) and the [language release workflow](development/i18n-workflow.md).
4. Store the release notes under `docs/releases/<tag>.md` and, from v3.10.0, its Simplified Chinese companion; earlier releases use one bilingual page. Use an English Release title and combine both languages in the public body. Include user-visible changes, supported platforms and runtimes, compatibility, installation and known limits. Review the notes against the versioned evidence and [user requirements](USER_GUIDE.md#requirements). Add the version to both editions of the [release notes index](releases/README.md).

Routine repository maintenance uses scoped checks and verified main synchronization. A product publication is a separate maintainer decision.

## Release note template

Release pages live in `docs/releases/`. Follow this structure for every new release.

1. **Naming and pairing.** Write `vX.Y.Z.md` in English and `vX.Y.Z.zh-CN.md` in Simplified Chinese. Both are required from v3.10.0. Releases through v3.9.2 use one bilingual `vX.Y.Z.md`; do not add a separate Chinese page.
2. **Fixed order.** One H1 beginning with the tag; language navigation; publication date; a short summary; user-visible change bullets; compatibility and installation; supported platforms/runtimes; known limits and the six accepted issue #96 gaps; footer links.
3. **Required blocks.** A `Published on **YYYY-MM-DD**.` line, at least one change bullet, `claude-statusline install`, the #96 acceptance sentence, `approvals/<tag>.json`, the delivery record, and this guide.
4. **Optional blocks.** A delivery-record sentence after the date, downgrade guidance, known issues, and extra reference links.
5. **No internal evidence.** Keep source SHAs, dollar costs, request/replay counts, raw run/artifact IDs and harness diagnostics in the delivery record. Link the record instead.
6. **Historical pages.** Keep frozen H1s, prose and commands. Add only the top language navigation, the `english` and `简体中文` anchors, status notes and the `中文摘要` label where the Chinese section is a summary. Link the Chinese index to `vX.Y.Z.md#简体中文`.
7. **Indexes.** Add the version to both `docs/releases/README.md` and `README.zh-CN.md` in the same change. Keep the current-release callout current.
8. **Reserved headings.** Do not use `## Gitee installation and downloads` or `## Original publication`; the Gitee renderer appends them.

Run `npm run docs:check` before committing. `checkReleases` enforces the filename/pair boundary, one H1, language navigation, index completeness, reserved headings and the current-era date/install/decision blocks.

## Changelog template

`CHANGELOG.md` is the dated index of published versions. Release notes own detailed user-visible changes; delivery records own checks and source identities. Each new entry links those records instead of repeating them.

1. **Heading.** `## X.Y.Z — YYYY-MM-DD`; no `v` prefix; ISO date; newest first. Historical entries before `3.16.4` keep their original heading style.
2. **Summary.** Use 3–7 bullets (a major release may use up to 8), each describing one user-visible outcome in one imperative sentence. Order features, behavior changes, fixes, then compatibility and installation. The Chinese entry has the same count and order.
3. **Compatibility.** Use one bullet for schema, protocol or storage changes, or state explicitly that they are unchanged. Installation steps belong in the release notes.
4. **Footer.** End with one bullet: `- Published on npm, GitHub and Gitee on YYYY-MM-DD. [Release notes](docs/releases/vX.Y.Z.md) · [Delivery record](docs/development/history/deliveries/<record>.md#final-release).` Name actual channels and state that Latest is unchanged for a prerelease. Chinese entries use `发布说明` and `交付记录` with `.zh-CN.md` targets.
5. **Evidence and references.** Do not include source SHAs, costs, request counts, run IDs or harness detail; link the delivery record. Reference issues as `[#N](https://github.com/fbincon/claude-code-statusline/issues/N)`.
6. **Scope.** This template applies to versions at or after `3.16.4`; earlier entries are frozen. `npm run docs:check` runs `checkChangelog`, which validates headings, dates, ordering, bilingual version/date/bullet parity, the top version against `release.ts`, release-note links from v3.0.0, and the strict footer rules for entries at or after the boundary.

```markdown
## 3.16.4 — 2026-11-20

- Fix unknown-save reconciliation so a failed read does not repeat a configuration write.
- Keep task language after retry and reopen when the initial descriptor load fails.
- Preserve display schema 17, editor protocol 31 and existing storage formats.
- Published on npm, GitHub and Gitee on 2026-11-20. [Release notes](docs/releases/v3.16.4.md) · [Delivery record](docs/development/history/deliveries/<record>.md#final-release).
```

## Approval decision template

A stable public release requires one version-limited maintainer decision and its registry row. The verifier reads both files from the immutable source archive; `checkApprovalData` validates the checkout during `docs:check`.

1. **Decision file.** Add `docs/releases/approvals/vX.Y.Z.json`:
   ```json
   {
     "schema_version": 1,
     "version": "X.Y.Z",
     "decision": "accept-known-gaps",
     "approved_by": "fbincon",
     "approved_on": "YYYY-MM-DD",
     "authority": "<maintainer decision and scope>",
     "reference": "https://github.com/fbincon/claude-code-statusline/issues/96",
     "accepted_gaps": [
       "physical-macos-sleep",
       "macos-14-intel-desktop-power",
       "windows-10-desktop",
       "wsl-desktop-popup",
       "remaining-target-power-and-human-visual",
       "claude-2.1.296-exact-declarations"
     ]
   }
   ```
2. **Registry row.** Add `{ "version": "X.Y.Z", "path": "docs/releases/approvals/vX.Y.Z.json", "approved_on": "YYYY-MM-DD" }` to `approvals/registry.json`. Keep the existing row order; do not rewrite historical entries.
3. **Historical exception.** v3.0.0 keeps `docs/development/typescript-migration/ts-06/stable-approval.json` as its registered path.
4. **Scope.** The decision accepts only the six recorded issue #96 gaps. It does not waive automated failures or new gaps, and every required gate still applies.

`npm run docs:check` runs `checkApprovalData` against the checkout. Release preparation and promotion still read both files from the verified source archive, not the checkout.

## Source-bound CI evidence promotion

Choose the release source using the verified PR and main records. In the commands below, `SOURCE_COMMIT` is the full selected source SHA, `RELEASE_TAG` is its approved version tag, and `RELEASE_ROOT` is an isolated directory for the release files and reports. Set `DRAFT_TGZ` to the absolute path of the downloaded draft package.

| Accepted source | Tag and delivery evidence |
| --- | --- |
| Complete product source | Tag the accepted PR source reachable through its verified main merge. Publish the original CI package and its three companion files. The final PR supplies the complete product coverage and main adds independently verified integration smoke. |
| Maintenance source | Tag the accepted maintenance source verified on main. Build its own four delivery files, compare independent and source-archive rebuilds, verify runtime equivalence with accepted code, and pass three-platform installation smoke on the new bytes. The release binding links the scoped evidence and the original complete product run. |

Follow the [CI routing and blocking conditions](development/ci-maintenance.md#route-table-and-blocking-conditions) and [maintenance evidence rules](development/impact-checks.md#evidence-and-promotion).

### Release evidence across CI versions

The tagged source selects the evidence schema and history profile. Verify the latest applicable main/tag relationship, the original artifact IDs and digests, and the original executions and attempts, including each stage of split installations. A verified v1 baseline keeps its original full-history identity when reused. Mixed changes also carry any required asset or approval receipt. Use the [complete evidence policy](development/ci-maintenance.md#complete-evidence-versions).

Use the original complete candidate artifact for promotion. Worker-input manifests, transfer probes and manual comparison runs remain diagnostics or execution inputs. Resolve any failed, missing, expired or corrupt required evidence through the applicable automatic route before continuing. Use the [artifact and evidence rules](development/ci-maintenance.md#independent-verification-and-maintag-obligations).

## Release identity and immutable assets

1. Create an annotated tag at `SOURCE_COMMIT` and push its explicit tag ref. Verify the remote tag object and dereferenced commit, then require successful tag CI on the selected route. Preserve the tag, source and package identities in the delivery record.
2. Obtain the exact four delivery files from the accepted route. In the names below, `VERSION` denotes the application version.
   - `fbincon-claude-code-statusline-VERSION.tgz`
   - `claude-code-statusline-VERSION-source.tar.gz`
   - `build-manifest.json`
   - `SHA256SUMS`
3. Confirm independent and delivered-source rebuilds reproduce the verified files. `npm run release:build -- --commit "$SOURCE_COMMIT" --output NEW_DIRECTORY` builds twice. To rebuild from the delivered archive, add `--source ABSOLUTE_SOURCE_ARCHIVE` and use a separate new output directory. The Git export is checked against the selected tree's regular-file inventory and blob identities. The delivered-source rebuild uses the archived manifest and checksums.
4. Prepare a GitHub draft Release for that tag. Use stable/Latest for stable delivery, or prerelease with Latest disabled for a preview. Resolve repository-relative links and images in the public notes to fixed-tag blob/raw URLs, using `docs/releases/<tag>.md` as the base. Preserve external issue and CI links and code samples. Upload the four verified files. Download the draft bundle into a new directory and verify its inventory, sizes and SHA-256 digests against the originals. With the matching source checkout, run `npm run release:verify -- --artifact "$DRAFT_TGZ" --commit "$SOURCE_COMMIT"` on the downloaded tgz alongside the other three files. Use the [release Markdown helpers](../tools/release/markdown.ts) and [isolated installation checks](development/testing.md).

Correct unpublished draft assets or a draft's tag only after checking the exact ref, commit and digests. Once the release is public, preserve the tag object and asset bytes and publish a new version for product fixes. Gitee's copy requires its own byte verification. See [immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).

## npm trusted publishing with GitHub Actions

The [Publish npm with OIDC workflow](../.github/workflows/npm-publish.yml) prepares the verified delivery and publishes its exact tgz. It resolves either the complete-source promotion or the maintenance-source binding. For the complete-source route it rechecks `release:prepare` with the original coverage context. The maintenance route rechecks the current-source bundle and its original product coverage linkage.

### One-time npm configuration

Reuse the verified binding for this repository and workflow. To enroll a new binding, use the npm package settings and choose **Trusted publishing → GitHub Actions**. Enter `fbincon` as the owner, `claude-code-statusline` as the repository, and `npm-publish.yml` as the workflow filename. Leave Environment name blank and enable npm publish and dist-tag operations. Keep account 2FA enabled and create the binding when a fresh version is ready for the first publication within npm's setup window. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

### Verify and publish

Use the same annotated tag as both the workflow ref and the `tag` input. The tag must contain the publishing workflow and matching verifier. Dispatch the dry-run after final PR, main, tag and draft checks pass.

```bash
gh workflow run npm-publish.yml --repo fbincon/claude-code-statusline \
  --ref "$RELEASE_TAG" --field "tag=$RELEASE_TAG" --field dry_run=true
```

Wait for success and compare the summary and `npm-publish-bundle` with the reviewed source and the four draft files. A fresh publication verifies the npm OIDC binding. For the authorized publication, dispatch from the same tag.

```bash
gh workflow run npm-publish.yml --repo fbincon/claude-code-statusline \
  --ref "$RELEASE_TAG" --field "tag=$RELEASE_TAG" --field dry_run=false
```

Wait for the result. Only the isolated publish job receives `id-token: write`. It publishes the prepared tgz with lifecycle scripts disabled, checks public SHA-256 and SHA-512 integrity, selects `latest` for stable or `beta` for preview, and preserves other selectors. Keep the original `npm-publication` receipt and provenance when the workflow completes a fresh upload. An `already-published` result verifies matching bytes and the intended selector. It reports the existing publication without a fresh OIDC receipt.

If the outcome is ambiguous, check exact-version registry state and wait for public metadata before retrying. Compare the package bytes, integrity and selectors. Record the original upload and provenance separately from any verification-only retry. Use the [npm exact-version lifecycle API](https://api-docs.npmjs.com/#tag/Packages).

## GitHub publication and public verification

Publish the verified draft after npm publication and public registry verification. Confirm its tag, commit, release type and four attachments. Stable delivery advances GitHub Latest, while preview delivery uses the prerelease flag and leaves the stable Latest selection in place.

Require all jobs of [Release public downloads](../.github/workflows/preview-downloads.yml) for the exact release tag. The workflow compares anonymous download bytes and installs both the exact version and its channel selector on Linux, Windows and macOS with Node 22 and 24. Its signature job checks the public package, signed bundled upstreams and OIDC source provenance. For a read-only rerun, use the exact published tag and a verifier checkout whose application version matches. The channel selector must still point to the selected version. Record the release source and verifier SHAs separately.

## Gitee code and Release synchronization

Use the separate `gitee` SSH remote. Fetch GitHub and Gitee refs, then verify that Gitee `main` is an ancestor of, or equal to, the exact GitHub `main` commit with successful required CI. Set `VALIDATED_MAIN` to that full SHA. For publication, verify the local annotated tag object and commit against GitHub and confirm Gitee has either the identical tag or no tag with that name. Resolve divergence before pushing.

```bash
git push gitee "$VALIDATED_MAIN:refs/heads/main"
git push gitee "refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"
```

Use the main refspec for ordinary code synchronization and the tag refspec for a version release. Read back `main`, the tag object and its dereferenced commit from both remotes and compare the intended identities.

After GitHub publication and verification, create the matching Gitee Release with the same tag, commit, title and prerelease state. Use the [official Gitee MCP server](https://gitee.com/oschina/mcp-gitee). Upload attachments through `POST /repos/{owner}/{repo}/releases/{release_id}/attach_files`. For Release metadata writes, use form-encoded fields and lowercase boolean values. [Official Gitee Release API](https://gitee.com/api/v5/swagger) Reuse an existing release only after checking its metadata and existing assets. Upload only missing files from the four verified GitHub attachments, stop on conflicts and redownload all four anonymously. Compare their names, sizes and SHA-256 digests with the GitHub originals.

### Generate platform-specific notes

Save the matching Gitee Release JSON, including its current body, as a recovery record. Export the published GitHub Release as JSON with its `body`, `html_url`, `published_at`, tag, prerelease status and assets. Export the Gitee release collection as a JSON array with all pages and actual attachment URLs. With both releases and the verified attachments available, render notes in the isolated release directory.

```bash
npm run release:gitee-notes -- \
  --tag "$RELEASE_TAG" \
  --github-release-json "$RELEASE_ROOT/github-release.json" \
  --gitee-releases-json "$RELEASE_ROOT/gitee-releases.json" \
  --output "$RELEASE_ROOT/gitee-notes.md"
```

The renderer resolves relative links from `docs/releases/<tag>.md` and uses the actual attachment URLs. Review its output against the published GitHub body. Update the Gitee body through the official MCP/API, supplying the original required metadata fields. Updates must carry the original `tag_name`, `name` and `body`; a body-only PATCH is insufficient. Read it back to verify the new body and the intended tag, target, prerelease state and attachment identities. Keep credentials in the maintainer's SSH and keyring setup. Use the [renderer contract](../tools/release/gitee-notes.ts) and [historical wheel synchronization](development/history/release-procedures.md#gitee-synchronization-for-python-releases) for their respective package formats.

## Record delivery

Record the source SHA, main merge, annotated tag and four file digests. Link the required PR, main and tag CI, npm publication and provenance, public download and signature checks, and both public Releases. Distinguish work executed for the release from reused coverage, retries and diagnostics. Record any separately approved machine, physical or paid checks with their actual scope and limits, and retain the six unverified gaps with the version decision. Keep raw logs and machine paths in isolated validation output.

Use the [changelog](../CHANGELOG.md) for the release date and summary, the version notes for user-facing changes, and the corresponding [delivery record](development/history/README.md) for checks and source identities. Follow the [delivery record template](development/history/README.md#delivery-record-template) for records introduced on or after 2026-11-14; earlier records are frozen. Merge the evidence documentation through the normal scoped route and synchronize validated main.

## Historical section links

These links lead to the original procedures and release-specific evidence. Use the [release history](development/history/release-procedures.md) for the complete timeline.

### TypeScript release records by version

- <a id="v3163-bundled-configuration-skills"></a>[v3.16.3 bundled configuration skills](development/history/release-procedures.md#v3163-bundled-configuration-skills)
- <a id="v3162-keyboard-and-editor-repairs"></a>[v3.16.2 keyboard and editor repairs](development/history/release-procedures.md#v3162-keyboard-and-editor-repairs)
- <a id="v3161-runtime-source-and-save-conflict-repairs"></a>[v3.16.1 runtime, source and save-conflict repairs](development/history/release-procedures.md#v3161-runtime-source-and-save-conflict-repairs)
- <a id="v3160-language-expansion"></a>[v3.16.0 language expansion](development/history/release-procedures.md#v3160-language-expansion)
- <a id="v3150-incremental-language-workflow"></a>[v3.15.0 incremental language workflow](development/history/release-procedures.md#v3150-incremental-language-workflow)
- <a id="v3140-adaptive-and-continuous-appearance"></a>[v3.14.0 adaptive and continuous appearance](development/history/release-procedures.md#v3140-adaptive-and-continuous-appearance)
- <a id="v3130-draft-history-and-reuse"></a>[v3.13.0 draft history and reuse](development/history/release-procedures.md#v3130-draft-history-and-reuse)
- <a id="v3120-source-command-and-package-management"></a>[v3.12.0 source, command and package management](development/history/release-procedures.md#v3120-source-command-and-package-management)
- <a id="v3110-task-browsing-and-version-review"></a>[v3.11.0 task browsing and version review](development/history/release-procedures.md#v3110-task-browsing-and-version-review)
- <a id="v3100-appearance-and-understanding"></a>[v3.10.0 appearance and understanding](development/history/release-procedures.md#v3100-appearance-and-understanding)
- <a id="v392-correctness-repairs"></a>[v3.9.2 correctness repairs](development/history/release-procedures.md#v392-correctness-repairs)
- <a id="v391-native-capacity-patch"></a>[v3.9.1 native capacity patch](development/history/release-procedures.md#v391-native-capacity-patch)
- <a id="v380-git-terminal-and-package-management"></a>[v3.8.0 Git, terminal and package management](development/history/release-procedures.md#v380-git-terminal-and-package-management)
- <a id="v370-indicators-groups-refresh-and-rates"></a>[v3.7.0 indicators, groups, refresh and rates](development/history/release-procedures.md#v370-indicators-groups-refresh-and-rates)
- <a id="v360-extension-delivery"></a>[v3.6.0 extension delivery](development/history/release-procedures.md#v360-extension-delivery)
- <a id="v350-setup-and-complete-appearances"></a>[v3.5.0 setup and complete appearances](development/history/release-procedures.md#v350-setup-and-complete-appearances)
- <a id="v340-schemes-projects-and-task-details"></a>[v3.4.0 schemes, projects and task details](development/history/release-procedures.md#v340-schemes-projects-and-task-details)
- <a id="v330-input-diagnosis-delivery"></a>[v3.3.0 input diagnosis delivery](development/history/release-procedures.md#v330-input-diagnosis-delivery)
- <a id="v320-configuration-experience-delivery"></a>[v3.2.0 configuration experience delivery](development/history/release-procedures.md#v320-configuration-experience-delivery)
- <a id="v314-performance-follow-up"></a>[v3.1.4 performance follow-up](development/history/release-procedures.md#v314-performance-follow-up)
- <a id="v313-post-migration-repairs"></a>[v3.1.3 post-migration repairs](development/history/release-procedures.md#v313-post-migration-repairs)
- <a id="v312-external-tui-regression-delivery"></a>[v3.1.2 external-TUI regression delivery](development/history/release-procedures.md#v312-external-tui-regression-delivery)
- <a id="current-external-tui-stable-delivery"></a>[v3.1.1 external TUI stable delivery](development/history/release-procedures.md#v311-external-tui-stable-delivery)
- <a id="current-regional-language-and-node-stable-delivery"></a>[v3.1.0 regional language and Node stable delivery](development/history/release-procedures.md#v310-regional-language-and-node-stable-delivery)

### First TypeScript preview and stable releases

- <a id="typescript-stable-publication"></a>[TypeScript stable publication](development/history/release-procedures.md#typescript-stable-publication)
- <a id="historical-typescript-preview-publication"></a>[Historical TypeScript preview publication](development/history/release-procedures.md#historical-typescript-preview-publication)

### Python and PyPI publication

- <a id="archived-python-publication-procedure"></a><a id="发布-github-release"></a><a id="准备发布提交"></a>[Archived Python publication procedure](development/history/release-procedures.md#archived-python-publication-procedure)
- <a id="native-editor-release-gates"></a>[Native editor release gates](development/history/release-procedures.md#native-editor-release-gates)
- <a id="prepare-the-release-commit"></a>[Prepare the release commit](development/history/release-procedures.md#prepare-the-release-commit)
- <a id="maintain-bilingual-documentation"></a>[Maintain bilingual documentation](development/history/release-procedures.md#maintain-bilingual-documentation)
- <a id="build-distributions-from-a-commit"></a><a id="按提交构建分发包"></a>[Build distributions from a commit](development/history/release-procedures.md#build-distributions-from-a-commit)
- <a id="generate-and-verify-checksums"></a><a id="生成与核验校验文件"></a>[Generate and verify checksums](development/history/release-procedures.md#generate-and-verify-checksums)
- <a id="create-a-tag-and-draft-release"></a><a id="创建标签与草稿-release"></a>[Create a tag and draft Release](development/history/release-procedures.md#create-a-tag-and-draft-release)
- <a id="publish-and-verify-downloads"></a><a id="正式发布与下载验证"></a>[Publish and verify downloads](development/history/release-procedures.md#publish-and-verify-downloads)
- <a id="trusted-publisher-setup"></a>[Trusted publisher setup](development/history/release-procedures.md#trusted-publisher-setup)
- <a id="testpypi-acceptance"></a>[TestPyPI acceptance](development/history/release-procedures.md#testpypi-acceptance)

### Python release gates by version

- <a id="v130-stable-promotion"></a><a id="v130-preview-rollout"></a>[v1.3.0 stable promotion](development/history/release-procedures.md#v130-stable-promotion)
- <a id="v140-display-item-release"></a>[v1.4.0 display-item release](development/history/release-procedures.md#v140-display-item-release)
- <a id="phase-4-preview-and-stable-promotion"></a>[Phase 4 preview and stable promotion](development/history/release-procedures.md#phase-4-preview-and-stable-promotion)
- <a id="phase-5-preview-and-promotion"></a>[Phase 5 preview and promotion](development/history/release-procedures.md#phase-5-preview-and-promotion)
- <a id="v161-external-tui-hierarchy-patch"></a>[v1.6.1 external TUI hierarchy patch](development/history/release-procedures.md#v161-external-tui-hierarchy-patch)
- <a id="task-timing-prerelease-gates"></a>[Task timing prerelease gates](development/history/release-procedures.md#task-timing-prerelease-gates)
- <a id="v170-stable-promotion"></a>[v1.7.0 stable promotion](development/history/release-procedures.md#v170-stable-promotion)
- <a id="v171-tui-polish"></a>[v1.7.1 TUI polish](development/history/release-procedures.md#v171-tui-polish)
- <a id="v172-client-footer-polish"></a>[v1.7.2 Client footer polish](development/history/release-procedures.md#v172-client-footer-polish)
- <a id="v177-documentation-and-diagnostics"></a>[v1.7.7 documentation and diagnostics](development/history/release-procedures.md#v177-documentation-and-diagnostics)
- <a id="v180-native-preview-backgrounds"></a>[v1.8.0 native preview backgrounds](development/history/release-procedures.md#v180-native-preview-backgrounds)
- <a id="v180-bilingual-interfaces"></a>[v1.8.0 bilingual interfaces](development/history/release-procedures.md#v180-bilingual-interfaces)
- <a id="statusline-localization-release-gates"></a>[Statusline localization release gates](development/history/release-procedures.md#statusline-localization-release-gates)
- <a id="discovery-and-import-review-release-gates"></a>[Discovery and import-review release gates](development/history/release-procedures.md#discovery-and-import-review-release-gates)
- <a id="appearance-release-gates"></a>[Appearance release gates](development/history/release-procedures.md#appearance-release-gates)
- <a id="multilingual-release-gates"></a>[Multilingual release gates](development/history/release-procedures.md#multilingual-release-gates)
- <a id="component-instance-release-gates"></a>[Component-instance release gates](development/history/release-procedures.md#component-instance-release-gates)
