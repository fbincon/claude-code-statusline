# Component-instance rendering performance

**English** | [简体中文](performance-v2.0.0.zh-CN.md)

On 2026-10-11, frozen sources and the same frozen harness ran on one Linux x86_64 machine: 50 samples per case per round, three alternating rounds, separate cold/warm bytecode, **39,000** samples. Tables report medians of the three round P50/P95 values, in milliseconds.

Baseline: v1.13.0 (`22be134e0aa18083c9320bbcc6caf01ee77c8682`). Candidate: `86d8f32c650a67c5a223d5bc4b5aaf04fa514ede`. Python 3.14.4; Linux-7.0.0-38-generic-x86_64-with-glibc2.43.

The baseline is the actual latest release at development start. Later edits affect native UI, interface search/translations, management-command compatibility, documentation, validation tools and version metadata; they do not change measured Python rendering/collection logic. Complete samples, source archives and hashes remain in ignored `dist/validation/v2-performance`.

## Results and cost interpretation

Retain all 22 warm-bytecode and 27 cold-bytecode screening flags; this release does not claim zero default-path regression. The existing rule flags a case when every round has a slower P50 or P95 and its median delta exceeds the corresponding baseline round range (at least 0.0001 ms). This is screening, not a confidence interval. OS caches, scheduling and some concurrent functional validation were not isolated. Even the Python startup control, which imports no project code, is flagged; not every fluctuation can be attributed to composition.

The representation does add work. For the same four visible main metrics, changing the default selection in this harness stores four legacy type IDs versus twelve configured main instances, including disabled ones. JSON grows from 1,092 to 5,302 bytes, with the same five default subagent items. A separate 1,000-validation profile records 315,001 → 1,559,001 calls; per-instance option parsing and projections account for part of the extra work. Instrumented profiler times are not production wall-clock measurements.

Runtime collection modules are source-identical to the baseline. The harness still forbids repeated transcript reads or Git collection on hot cache hits. Separate regressions verify that repeated components reuse Git, branch-diff, usage and timer observations. Additional work concerns representation, validation, formatting and layout; copies do not double-count usage. These measured local costs are recorded and accepted for composition, without a cross-platform latency guarantee.

## Representative results

### warm

| Case | Baseline P50 / P95 | Candidate P50 / P95 | Δ P50 | Screening flag |
| --- | ---: | ---: | ---: | --- |
| `process/startup` | 13.5320 / 18.4936 | 14.4126 / 18.0353 | +0.8806 | * |
| `process/render_import` | 50.4868 / 62.0223 | 52.4645 / 62.6204 | +1.9777 |  |
| `small/render/en/ascii-auto/120` | 51.2616 / 61.8162 | 52.5820 / 63.9511 | +1.3204 | * |
| `large/render/zh-CN/unicode-explicit/40` | 52.8035 / 64.4860 | 56.8477 / 65.7203 | +4.0442 | * |
| `medium/agents/120` | 0.6828 / 0.7325 | 0.7104 / 0.7773 | +0.0276 | * |
| `large/agents/120` | 2.8009 / 2.9048 | 2.8588 / 2.9132 | +0.0579 |  |
| `large/transcript/cold` | 1613.2307 / 1648.3986 | 1630.3875 / 1658.2662 | +17.1568 |  |

### cold

| Case | Baseline P50 / P95 | Candidate P50 / P95 | Δ P50 | Screening flag |
| --- | ---: | ---: | ---: | --- |
| `process/startup` | 15.8983 / 21.7602 | 15.8671 / 22.4908 | -0.0312 |  |
| `process/render_import` | 218.2517 / 229.4721 | 221.8020 / 231.0201 | +3.5503 | * |
| `small/render/en/ascii-auto/120` | 223.8488 / 232.6426 | 227.6355 / 251.0537 | +3.7867 | * |
| `large/render/zh-CN/unicode-explicit/40` | 227.7925 / 236.6158 | 232.6485 / 242.8817 | +4.8560 | * |
| `medium/agents/120` | 0.6986 / 0.7915 | 0.7166 / 0.9116 | +0.0180 |  |
| `large/agents/120` | 2.7758 / 2.9310 | 2.8982 / 2.9693 | +0.1224 | * |
| `large/transcript/cold` | 1632.2363 / 1653.8736 | 1634.4976 / 1675.8278 | +2.2613 |  |

