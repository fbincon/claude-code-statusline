# Actions job inventory pagination

**English** | [简体中文](ci-attempt-pagination.zh-CN.md)

This 2026-11-19 CI maintenance delivery restores reads of pinned job inventories for complete candidate evidence after hosted retries. Product versions, tags, GitHub Releases and npm publication are outside this delivery.

## Changes

| Area | Result |
| --- | --- |
| Evidence collection | Read each original Actions attempt in pages of 25, retaining the 2,000-job limit. Every required execution still binds to the original job, attempt and artifact. |

## Source identities

- Baseline before the task is `f121b34c948d0b957e85eae172c3556070d5ff6f`.
- The maintenance PR records the implementation, final head and hosted results.

## Validation and limits

| Check | Actual result |
| --- | --- |
| Hosted candidate | [Run 44374079275, attempt 2](https://github.com/fbincon/claude-code-statusline/actions/runs/44374079275/attempts/2) passed all 7 installations, 28 Node cases and 16 fixed hosts. Evidence collection received HTTP 502 from the pinned attempt-job API. |
| Pinned jobs API | The 100-job request for attempt 2 returned HTTP 502. Four 25-job pages returned all 81 distinct job IDs reported by GitHub. |
| Focused regression checks | All 22 tests passed. The compiled collector read several job pages before issuing a complete fixture envelope. |

This record covers CI evidence collection. The protected aggregate issues the actual candidate envelope in the product PR.
