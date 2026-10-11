# v1.13.0 language performance

**English** | [简体中文](performance-v1.13.0.zh-CN.md)

Adding three complete language packs leaves default English/Chinese statusline process time within the repeated-round noise screen in the warm measurements. The work has measurable editor costs: Python index preparation is about 10 ms, native translation/search module import adds about 19 ms, and five-language queries cost about 0.4–0.5 ms more than two-language queries. These are retained costs, not a claim of zero overhead. The isolated two-language implementation has faster prepared queries than the two-language baseline.

## Method and limits

Measured on 2026-10-11, Linux x86_64, Python 3.14.4 and Node v22.23.2. Baseline is v1.12.0 (`ee28dec10a07a1f175d11895f0afe7fb56e8752b`); runtime candidate is `1134aee5425ed50fa0ca936321abb246e011b6b0`. Sources are exported from fixed Git commits and verified by content digest after each batch. Later changes add validation tools, tests and documentation; the measured runtime files remain unchanged.

Each mode has three alternating variant-order rounds and 30 fresh-process samples per operation: 3,600 warm and 3,240 corrected cold samples. Tables show the median of the three round P50/P95 values, in milliseconds. `*` uses the existing review screen: every candidate round must be slower at P50 or P95 and the median difference must exceed the corresponding baseline round range (minimum 0.0001 ms). It is a noise screen, not a statistical confidence interval. OS filesystem caches and CPU scheduling remain uncontrolled; these are local measurements, not cross-platform guarantees.

Warm workers prime isolated bytecode caches outside timing. The initial report's cold section incorrectly shared those caches and is **discarded**. Corrected cold workers use a separate empty bytecode tree, disable writes and assert the tree stays absent; this includes recompiling standard-library bytecode, not only package files. The corrected cold report is the only cold source below. No builds or test suites overlap the measured rounds.

CLI render probes use fixed 120-column data with a context item and one sample agent; English/Chinese main and subagent output hashes remain identical to the baseline. A lookup microprobe remains roughly 0.4–0.5 μs per call; raw values are retained in the report. Search probes use 24 queries over English, both Chinese forms, Japanese, Korean and stable IDs. New packs therefore provide additional matches; the candidate-2 control separates implementation changes from this extra work. Python process search totals include preparation and all 24 queries. Node measures TypeScript translation/search module loading and querying, **not full Claude Client startup**.

## Warm process times

| Scenario | v1.12.0 P50 / P95 | Five languages P50 / P95 | Review |
| --- | ---: | ---: | --- |
| `help/en` | 66.674 / 73.196 | 66.132 / 75.184 |  |
| `help/zh-CN` | 66.897 / 79.444 | 67.205 / 76.401 |  |
| `render/en` | 51.696 / 61.590 | 52.562 / 62.260 |  |
| `render/zh-CN` | 52.861 / 62.421 | 53.000 / 63.147 |  |
| `subagents/en` | 50.693 / 62.443 | 50.945 / 62.219 |  |
| `subagents/zh-CN` | 52.015 / 63.675 | 52.448 / 61.352 |  |
| `search/en` | 92.708 / 100.831 | 113.855 / 120.708 | * |

## Corrected cold process times

| Scenario | v1.12.0 P50 / P95 | Five languages P50 / P95 | Review |
| --- | ---: | ---: | --- |
| `help/en` | 265.030 / 276.338 | 267.839 / 275.754 | * |
| `help/zh-CN` | 265.882 / 278.385 | 267.682 / 277.802 |  |
| `render/en` | 222.561 / 233.173 | 220.730 / 234.245 |  |
| `render/zh-CN` | 224.591 / 234.118 | 225.197 / 234.663 |  |
| `subagents/en` | 217.006 / 229.196 | 217.439 / 229.273 |  |
| `subagents/zh-CN` | 217.482 / 226.850 | 215.965 / 227.216 |  |
| `search/en` | 279.259 / 287.154 | 301.662 / 312.978 | * |

Cold English CLI help retains a repeatable P50 increase of 2.81 ms (about 1.1%), while its P95 is slightly lower. The candidate-2 control adds 1.13 ms at P50, so part of this cost exists even without additional packs. Registry/import setup is a plausible contributor; the remaining difference is not precisely attributed, and these controls do not establish all-pack loading. Main/subagent process results do not pass the regression screen in either mode.

## Search and resource scaling

Ten-language fixtures append qaa–qae copied from English; they measure resource volume only and are never shipped. Identical strings may share storage or compress differently from real translations. Both two- and ten-language variants use temporary registered/generated resources.