## Complete matrix

Small/medium/large fixtures contain 100/10,000/100,000 transcript rows, 0/8/32 Agents and 32/1,000/10,000 Git files. Main rows cover English/Chinese, automatic/explicit Unicode layouts and 40/120 columns. Setup and priming are excluded.

### warm

| Case | Baseline P50 / P95 | Candidate P50 / P95 | Δ P50 | Screening flag |
| --- | ---: | ---: | ---: | --- |
| `process/startup` | 13.5320 / 18.4936 | 14.4126 / 18.0353 | +0.8806 | * |
| `process/render_import` | 50.4868 / 62.0223 | 52.4645 / 62.6204 | +1.9777 |  |
| `small/transcript/cold` | 1.3082 / 1.7598 | 1.2855 / 1.3704 | -0.0227 |  |
| `small/transcript/warm` | 0.1246 / 0.1376 | 0.1250 / 0.1360 | +0.0004 |  |
| `small/transcript/append` | 0.2441 / 0.2807 | 0.2407 / 0.2839 | -0.0034 |  |
| `small/git/clean/miss` | 3.6569 / 3.9174 | 3.7259 / 4.0635 | +0.0690 |  |
| `small/git/clean/hit` | 0.0344 / 0.0562 | 0.0353 / 0.0528 | +0.0009 |  |
| `small/git/clean/expired` | 3.7197 / 4.0355 | 3.4704 / 3.9291 | -0.2493 |  |
| `small/git/dirty/miss` | 3.4228 / 3.6471 | 3.3226 / 3.4404 | -0.1002 |  |
| `small/git/dirty/hit` | 0.0337 / 0.0511 | 0.0318 / 0.0408 | -0.0019 |  |
| `small/git/dirty/expired` | 3.3361 / 3.5295 | 2.4591 / 3.1239 | -0.8770 |  |
| `small/render/en/ascii-auto/40` | 52.1930 / 61.3801 | 53.0762 / 64.4778 | +0.8832 | * |
| `small/render/en/ascii-auto/120` | 51.2616 / 61.8162 | 52.5820 / 63.9511 | +1.3204 | * |
| `small/render/en/unicode-explicit/40` | 54.4885 / 66.0888 | 55.6624 / 65.8908 | +1.1739 |  |
| `small/render/en/unicode-explicit/120` | 53.2719 / 63.9076 | 55.8030 / 66.2576 | +2.5311 |  |
| `small/render/zh-CN/ascii-auto/40` | 53.6613 / 64.2353 | 56.2706 / 65.1836 | +2.6093 |  |
| `small/render/zh-CN/ascii-auto/120` | 52.6935 / 63.7998 | 53.6128 / 65.9823 | +0.9193 | * |
| `small/render/zh-CN/unicode-explicit/40` | 52.6097 / 63.6156 | 54.9429 / 66.5267 | +2.3332 | * |
| `small/render/zh-CN/unicode-explicit/120` | 53.3187 / 63.1336 | 54.0212 / 66.4438 | +0.7025 |  |
| `small/agents/40` | 0.0006 / 0.0019 | 0.0004 / 0.0012 | -0.0002 |  |
| `small/agent_process/40` | 48.1444 / 59.6563 | 49.3120 / 60.6678 | +1.1676 | * |
| `small/agents/120` | 0.0003 / 0.0006 | 0.0004 / 0.0006 | +0.0001 |  |
| `small/agent_process/120` | 47.3453 / 58.6145 | 49.2462 / 60.9265 | +1.9009 | * |
| `medium/transcript/cold` | 149.2331 / 154.7185 | 150.0015 / 155.6007 | +0.7684 |  |
| `medium/transcript/warm` | 2.3491 / 2.7336 | 2.3343 / 2.7858 | -0.0148 |  |
| `medium/transcript/append` | 3.3865 / 4.7253 | 3.3900 / 3.8426 | +0.0035 |  |
| `medium/git/clean/miss` | 10.3746 / 12.6196 | 10.4536 / 12.8352 | +0.0790 |  |
| `medium/git/clean/hit` | 0.0334 / 0.0447 | 0.0360 / 0.0541 | +0.0026 |  |
| `medium/git/clean/expired` | 9.8934 / 12.6212 | 10.5578 / 12.7957 | +0.6644 |  |
| `medium/git/dirty/miss` | 10.6043 / 12.9360 | 10.2928 / 12.9281 | -0.3115 |  |
| `medium/git/dirty/hit` | 0.0348 / 0.0480 | 0.0254 / 0.0424 | -0.0094 |  |
| `medium/git/dirty/expired` | 10.6216 / 12.5512 | 10.2533 / 12.7258 | -0.3683 |  |
| `medium/render/en/ascii-auto/40` | 52.0365 / 63.2348 | 53.3087 / 64.6245 | +1.2722 |  |
| `medium/render/en/ascii-auto/120` | 52.8834 / 63.1371 | 53.5610 / 63.6009 | +0.6776 |  |
| `medium/render/en/unicode-explicit/40` | 53.5877 / 64.9496 | 55.9590 / 65.7536 | +2.3713 |  |
| `medium/render/en/unicode-explicit/120` | 53.2020 / 62.6266 | 54.0631 / 63.8958 | +0.8611 | * |
| `medium/render/zh-CN/ascii-auto/40` | 52.9437 / 61.4921 | 54.3747 / 65.3103 | +1.4310 | * |
| `medium/render/zh-CN/ascii-auto/120` | 52.9665 / 64.8993 | 54.4924 / 63.4939 | +1.5259 |  |
| `medium/render/zh-CN/unicode-explicit/40` | 53.0929 / 61.7506 | 54.8999 / 66.3251 | +1.8070 | * |
| `medium/render/zh-CN/unicode-explicit/120` | 52.8872 / 63.5950 | 56.0036 / 65.0768 | +3.1164 | * |
| `medium/agents/40` | 0.6598 / 0.6926 | 0.6693 / 0.6973 | +0.0095 | * |
| `medium/agent_process/40` | 51.3954 / 61.5139 | 52.7264 / 63.8334 | +1.3310 | * |
| `medium/agents/120` | 0.6828 / 0.7325 | 0.7104 / 0.7773 | +0.0276 | * |
| `medium/agent_process/120` | 52.3304 / 63.0964 | 52.5891 / 62.6987 | +0.2587 |  |
| `large/transcript/cold` | 1613.2307 / 1648.3986 | 1630.3875 / 1658.2662 | +17.1568 |  |
| `large/transcript/warm` | 24.4241 / 25.3128 | 24.2241 / 25.4776 | -0.2000 |  |
| `large/transcript/append` | 24.8095 / 25.5949 | 24.6546 / 25.2897 | -0.1549 |  |
| `large/git/clean/miss` | 36.2608 / 45.5955 | 28.7972 / 35.6248 | -7.4636 |  |
| `large/git/clean/hit` | 0.0232 / 0.0300 | 0.0212 / 0.0254 | -0.0020 |  |
| `large/git/clean/expired` | 31.7431 / 41.8937 | 22.9754 / 37.0096 | -8.7677 |  |
| `large/git/dirty/miss` | 33.8439 / 42.6527 | 26.3512 / 33.9239 | -7.4927 |  |
| `large/git/dirty/hit` | 0.0172 / 0.0215 | 0.0169 / 0.0220 | -0.0003 |  |
| `large/git/dirty/expired` | 36.1629 / 44.9402 | 25.0375 / 35.2827 | -11.1254 |  |
| `large/render/en/ascii-auto/40` | 51.6360 / 62.7162 | 54.1571 / 64.1137 | +2.5211 | * |
| `large/render/en/ascii-auto/120` | 51.1310 / 62.5033 | 52.3314 / 64.3826 | +1.2004 | * |
| `large/render/en/unicode-explicit/40` | 54.4440 / 64.7718 | 54.6544 / 65.2088 | +0.2104 |  |
| `large/render/en/unicode-explicit/120` | 53.7366 / 63.1479 | 54.0917 / 66.3940 | +0.3551 | * |
| `large/render/zh-CN/ascii-auto/40` | 54.4145 / 65.5908 | 54.2232 / 65.4594 | -0.1913 |  |
| `large/render/zh-CN/ascii-auto/120` | 52.3818 / 64.0863 | 54.6448 / 66.3255 | +2.2630 | * |
| `large/render/zh-CN/unicode-explicit/40` | 52.8035 / 64.4860 | 56.8477 / 65.7203 | +4.0442 | * |
| `large/render/zh-CN/unicode-explicit/120` | 53.2555 / 63.5000 | 54.3813 / 67.4831 | +1.1258 | * |
| `large/agents/40` | 2.6757 / 2.7427 | 2.7317 / 2.8192 | +0.0560 | * |
| `large/agent_process/40` | 58.1221 / 68.1913 | 59.3554 / 69.1574 | +1.2333 |  |
| `large/agents/120` | 2.8009 / 2.9048 | 2.8588 / 2.9132 | +0.0579 |  |
| `large/agent_process/120` | 59.2137 / 69.8420 | 59.8296 / 70.5540 | +0.6159 | * |

