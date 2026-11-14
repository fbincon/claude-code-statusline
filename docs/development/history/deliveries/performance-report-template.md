# Future performance report template

**English** | [简体中文](performance-report-template.zh-CN.md)

This 2026-11-14 documentation delivery adds a forward-looking performance report template to the current testing guide. The five historical performance reports remain frozen. Product behavior, commands, public interfaces and published releases are unchanged. No version, tag, Release or npm publication is created.

## Changes

| Area | Result |
| --- | --- |
| Template | `docs/development/testing.md#future-performance-reports` defines status, baseline source, artifact identity, method, results and limits for new reports. |
| Boundary | The five historical reports linked from the performance index remain frozen; the template does not rewrite them. |
| Method owner | The template links PERF-01 and the existing benchmark guidance rather than duplicating installed timing rules. |
| Checker | No new checker; `docs:check` and the registered content/example tests cover the page. |

## Source identities

- Baseline before the task: `98c4f26f`.
- Implementation commit and final head are recorded in the PR description after CI.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run docs:check` | 7,321 links, 0 errors |
| `docs-content.test.js` + `docs-examples.test.js` | 34/34 passed |
| `npm run check` | Isolated group 1,185/1,185 passed; serial group 585/591 passed with 6 platform skips; 0 failures |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Impact plan and scoped checks | Recorded in the PR description after CI |

The template is forward-looking; no historical report, benchmark tool or product behavior is changed, and no product, installed, platform or paid acceptance is performed.
