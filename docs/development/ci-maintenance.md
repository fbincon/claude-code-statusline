# CI maintenance and Action identities

**English** | [简体中文](ci-maintenance.zh-CN.md)

Current native capacity and recovery use bounded visible frames and add three-platform Claude 2.1.310 gates; see [implementation and acceptance](native-capacity.md).

## CI-01 implementation

**Status: DONE.** Implementation baseline: `95206119dab6f931f320277d25889fea8da49528` (2026-10-23). Product baseline remains v3.6.0. This maintenance task does not create a version, tag, npm publication or Release.

CI-01 pins the existing Action majors, adds an offline identity check and enables weekly Actions update proposals. Existing workflow triggers, permissions, Node/build versions, platform and host matrices, OIDC and release conditions remain in place. [Roadmap](roadmap.md#milestones) · [Scope and acceptance](development-plan.md#ci-01).

## Initial reference inventory and provenance

The four workflows contain 39 external references: CI 24, npm publication 7, public downloads 4 and historical Python reference 4. The following exact version tags were resolved through the official repositories' Git reference APIs on 2026-10-23; each points directly to a commit. The matching major tags were checked during planning. Each `uses:` retains an exact `# vX.Y.Z` comment.

| Official Action and version tag | Full commit SHA | References |
| --- | --- | --- |
| [checkout v4.4.0](https://github.com/actions/checkout/tree/v4.4.0) | `11d5960a326750d5838078e36cf38b85af677262` | 10 |
| [setup-node v4.4.0](https://github.com/actions/setup-node/tree/v4.4.0) | `49933ea5288caeca8642d1e84afbd3f7d6820020` | 13 |
| [upload-artifact v4.6.2](https://github.com/actions/upload-artifact/tree/v4.6.2) | `ea165f8d65b6e75b540449e92b4886f43607fa02` | 9 |
| [download-artifact v4.3.0](https://github.com/actions/download-artifact/tree/v4.3.0) | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | 6 |
| [setup-python v5.6.0](https://github.com/actions/setup-python/tree/v5.6.0) | `a26af69be951a213d495a4c3e4e4022e16d87065` | 1 |

This is the initial inventory, preserved as delivery evidence. Later update PRs provide their own reviewed version/SHA provenance. Pinning applies to direct workflow references and reachable local composite Actions; dependencies inside remote Actions remain under their upstream implementation. See [GitHub's secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use).

## Local and CI checks

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run actions:check
npm run check
git diff --check
```

`actions:check` parses `.github/workflows/**/*.yml` and `.yaml` with the fixed development-only `yaml` dependency. It checks step Actions, job-level reusable workflows and reachable local Action manifests. External repository references require a full 40-character commit SHA and a semantic version comment; Docker steps require a full SHA-256 digest. Local `./` references retain their normal checkout-relative behavior. Referenced definitions must exist inside the checkout, and local composite dependencies are checked once per file.

The checker handles quoted keys, flow mappings, aliases and folded scalars, ignores script/comment examples, and fails on malformed YAML, duplicate keys, unresolved references or an empty workflow inventory. Diagnostics include the file and line; failure exits nonzero. Its offline check verifies reference and comment syntax. Reviewers verify the actual version-to-commit association against the official upstream source.

The CI scope job runs this check before classifying the change, and `npm run check` runs it before the ordinary suite. The existing aggregate gate requires scope success. Workflow, Dependabot and tool changes continue to require the full product matrix; allowlisted documentation and community templates use necessary documentation checks and do not produce release acceptance receipts.

### Community documentation checks

The lightweight route includes the existing README/CHANGELOG and `docs/**/*.md` paths, root `AGENTS.md`, root `SECURITY.md`/`CONTRIBUTING.md` with their `.zh-CN.md` counterparts, `.github/pull_request_template.md`, and the exact Issue template paths `bug_report.yml`, `config.yml` and legacy `preview-feedback.yml`. The legacy path allows its replacement or deletion. Agent guidance adds only the exact root `AGENTS.md` path, without a wildcard for other instruction files. Other `.github` paths and mixed product/documentation changes still require the full matrix. Unknown Git revisions, executable-to-document renames, tag events and manual CI also retain full checks.

`npm run docs:check` checks local links and anchors in Markdown, the single bilingual PR template, and Markdown content in Issue forms and chooser links. Root policy documents require separate English/Chinese files, except the root `AGENTS.md`, which is maintained in English only and retains link and anchor checks. The exception does not apply to same-named files under `docs/`. The PR template and forms contain both languages in one file. The existing development-only YAML parser checks form structure, explicit unique field IDs, required flags, dropdown choices and contact-link names, HTTP(S) URLs and explanations. This is an offline check of the fields maintained here, not a replacement for GitHub's renderer; inspect the actual chooser and templates after merging. See [GitHub's form syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms).

`Complete candidate evidence` remains the single aggregate check. On the lightweight route it requires successful scope and documentation jobs and intentionally skipped product jobs; otherwise it requires every product job. Changes to the classifier or checkers require local regression tests and complete final-head/main CI before subsequent documentation-only PRs use the new route.

## Weekly updates and review procedure

[Dependabot configuration](../../.github/dependabot.yml) checks only `github-actions`, with a weekly Monday 09:00 schedule in `Asia/Shanghai`. Minor/patch updates share one group and at most one open version-update PR; major version updates are ignored. PRs target the default branch and require normal review and CI. See [GitHub's options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference). An initial scan with no newer eligible version does not need to create a PR.

For every automatic or manual update:

1. Read the official release notes and compare the pinned source with the proposed commit. Keep the current major; assess any runtime, runner or permission changes separately.
2. Resolve the exact version tag in the official Action repository, for example:

   ```bash
   gh api --hostname github.com repos/actions/checkout/git/ref/tags/v4.4.0 \
     --jq '{ref: .ref, type: .object.type, sha: .object.sha}'
   ```

   If the object is an annotated tag, follow its Git tag object until reaching the commit. Record the full commit, version and official source in the PR. Never obtain credentials by printing tokens.
3. Update all occurrences of that Action's SHA and exact version comment together. Run `actions:check`, its regression tests, `npm run check` and whitespace checks. Inspect the diff for permissions, triggers, matrices and release-condition changes.
4. Require successful CI for the final reviewed PR head, then verify the merged main. Run the affected manual workflows when their references change. Documentation-only evidence follow-ups use the normal documentation route.

If an update regresses a workflow, revert the specific update through a PR to restore its previously verified SHA/comment, then revalidate the affected workflows. Preserve existing release tags and npm selectors. No force update of published release identities is part of this procedure.

## Validation and completion evidence

Local validation passed: `actions:check` checked four files and 39 references with zero errors; the checker/scope suite passed all 17 tests; `npm run check` passed 1,131 of 1,136 tests with five platform-specific skips, plus generated resources, documentation, archive integrity and complete responsibility ledgers. A parsed-YAML comparison with the implementation baseline confirmed identical workflow structure after normalizing the pins and removing the added scope check. `git diff --check` passed.

The [first PR attempt](https://github.com/fbincon/claude-code-statusline/actions/runs/39941449719) exposed a checker boundary error with macOS 14/15 temporary roots aliased from `/var` to `/private/var`. The checker now canonicalizes the checkout root first, with a directory-alias regression. That attempt was cancelled; the corrected final head subsequently passed the complete matrix.

Implementation [PR #126](https://github.com/fbincon/claude-code-statusline/pull/126) is merged. The final reviewed head is `7888e4af798ec795b90f4b374633e6fa4fb67335`; the merged implementation main is `8a6a081426f463157df308f6ef1d15a15b5901aa`.

The final head's first execution reported 128 passing and one failing existing native Mod test on Windows/Claude 2.1.289; the failing case was outside the retained output tail. After the run completed, only that job and its dependent aggregate gate were retried with the same commit and assertions. The final second-attempt result was 56 successful checks and one intentionally skipped documentation job. The failed history remains in the same run and was not waived under #96.

The main first attempt recorded a 15-second command-fixture timeout on Windows 11 ARM/x64 with Node 22.x. Its Node 24.0.0 and 24.x cases failed the 60-second system PowerShell readiness check before invoking the candidate (`candidate_invoked=false`). The source, timeouts and assertions stayed unchanged; all three cases and aggregate acceptance passed on the second attempt. The final main result was also 56 successful checks and one intentionally skipped documentation job.

| Validation | Result and evidence |
| --- | --- |
| Final PR | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39942651085): eight installed targets, 32 Node cases, thirteen hosts and aggregate acceptance |
| Implementation main | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946518666): eight installed targets, 32 Node cases, thirteen hosts and aggregate acceptance |
| Historical Python reference | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946731889): frozen reference and mixed-runtime recovery |
| v3.6.0 public downloads | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946736835): six cases across three systems and Node 22/24 |
| npm dry-run | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946741308): prepare succeeded; publish intentionally skipped |
| Initial Dependabot scan | [PASS](https://github.com/fbincon/claude-code-statusline/actions/runs/39946535839): GitHub accepted and executed the Actions update configuration |

All main/manual validations use the implementation main above. The npm dry run checks existing release inputs, preparation and registry bytes; it does not request npm publishing credentials or verify real OIDC publication. This task creates no version tag, npm publication or Release, and preserves the existing v3.6.0 identities.

Main and manual validations passed. The documentation-only evidence follow-up uses the ordinary documentation route, with links checked from a committed-files-only export. After its documentation gate, synchronize final main to Gitee using an explicit refspec after checking divergence. The six [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified; this task's acceptance does not waive new automated failures or turn the dry run into publication evidence.