### cold

| Case | Baseline P50 / P95 | Candidate P50 / P95 | Δ P50 | Screening flag |
| --- | ---: | ---: | ---: | --- |
| `process/startup` | 15.8983 / 21.7602 | 15.8671 / 22.4908 | -0.0312 |  |
| `process/render_import` | 218.2517 / 229.4721 | 221.8020 / 231.0201 | +3.5503 | * |
| `small/transcript/cold` | 1.3096 / 1.3820 | 1.3023 / 1.3775 | -0.0073 |  |
| `small/transcript/warm` | 0.1272 / 0.1530 | 0.1258 / 0.1464 | -0.0014 |  |
| `small/transcript/append` | 0.2532 / 0.3008 | 0.2470 / 0.3074 | -0.0062 |  |
| `small/git/clean/miss` | 3.1105 / 3.8566 | 3.0495 / 3.9240 | -0.0610 |  |
| `small/git/clean/hit` | 0.0343 / 0.0564 | 0.0360 / 0.0871 | +0.0017 |  |
| `small/git/clean/expired` | 3.7872 / 4.1136 | 3.6688 / 4.0378 | -0.1184 |  |
| `small/git/dirty/miss` | 3.3787 / 3.6110 | 3.4347 / 3.9473 | +0.0560 |  |
| `small/git/dirty/hit` | 0.0201 / 0.0568 | 0.0484 / 0.0640 | +0.0283 | * |
| `small/git/dirty/expired` | 3.1154 / 3.8069 | 3.3062 / 3.6174 | +0.1908 |  |
| `small/render/en/ascii-auto/40` | 223.9176 / 232.4789 | 228.0035 / 238.7981 | +4.0859 |  |
| `small/render/en/ascii-auto/120` | 223.8488 / 232.6426 | 227.6355 / 251.0537 | +3.7867 | * |
| `small/render/en/unicode-explicit/40` | 225.9116 / 235.7116 | 231.4249 / 240.7370 | +5.5133 | * |
| `small/render/en/unicode-explicit/120` | 226.1583 / 236.1935 | 230.4856 / 239.2044 | +4.3273 | * |
| `small/render/zh-CN/ascii-auto/40` | 225.6799 / 236.3470 | 231.3199 / 243.0924 | +5.6400 | * |
| `small/render/zh-CN/ascii-auto/120` | 224.7072 / 235.1383 | 229.8796 / 240.0172 | +5.1724 | * |
| `small/render/zh-CN/unicode-explicit/40` | 226.0349 / 235.9026 | 230.2845 / 240.8125 | +4.2496 | * |
| `small/render/zh-CN/unicode-explicit/120` | 226.7557 / 237.2749 | 231.9687 / 241.9859 | +5.2130 | * |
| `small/agents/40` | 0.0004 / 0.0013 | 0.0004 / 0.0012 | +0.0000 |  |
| `small/agent_process/40` | 211.1693 / 221.7456 | 214.6955 / 225.1657 | +3.5262 | * |
| `small/agents/120` | 0.0006 / 0.0008 | 0.0006 / 0.0009 | +0.0000 |  |
| `small/agent_process/120` | 210.4412 / 222.1008 | 216.7788 / 224.9585 | +6.3376 | * |
| `medium/transcript/cold` | 150.6885 / 156.6395 | 150.4820 / 157.5608 | -0.2065 |  |
| `medium/transcript/warm` | 2.3421 / 2.8472 | 2.3473 / 2.7087 | +0.0052 |  |
| `medium/transcript/append` | 3.3787 / 3.8267 | 3.3887 / 3.8746 | +0.0100 |  |
| `medium/git/clean/miss` | 9.8895 / 12.6245 | 10.4304 / 12.6828 | +0.5409 |  |
| `medium/git/clean/hit` | 0.0338 / 0.0500 | 0.0298 / 0.0564 | -0.0040 |  |
| `medium/git/clean/expired` | 9.9925 / 12.7054 | 10.3925 / 13.1695 | +0.4000 |  |
| `medium/git/dirty/miss` | 10.3349 / 12.8402 | 10.2799 / 12.7291 | -0.0550 |  |
| `medium/git/dirty/hit` | 0.0262 / 0.0328 | 0.0634 / 0.0809 | +0.0372 |  |
| `medium/git/dirty/expired` | 9.9906 / 12.5399 | 10.2728 / 12.5558 | +0.2822 |  |
| `medium/render/en/ascii-auto/40` | 222.5409 / 233.1678 | 226.9793 / 238.1783 | +4.4384 | * |
| `medium/render/en/ascii-auto/120` | 222.1091 / 231.7014 | 228.2584 / 237.3034 | +6.1493 |  |
| `medium/render/en/unicode-explicit/40` | 228.6153 / 239.9383 | 230.4758 / 243.6403 | +1.8605 |  |
| `medium/render/en/unicode-explicit/120` | 226.7786 / 235.9142 | 231.7309 / 245.4412 | +4.9523 | * |
| `medium/render/zh-CN/ascii-auto/40` | 226.5263 / 236.0052 | 232.9009 / 244.1002 | +6.3746 | * |
| `medium/render/zh-CN/ascii-auto/120` | 224.2846 / 233.8192 | 229.2370 / 238.4196 | +4.9524 | * |
| `medium/render/zh-CN/unicode-explicit/40` | 225.9274 / 236.7282 | 231.4386 / 242.2392 | +5.5112 | * |
| `medium/render/zh-CN/unicode-explicit/120` | 226.8339 / 237.1533 | 231.7873 / 243.1181 | +4.9534 | * |
| `medium/agents/40` | 0.6491 / 0.9891 | 0.6699 / 0.6851 | +0.0208 |  |
| `medium/agent_process/40` | 220.3363 / 232.9179 | 221.2144 / 231.3709 | +0.8781 |  |
| `medium/agents/120` | 0.6986 / 0.7915 | 0.7166 / 0.9116 | +0.0180 |  |
| `medium/agent_process/120` | 218.7934 / 232.3483 | 220.6250 / 232.5738 | +1.8316 |  |
| `large/transcript/cold` | 1632.2363 / 1653.8736 | 1634.4976 / 1675.8278 | +2.2613 |  |
| `large/transcript/warm` | 24.8209 / 25.6355 | 24.5877 / 25.2383 | -0.2332 |  |
| `large/transcript/append` | 25.0275 / 26.2693 | 24.7165 / 25.1729 | -0.3110 |  |
| `large/git/clean/miss` | 36.9708 / 45.6939 | 32.7209 / 45.0215 | -4.2499 |  |
| `large/git/clean/hit` | 0.0175 / 0.0413 | 0.0176 / 0.0396 | +0.0001 |  |
| `large/git/clean/expired` | 30.8109 / 41.4712 | 32.2767 / 42.6997 | +1.4658 |  |
| `large/git/dirty/miss` | 30.6030 / 40.9576 | 33.1771 / 43.6090 | +2.5741 |  |
| `large/git/dirty/hit` | 0.0171 / 0.0251 | 0.0173 / 0.0255 | +0.0002 |  |
| `large/git/dirty/expired` | 33.1465 / 45.2533 | 33.2426 / 42.8596 | +0.0961 |  |
| `large/render/en/ascii-auto/40` | 223.0447 / 236.4306 | 228.0366 / 237.1929 | +4.9919 |  |
| `large/render/en/ascii-auto/120` | 220.5279 / 232.5416 | 227.0426 / 236.6529 | +6.5147 | * |
| `large/render/en/unicode-explicit/40` | 226.3077 / 234.9066 | 228.9748 / 240.7350 | +2.6671 | * |
| `large/render/en/unicode-explicit/120` | 225.0774 / 235.2093 | 231.2652 / 240.1950 | +6.1878 | * |
| `large/render/zh-CN/ascii-auto/40` | 227.3846 / 237.3416 | 231.9502 / 241.6532 | +4.5656 | * |
| `large/render/zh-CN/ascii-auto/120` | 225.1025 / 239.1362 | 229.6188 / 240.4246 | +4.5163 | * |
| `large/render/zh-CN/unicode-explicit/40` | 227.7925 / 236.6158 | 232.6485 / 242.8817 | +4.8560 | * |
| `large/render/zh-CN/unicode-explicit/120` | 226.7353 / 236.4533 | 231.3488 / 243.0393 | +4.6135 | * |
| `large/agents/40` | 2.6145 / 2.6852 | 2.7323 / 2.8167 | +0.1178 | * |
| `large/agent_process/40` | 225.4770 / 234.2070 | 228.6495 / 236.6344 | +3.1725 |  |
| `large/agents/120` | 2.7758 / 2.9310 | 2.8982 / 2.9693 | +0.1224 | * |
| `large/agent_process/120` | 223.8637 / 234.6272 | 228.6603 / 240.2576 | +4.7966 | * |

