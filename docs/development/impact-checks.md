# Impact checks and maintenance evidence

**English** | [简体中文](impact-checks.zh-CN.md)

## Staged adoption

Use the impact plan locally for ordinary merges. The release workflow owns [PR, main and tag acceptance](ci-maintenance.md#candidate-promotion-across-pr-main-and-tag).

## Responsibilities and checks

The classifier reads both immutable Git trees, including additions, deletions, modes and both sides of renames. It does not use PR titles, labels or a maintainer's informal classification. Core behavior includes the CLI, platform effects, external editor and Mods as well as `packages/core`.

| Responsibility | Required checks |
| --- | --- |
| Maintained documentation and community templates | Links, anchors, bilingual counterparts, template structure and whitespace; registered current guides also select source-backed content/example tests || Documentation media and JSON records | Referenced files, media framing, PNG CRC/decompression/dimensions and inspectable capture hashes |
| Translation values, human-help value slots and registered theme colors | Message keys/placeholders, exact resource generation, relevant core/CLI/TUI tests, applicable Native host tests and package/installation checks |
| Tests and shared fixtures | Registered consuming test families and applicable platform/host combinations |
| Check, workflow, Action and release policy | Workflow identities and check/release contract tests, including failure cases |
| Benchmarks, acceptance and development tools | Tool-family tests and relevant system checks |
| Build/generation inputs, development dependencies and export settings | Actual package comparison, generation/build tests and three-platform installation smoke |
| Product logic, protocols, runtime dependencies and bundled skill instructions | `npm run check` and targeted diagnostics as needed |

Template locations and check boundaries are listed in the [template and check registry](README.md#template-and-check-registry). The PR template structure and any top-level Issue form routing are covered by `docs:check` locally; see [community documentation checks](ci-maintenance.md#community-documentation-checks).

Documentation checks run on Linux. Pure core tests run on Linux; platform, application, terminal and tooling families retain Linux, Windows and macOS executions. Mod checks use the existing fixed host inventory for the affected Mod; unsupported Runtime hosts are excluded rather than reported as passes. Scoped host jobs run official validation/tests and available exact-host declarations without running unrelated installation/runtime matrices. The existing Claude 2.1.296 declaration gap remains explicit.

Several categories combine by taking the union of checks. Unknown responsibilities, unsupported file types, ambiguous modes or unreadable revisions block with a classification diagnostic. They never automatically select the expensive product matrix. Frozen archive changes still face archive integrity checks.

Static production imports override a test/tool/document directory label, including inlined compile-time inputs; those changes require actual package comparison. Generated fixtures always select generation checks. Descriptive workspace metadata is compared without ignoring entrypoints, dependencies or executable package contracts. Compare the full local base/head range so the plan covers every commit in the PR.

Only existing locale keys/placeholders, registered human-help literal value slots and theme value slots qualify as presentation data. Help command selectors, property keys, control flow, executable expressions and terminal control characters remain significant. Changed language registration, keys or defaults remain product changes. Generated copies must match their canonical sources exactly. Product `SKILL.md` files are executable instructions, not ordinary documentation. Comment/format/type-only changes require equivalent emitted operations and an actual package comparison.

Dependency classification follows the runtime closure from the four business workspaces, including optional dependencies and linked workspace dependencies. A lockfile's `dev` flag alone cannot remove a runtime dependency from this closure.

A change to artifact transport is CI policy. The local Action and its dependency lock are acceptance-policy inputs. Build tooling that constructs a new worker manifest also requires package comparison. The light input must reproduce the archived candidate bytes, frozen Node resolutions and required coverage plan. Validate transport faults with targeted tests and a diagnostic dispatch.

## Local interface

Use immutable committed inputs. The planner only reads source until `--compare` is explicitly requested:

```bash
npm run ci:plan -- --base origin/main --head HEAD --output /tmp/impact-plan.json
```

The versioned `ImpactPlan` contains base/head/tree identities, the classifier digest, per-file reasons, selected checks, concrete tasks and a route: `maintenance`, `product`, `compare` or `blocked`. A `compare` plan is unresolved and cannot issue a passing scoped receipt.

For a package-sensitive change, use a new output path and resolve its comparison:

```bash
npm run ci:plan -- --base origin/main --head HEAD --compare --output /tmp/impact-compared.json
npm run ci:check -- --plan /tmp/impact-compared.json --task linux \
  --artifact /tmp/impact-compared.json.package/head.tgz --report /tmp/impact-linux.json
```

Run `ci:check` for each task ID that matches the actual platform and host. Pass `--artifact` for tasks that select `packaging`. Each task uses a new report path. CI acceptance requires an Actions execution identity. The complete local `npm run check` remains available and remains required during foundation validation and for core changes.

The package comparison exports each source independently, installs its locked dependencies with lifecycle scripts disabled, builds, verifies generation and packages it. It compares runtime members and modes, allowing only registered documentation, compiler metadata, version identity and presentation differences. Runtime expressions, entrypoints, dependencies and unregistered members remain significant. Neither package's commit or original bytes are rewritten. Comparison errors block; non-equivalent runtime output selects the product route.

## Evidence and promotion

Local receipts identify executed tasks, actual platform, commit and plan digest. Record results and limitations in the PR. Historical `ci-maintenance` and `ci-release-binding` readers follow their source-specific rules for the original product baseline, artifacts and jobs. The current release route reuses the original PR package through the equivalent merge and tag. [Release guide](../RELEASING.md#source-bound-ci-evidence-promotion).

## Validation and operation

For a newly scheduled scoped task the planner budgets the test files in the immutable head tree. Execution checks that the compiled file list matches. A serial family can start files for 15 minutes plus five seconds per file. Each admitted file gets its own 15-minute limit. Each task reserves build, setup, upload and cleanup time within the hosted job limit of 360 minutes.

The maintenance planner splits oversized tasks at check-family boundaries in the plan's original order. The first part keeps its task ID. Later parts get numbered suffixes such as `linux-2`. Every part keeps the original platform and host, with a receipt for its own checks. A check that exceeds the limit on its own blocks the plan. The immutable head selects the scheduling policy, so earlier sources retain their original task lists and receipt identities.

For changes to the installed acceptance runner, exercise the affected candidate in addition to the planned tool-family checks. Use the Windows ARM host with an x64 process when investigating emulation or shell startup. Record the actual package SHA-256 separately from the revision of the harness used for a comparison. [Installed language combinations](testing.md#installed-language-combinations).

Regression coverage includes the actual PR #181 PNG/JSON change set, mixed maintenance, product changes, dependency closure, renames, unknown files, skipped/draft jobs, package equivalence, immutable-base execution and complete-baseline → multiple-maintenance → tag/npm provenance. Fault cases include failed latest runs, expired or corrupted artifacts, wrong source identities and missing selected release evidence.

Keep routing decisions and original execution identities in job summaries and delivery records. Review actual execution counts and elapsed times; reused receipts are not new samples. Roll back scheduling through a normal reviewed PR if needed, retaining evidence readers and existing published identities. See [CI maintenance](ci-maintenance.md), [testing](testing.md) and [release preparation](../RELEASING.md).
