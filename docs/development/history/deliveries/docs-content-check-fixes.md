# Documentation content regression repairs

**English** | [简体中文](docs-content-check-fixes.zh-CN.md)

This 2026-11-13 maintenance repairs four gaps found after [PR #238](https://github.com/fbincon/claude-code-statusline/pull/238). It changes documentation-check tooling, tests and the bilingual development guide. Product code, generated resources, public interfaces and storage formats are unchanged. The original [registration record](development-content-checks.md) retains its original evidence.

## Result

| Area | Result |
| --- | --- |
| Numeric facts | Compare complete declarations instead of expected substrings. Larger suffix matches, malformed grouping and contradictory declarations are rejected in both languages. |
| Source facts | The read-only TypeScript AST reader follows automatic defaults and validated bounds, the source lifecycle renewal timer, lease expiry and the installed check inventory. Missing, ambiguous, unparsable or inconsistent definitions fail explicitly. |
| CI counts | Node selectors are checked against both existing registries; installation/runtime counts and host history splits are derived from their registries rather than duplicated literals. |
| Runtime versions | Current transport/request declarations are required and checked against core. Bold and `v`-prefixed forms are covered; explicit historical introductions, compatibility ranges and protocol-history tables remain valid. |
| npm commands | Literal inline commands and the supported shell/text fences are inspected statically, including arguments, supported options and continuations. Quoted prose and comments are not commands. |
| Developer guidance | The English and Chinese guides distinguish structure checks, registered facts, isolated executable examples and final-head CI evidence, and describe source-reader maintenance and coverage limits. |

## Source and verification

The baseline is `b50178766b78881eb3a22abba09ecea429533f18`; the implementation is `902529555beb3a86eb6a49ca272592c9cc34c89e`.

| Check | Actual result |
| --- | --- |
| `npm run build` | Passed |
| Content, examples, impact-plan and CI-scope regressions | 64/64 passed, including 10 content tests |
| `npm run docs:check` before this delivery record | 6,868 local links, 0 errors |
| `git diff --check` | Passed |
| Final immutable impact plan and local Linux scoped receipt | Recorded by the delivery PR |
| Final-head `Complete candidate evidence`, merge and main promotion | Recorded by the delivery PR |

Regression cases include 8→18 installations, 67→167 catalog types, 1,024→11,024 tools, 300→1300 seconds, a wrong or missing current runtime version, and nonexistent scripts in inline/argument/fenced commands. Controlled source mutations change automatic defaults, minimum/maximum bounds, renewal/expiry, installed categories and Node selectors through the same fact reader: old documents fail and corrected documents pass with LF and CRLF. Invalid or inconsistent source definitions also fail. These tests only replace read-only source inputs in memory; executable examples retain isolated temporary fixtures.

## Limits and delivery

The static readers recognize registered document and source forms, not arbitrary prose or shell programs. Source-structure changes require an explicit reader update; old values are not a fallback. Checks do not execute the parsed installed suite or Mod hooks and do not establish installed-product, physical editor, terminal, live-provider or paid-model acceptance. The six accepted issue #96 gaps remain unverified.

This maintenance does not create a product version, tag, Release or npm publication. GitHub remains primary. After final-head acceptance and verified main promotion, the validated main commit is synchronized to Gitee with an explicit refspec and verified remote SHA.
