# Documentation page and registration governance

**English** | [简体中文](documentation-registration-governance.zh-CN.md)

This 2026-11-14 documentation and check maintenance adds a new-current-page checklist, a template/check registry, and narrow checks for registered page structure, index reachability and top-level registration. It also makes the local-only exemptions explicit and fixes the Chinese language-navigation line on the Native page. Product behavior, commands, public interfaces, stored formats and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Checklist | `docs/development/README.md#new-current-documentation-page` and its Chinese pair define pairing, navigation, index insertion, registration, style and delivery steps. |
| Registry | `docs/development/README.md#template-and-check-registry` lists the maintained templates, their checks and boundaries; `impact-checks.md` links it. |
| Page checks | `checkDocumentationPages` validates the H1, language navigation and index reachability of registered pages. |
| Registration | `checkDocumentationRegistration` requires each current top-level guide to be registered or explicitly allowlisted; the six current non-source-backed guides are listed with a reason. |
| Scope | `LOCAL_ONLY` now matches explicit `docs/` paths, so a nested `docs/notes/ROADMAP.md` is no longer exempt. |
| Navigation | `docs/development/native.zh-CN.md` uses the standard `[English](native.md) | **简体中文**` line. |

## Source identities

- Baseline before the task: `d960a99e`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,290 local links, 0 errors (baseline 7,265) |
| `npm run build` | Passed |
| `docs.test.js` | 54/54 passed, including the page, registration and nested-ROADMAP cases |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 passed |
| `npm run check` | 585/591 passed, 6 platform skips, 0 failures; 118 generated resources |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Selected tasks and results are recorded in the PR description after CI |

This is documentation and check maintenance. It does not add source-backed content checks for the six allowlisted guides, validate prose style, or perform installed-product, editor, platform, provider or paid-model acceptance. The six accepted issue #96 gaps remain unverified.