## Reproducibility receipts

| File | SHA256 |
| --- | --- |
| `comparison.json` | `c928ac05ecf832cdb525a2c3158803a90542d455c3c3ecc76b46f043d68102cb` |
| `configuration-profile.json` | `0b4181625aeb0ef59e5d7c430b5eac05a1ff20d32bce0122d9800bf9d1e21099` |
| `baseline.zip` | `976765fdf3406ba1e8730f07f64086144f3971b9f8ca369c4bec09ee51e94ce7` |
| `candidate.zip` | `621618086ad74e5e9f08394396b2c21e0ca1f2436779e9869e55a2b1cd5e81c0` |
| `harness/benchmark_compare.py` | `b4eea9900e6bd492d015e9809238923bf76bb6d7e514a550b92241bb120b4b9d` |
| `harness/benchmark_render.py` | `41d0957b0c28f1b7ce4135ba3e56e8397c01d847b7934634c9c89130b4b55e93` |
| `harness/benchmarking/__init__.py` | `8f3bc101757778615701971cca37ad2361160f054ced412ae2b7279f09601972` |
| `harness/benchmarking/render.py` | `f89a4bbd3dced75fd0e9cadcd82730167b379c596d25b9f564158b54c5e3db85` |
| `harness/benchmarking/source.py` | `8dacbf0818860495ec39667d8f9c799b7687d3806f70fbb593f8566dfcf53e59` |

