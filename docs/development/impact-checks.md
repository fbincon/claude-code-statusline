# Impact checks and maintenance evidence

**English** | [简体中文](impact-checks.zh-CN.md)

## Staged adoption

Scoped scheduling is enabled after the compatibility foundation passed the complete PR matrix and independently verified main promotion. The required checks now follow the impact plan. This migration creates no product version, release tag, npm publication or installed-product change.

The required check remains **Complete candidate evidence**. Its name identifies the protected aggregate, not a claim that every route executed the complete product matrix. The aggregate verifies each route's required jobs and intentional skips. Drafts and manual diagnostics cannot create promotable acceptance.

## Responsibilities and checks

The classifier reads both immutable Git trees, including additions, deletions, modes and both sides of renames. It does not use PR titles, labels or a maintainer's informal classification. Core behavior includes the CLI, platform effects, external editor and Mods as well as `packages/core`.

| Responsibility | Required checks |
| --- | --- |
| Maintained documentation and community templates | Links, anchors, bilingual counterparts, template structure and whitespace |
| Documentation media and JSON records | Referenced files, media framing, PNG CRC/decompression/dimensions and inspectable capture hashes |
| Translation values, human-help value slots and registered theme colors | Message keys/placeholders, exact resource generation, relevant core/CLI/TUI tests, applicable Native host tests and package/installation checks |
| Tests and shared fixtures | Registered consuming test families and applicable platform/host combinations |
| Check, workflow, Action and release policy | Workflow identities and check/release contract tests, including failure cases |
| Benchmarks, acceptance and development tools | Tool-family tests and relevant system checks |
| Build/generation inputs, development dependencies and export settings | Actual package comparison, generation/build tests and three-platform installation smoke |
| Product logic, protocols, runtime dependencies and bundled skill instructions | Existing complete product matrix |

Documentation checks run on Linux. Pure core tests run on Linux; platform, application, terminal and tooling families retain Linux, Windows and macOS executions. Mod checks use the existing fixed host inventory for the affected Mod; unsupported Runtime hosts are excluded rather than reported as passes. Scoped host jobs run official validation/tests and available exact-host declarations without running unrelated installation/runtime matrices. The existing Claude 2.1.296 declaration gap remains explicit.

Several categories combine by taking the union of checks. Unknown responsibilities, unsupported file types, ambiguous modes or unreadable revisions block with a classification diagnostic. They never automatically select the expensive product matrix. Frozen archive changes still face archive integrity checks.

Static production imports override a test/tool/document directory label, including inlined compile-time inputs; those changes require actual package comparison. Generated fixtures always select generation checks. Descriptive workspace metadata is compared without ignoring entrypoints, dependencies or executable package contracts. A non-reused batched push checks its actual push range, so an earlier core change cannot hide behind the last documentation commit.

Only existing locale keys/placeholders, registered human-help literal value slots and theme value slots qualify as presentation data. Help command selectors, property keys, control flow, executable expressions and terminal control characters remain significant. Changed language registration, keys or defaults remain product changes. Generated copies must match their canonical sources exactly. Product `SKILL.md` files are executable instructions, not ordinary documentation. Comment/format/type-only changes require equivalent emitted operations and an actual package comparison.

Dependency classification follows the runtime closure from the four business workspaces, including optional dependencies and linked workspace dependencies. A lockfile's `dev` flag alone cannot remove a runtime dependency from this closure.

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

For a plan without packaging, omit `--artifact`. Use the task ID and actual platform from the plan; a Linux execution cannot issue a Windows/macOS receipt. Local receipts have no Actions execution identity and cannot replace CI acceptance. Each run uses a new report path. The complete local `npm run check` remains available and remains required during foundation validation and for core changes.

The package comparison exports each source independently, installs its locked dependencies with lifecycle scripts disabled, builds, verifies generation and packages it. It compares runtime members and modes, allowing only registered documentation, compiler metadata, version identity and presentation differences. Runtime expressions, entrypoints, dependencies and unregistered members remain significant. Neither package's commit or original bytes are rewritten. Comparison errors block; non-equivalent runtime output selects full product acceptance.

## Evidence and promotion

The original `ci-evidence.json`, `sourceHashes()` and `policyDigest()` contracts retain their historical meanings. `ci-maintenance` is a separate envelope containing the impact plan, actual scoped receipts, original artifact identities and a product-baseline ancestry reference. It does not claim a fresh complete matrix. Receipt checks bind the exact commit, plan, target, checks, runtime, Actions run/attempt and execution interval. Artifact selection preserves the newest-artifact and latest-applicable-run rules.

A normal equivalent two-parent main merge reuses the final PR's maintenance evidence. The actual accepted first parent exports its own verifier code into an isolated directory and installs that parent's integrity-pinned parser/archive dependencies. That code rechecks source, merge, checks and any package comparison; current candidate compiler outputs are never restored over the verifier. A changed base/tree or unsupported integration cannot borrow the old receipt: the actual main difference is classified and checked again. Ambiguous provenance blocks.

Ordinary maintenance does not download an old product candidate merely to update documentation or tools. Release reuse follows the recorded maintenance ancestry to an available complete product baseline. Every required envelope, original execution and artifact must still be valid; expired/corrupt/missing evidence or a latest failed run blocks reuse. A previous green run and manual diagnostic cannot substitute. Existing 30-day evidence retention is unchanged.

A maintenance-source tag builds its **own** package, source archive, manifest and checksums. Two independent builds and a source-archive rebuild must agree. Linux/Windows/macOS installation smoke exercises those new bytes. The already accepted first-parent main verifier independently compares original and new runtime payloads; current source-bound release approval is checked separately. Release-selection/binding schema 2 records that verifier commit/run separately from original complete product acceptance. This permits validated policy maintenance without rerunning the product matrix or changing historical per-source input digests. `ci-release-binding` records current checks and original reused coverage, with distinct source/package identities. npm resolves this binding and publishes only the verified current-tag package. The tag, package source and OIDC provenance must agree.

Existing complete-source tags and historical npm releases retain their existing reader. Published tags and assets are never changed to test the new route. A dry-run checks preparation and bytes; it does not establish a new publication or validate a new trusted-publisher binding.

## Validation and operation

Regression coverage includes the actual PR #181 PNG/JSON change set, mixed maintenance, product changes, dependency closure, renames, unknown files, skipped/draft jobs, package equivalence, immutable-base execution and complete-baseline → multiple-maintenance → tag/npm provenance. Fault cases include failed latest runs, expired or corrupted artifacts, wrong source identities and missing selected release evidence.

Keep routing decisions and original execution identities in job summaries and delivery records. Review actual execution counts and elapsed times; reused receipts are not new samples. Roll back scheduling through a normal reviewed PR if needed, retaining evidence readers and existing published identities. See [CI maintenance](ci-maintenance.md), [testing](testing.md) and [release preparation](../RELEASING.md).
