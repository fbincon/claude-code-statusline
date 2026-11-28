# Editor version and installation navigation

**English** | [简体中文](version-installation-navigation.zh-CN.md)

This 2026-11-28 editor delivery reorganizes the version and installation page in both editors. The delivery covers source and documentation synchronization through GitHub and Gitee.

## Changes

| Area | Result |
| --- | --- |
| Overview | The installed version and channel stay visible alongside grouped version actions. Installation details, history and cleanup, review results and execution progress have their own pages. |
| Controls | Target version and installation prefix show Enter to edit. The channel shows Enter to choose and opens the inherited channel, latest and beta together. |
| Navigation | Returning restores the originating row and scroll. History and cleanup retain independent pages. Explicit execution and deletion use their existing reviewed confirmation boundaries. |

## Source identities

- Baseline `4964bba41bf2e8cd35ed4907adc5ede6517c749c`.
- Product source `639d386b0edccc946c18da8f0985cb878d281c2f`. The engineering package SHA-256 was `cba852197a9eca5873de6792e667d2c33c4c691b57b465f87d25cbae40a47960` and the source archive SHA-256 was `46767cdbc5f6baa7d5ea95f21df7da34bb86a0d8178ad53bf4485e1064164542`. Two independent builds reproduced the package.
- The pull request records the final reviewed head and documentation checks.

## Validation and limits

| Check | Actual result |
| --- | --- |
| `npm run check` on Linux x64 with Node 24.21.0 | 2,029 passed and six platform-conditioned tests skipped. The first run hit the frozen replay timeout during parallel diagnostics. The standalone full rerun passed the replay, generated resources, documentation, archive and migration ledgers. |
| `generate:check` and language validation | 300 new locale entries accepted across twelve languages, with zero English fallbacks. |
| Claude Code 2.1.332 | The selected Native `ci:check` passed plugin validation, 371 tests and compilation against the host's own declarations. The version page includes a 32×12 return-focus case. |
| Installed Linux PTYs | Four journeys passed on the same verified engineering package. They exercised prefix editing, channel selection and cancellation, cleanup navigation and restoration of parent focus. The external editor also passed a resize to 64×18 and back. The displayed Enter key was bold in both editors, the saved configuration bytes matched, and browsing issued no package change requests. |
| Candidate and installation smoke | Verification checked 1,190 files. Seven Linux smoke checks passed, including offline installation with an empty cache and uninstall preserving unowned settings. An initial registry TLS reset was resolved by rerunning the candidate build through the local HTTPS proxy. |
| Impact checks | The plan selected product checks. The aggregate Linux task needed 374 minutes against the 360-minute admission limit. The local product suite and separate Linux installation smoke completed successfully. |

The terminal evidence comes from Linux PTYs and reconstructed cells. Model calls and costs were zero. The six existing platform gaps remain unverified. [Issue #96](https://github.com/fbincon/claude-code-statusline/issues/96)