```sh
python tools/benchmark_compare.py --baseline v1.13.0 --candidate 86d8f32c650a67c5a223d5bc4b5aaf04fa514ede --samples 50 --rounds 3 --report-dir dist/validation/new-comparison
```

## Opt-in component costs

Frozen source `76b3d07`, 50 samples per case/mode, 10,000 additional samples. Fixtures use a local synthetic Git repository/transcript, four subagent token instances and eight main input-token instances, without model calls. Process columns include startup, configuration loading and rendering; refresh measures subagent rendering in one process. These are observations across candidate configurations in one ordered round, not causal or statistical-significance claims. Full raw reports are retained; representative narrow and 32-Agent cases follow.

### warm

| Case | P50 / P95 (ms) |
| --- | ---: |
| `default/en/40/main/process` | 58.9603 / 69.4795 |
| `default/zh-CN/120/main/process` | 59.4587 / 68.8011 |
| `default/en/40/32/process` | 54.2846 / 64.4529 |
| `default/en/40/32/refresh` | 1.8932 / 1.9787 |
| `single/en/40/main/process` | 54.6301 / 64.0369 |
| `single/zh-CN/120/main/process` | 56.5270 / 67.2957 |
| `single/en/40/32/process` | 54.1092 / 65.1912 |
| `single/en/40/32/refresh` | 1.8933 / 1.9386 |
| `repeated/en/40/main/process` | 55.2212 / 67.7306 |
| `repeated/zh-CN/120/main/process` | 55.2691 / 66.4402 |
| `repeated/en/40/32/process` | 54.3381 / 63.6142 |
| `repeated/en/40/32/refresh` | 2.2892 / 2.3544 |
| `aligned/en/40/main/process` | 57.0662 / 66.6646 |
| `aligned/zh-CN/120/main/process` | 57.0070 / 66.7979 |
| `aligned/en/40/32/process` | 54.8935 / 65.9559 |
| `aligned/en/40/32/refresh` | 1.6762 / 2.1844 |
| `powerline/en/40/main/process` | 58.3269 / 68.0986 |
| `powerline/zh-CN/120/main/process` | 56.9109 / 66.9829 |
| `powerline/en/40/32/process` | 70.1357 / 80.0683 |
| `powerline/en/40/32/refresh` | 15.3500 / 15.4771 |