| Metric | Baseline 2 | Candidate 2 | Candidate 5 | Candidate 10 | Review 5 vs baseline |
| --- | ---: | ---: | ---: | ---: | --- |
| `search/en prepare_ms` | 0.030 / 0.034 | 5.619 / 5.733 | 10.198 / 10.344 | 14.755 / 15.028 | * |
| `search/en query_ms` | 1.251 / 1.272 | 0.923 / 0.945 | 1.762 / 1.783 | 3.574 / 3.626 | * |
| `node-search/en import_ms` | 67.806 / 69.226 | 66.833 / 67.504 | 87.003 / 88.649 | 111.021 / 113.306 | * |
| `node-search/en prepare_ms` | 0.349 / 0.378 | 3.528 / 3.733 | 6.181 / 7.344 | 6.737 / 7.414 | * |
| `node-search/en query_ms` | 1.125 / 1.213 | 0.879 / 0.967 | 1.498 / 1.632 | 3.063 / 3.257 | * |

The five-language query P50 stays below 2 ms in both implementations; the synthetic ten-language query stays below 4 ms. Prebuilding shifts work into opening the editor, removes resource translation from each keystroke and keeps custom-label invalidation local. Native static resources intentionally grow with the registry; runtime dependency loading was not introduced.

| Variant | Wheel bytes | Python i18n bytes | Native i18n bytes | Python render peak MiB | Python search peak MiB | Node search peak MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline-2` | 469,234 | 244,489 | 210,267 | 22.55 | 23.99 | 95.85 |
| `candidate-2` | 471,998 | 241,873 | 210,625 | 22.56 | 24.10 | 96.00 |
| `candidate-5` | 638,606 | 621,503 | 562,332 | 22.54 | 25.32 | 106.14 |
| `candidate-10` | 881,317 | 1,196,931 | 1,094,582 | 22.56 | 26.59 | 123.41 |

Wheel sizes are independently built from the fixed sources, with UI contracts regenerated for temporary variants. They exclude later documentation-only additions; wheel runtime contents are compared again during final release building. Python and native resource columns count source bytes; gzip sizes and per-process raw measurements remain in the raw reports. Python peak values use `/proc/self/status` `VmHWM`, with 30 processes per operation/variant (360 probes). The timed harness's `getrusage` Python readings inherited a parent RSS high-water floor and are not used for Python memory conclusions. Node uses its own recorded process RSS. Memory probes/builds run separately from timing.

The wheel grows from 469,234 to 638,606 bytes (+169,372, about 36%). Python default render mapped memory is about 22.55 MiB across all four variants, while search rises by about 1.34 MiB from baseline to five languages. Native module/search process peak grows by about 10.3 MiB. These are isolated process measurements and do not establish the total Claude host memory footprint. Main/subagent rendering imports only the selected generated language module; no interface JSON is read on that path.

## Reproduce and audit

```bash
python tools/benchmark_i18n.py --baseline v1.12.0 --candidate 1134aee5425ed50fa0ca936321abb246e011b6b0 --samples 30 --rounds 3 --output dist/validation/i18n-repeat.json
python tools/benchmark_i18n_resources.py --candidate 1134aee5425ed50fa0ca936321abb246e011b6b0 --samples 30 --output dist/validation/i18n-resources-repeat.json
```

Run time and resource commands sequentially. The retained warm run used the earlier harness, while the corrected cold run used the explicit cache-isolation fix. Exact harness hashes:

- Warm: `16f3377ece0971204291806afa4480de7ef85a66719193055083e2ff38d91493`.
- Corrected cold: `9723dc5755c6c883d95389d7977534e558b89429bf0ed2d73ba2008592a76a17`.
- Resource/memory: `59ed0a2bef0a5dfa7ea3381efd6c25056dc311b63c8aa7291b2fa0703b07a4d8`.

| Runtime variant | Source digest |
| --- | --- |
| `baseline-2` | `436c81789d6095850bf057ba2d3c0195608609c0e50312c304f30ee5b44a2d93` |
| `candidate-2` | `4202c81fb56a55d129a09e3f299961ee38c095a775de24ef4292b9731b8cb675` |
| `candidate-5` | `50a82875efba701c3dd03aae777789097c5065c19008ecc5b408579e675316d8` |
| `candidate-10` | `21a593b54933ad910380d22c8b8c97a95a1a3fc00c15bad31ea5bb58dca97ddb` |

Raw receipts remain in ignored `dist/validation`; they are not added to distributions. Their hashes identify the exact observations, including the discarded cold section in the first file.

| Receipt | SHA256 |
| --- | --- |
| `i18n-performance-final.json` | `4f6455dbfa18aac4679e52b0a01ed49a34d50567c643f2118b17c790d503a623` |
| `i18n-performance-cold-corrected.json` | `037d98239047daa3173dae491bab9d6890f5e600053d46f116a8275cc36b36c4` |
| `i18n-resources-final.json` | `0ab94958c092b789f4a50c4b3114a089e09ea2a42786837710ec169fe2c737f4` |