### cold

| Case | P50 / P95 (ms) |
| --- | ---: |
| `default/en/40/main/process` | 251.6995 / 264.1827 |
| `default/zh-CN/120/main/process` | 249.7144 / 264.2033 |
| `default/en/40/32/process` | 221.2978 / 232.5183 |
| `default/en/40/32/refresh` | 1.8733 / 1.9141 |
| `single/en/40/main/process` | 239.5261 / 248.7338 |
| `single/zh-CN/120/main/process` | 241.9144 / 253.2851 |
| `single/en/40/32/process` | 223.2996 / 233.3818 |
| `single/en/40/32/refresh` | 1.8910 / 1.9359 |
| `repeated/en/40/main/process` | 242.8032 / 253.8032 |
| `repeated/zh-CN/120/main/process` | 245.0422 / 253.0544 |
| `repeated/en/40/32/process` | 226.4837 / 238.8121 |
| `repeated/en/40/32/refresh` | 2.2977 / 2.3158 |
| `aligned/en/40/main/process` | 234.6198 / 248.0696 |
| `aligned/zh-CN/120/main/process` | 235.9081 / 248.1754 |
| `aligned/en/40/32/process` | 227.1758 / 237.2584 |
| `aligned/en/40/32/refresh` | 1.6383 / 1.7029 |
| `powerline/en/40/main/process` | 237.0352 / 245.0011 |
| `powerline/zh-CN/120/main/process` | 236.8713 / 249.4824 |
| `powerline/en/40/32/process` | 240.5017 / 251.3653 |
| `powerline/en/40/32/refresh` | 15.3726 / 15.5439 |

| File | SHA256 |
| --- | --- |
| `opt-in/warm.json` | `17754ee9dccabe93c7b8f0ac3936a15c19cfbc377d8856c2e172efae60c91550` |
| `opt-in/cold.json` | `5f64b589fc5ec665613ffdfc0e1194788db6ee8e0ee411eed75877d090cbd85e` |
| `benchmark_sha256` | `0f2fc45bab1da0627870ab0222b2443f87bc25878dd934f0b96a127707c7e339` |
| `fixture_source_sha256` | `e7f554f31e1fb2803eb7ca03322a2b098f57ea2e5acb0108239490a50098437a` |
| `shared_fixture_sha256` | `f89a4bbd3dced75fd0e9cadcd82730167b379c596d25b9f564158b54c5e3db85` |

```sh
python tools/benchmark_render.py --suite composition --samples 50 --bytecode-mode warm --source-root FROZEN_SOURCE --source-commit 76b3d076694130618f36766380e39a7a75f569da --report dist/validation/new-composition-warm.json
# Repeat with --bytecode-mode cold and a different report path.
```
