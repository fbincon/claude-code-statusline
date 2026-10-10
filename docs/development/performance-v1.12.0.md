# v1.12.0 rendering performance comparison

**English** | [简体中文](performance-v1.12.0.zh-CN.md)

Measurement host: 13th Gen Intel(R) Core(TM) i5-13500H, 16 logical CPUs, approximately 14.9 GiB RAM; Linux x86_64 / CPython 3.14.4.

The same Linux x86_64 host, CPython 3.14.4, frozen harness and synthetic fixtures run three alternating rounds, 50 samples per case per round, with separate cold/warm bytecode: 39,000 raw samples. Values below are medians of the three round P50/P95 values, in milliseconds. OS filesystem caches are uncontrolled; transcript/Git cold, miss and expired describe application data caches only.

Baseline: `07263113529d86dc6feb54e1fb9c533fe69f4974`. Candidate: `f1dea4740f72416a20621deff1b7422cc8eb9248`.

After the measured runtime was frozen, later changes were limited to documentation, tests, acceptance tools and release version metadata. Raw samples and round reports are retained under ignored `dist/validation/v1.12/comparison-final`.

## Results and investigation

The full matrix retains 19 screening flags. Supplemental controls use the same frozen sources and original operations, `PYTHONHASHSEED=0`, three alternating rounds and 50 measurements per selected case: 6,900 selected samples. Other original cases execute one setup/priming sample and are excluded from these statistics. This is not a replacement full matrix or proof that hash randomization caused the differences.

The original main-render, empty-agent and transcript flags did not remain beyond baseline round variation in the controls. Default in-process refresh retains a small repeatable cost: approximately 0.026–0.034 ms P50 for eight agents and 0.1172–0.1822 ms for 32 agents with warm bytecode. Controlled cold import increases by 6.0146 ms (220.8859 → 226.9005 ms); the process-only startup control, which imports no project code, also increases by 0.7249 ms. Import differences include environmental variation and initialization work and cannot be attributed entirely to one feature. These costs are retained; the release does not claim zero default-path regression.

Untimed call-count diagnostics are separate from the timing statistics: both 32-agent sources call `options_for` 160 times and generated constructors 192 times; the candidate adds 32 `legacy_fitting` checks and carries the new option fields. Large-history sources perform the same 306,400 JSON decodes and collector call counts. Collector source is byte-identical to the baseline, and all no-repeat-read/no-extra-Git hot-cache assertions pass. Expanded records and checks in the default path are consistent with the small overhead; fresh imports also include Python compilation and process noise.

The table retains every selected control, including the newly flagged startup/import controls. Raw matrices, controls, diagnostics and feature samples remain under ignored `dist/validation/v1.12`. These small local costs are accepted for this feature release; opt-in feature costs are listed separately below.

| Controlled case | Baseline P50 / P95 | Candidate P50 / P95 | Flag |
| --- | ---: | ---: | --- |
| `warm/process/startup` | 16.0944 / 23.4604 | 15.4223 / 22.1106 |  |
| `warm/process/render_import` | 51.2989 / 66.2297 | 53.4396 / 63.0965 |  |
| `warm/small/transcript/warm` | 0.2483 / 0.3170 | 0.2025 / 0.2550 |  |
| `warm/small/render/en/ascii-auto/120` | 53.8653 / 67.4336 | 54.1138 / 65.5051 |  |
| `warm/small/render/zh-CN/unicode-explicit/40` | 54.4968 / 64.7082 | 54.4509 / 63.1837 |  |
| `warm/small/agent_process/40` | 48.2680 / 57.2887 | 49.6430 / 62.3408 |  |
| `warm/medium/render/en/unicode-explicit/120` | 54.4348 / 66.5858 | 55.1879 / 65.0964 |  |
| `warm/medium/agents/40` | 0.6226 / 0.6621 | 0.6562 / 0.6764 | * |
| `warm/medium/agents/120` | 0.6602 / 0.7199 | 0.6904 / 0.7178 | * |
| `warm/large/transcript/cold` | 1642.3244 / 1700.6054 | 1661.2590 / 1746.8915 |  |
| `warm/large/agents/40` | 2.5313 / 2.5893 | 2.7135 / 2.8256 | * |
| `warm/large/agents/120` | 2.7120 / 2.9354 | 2.8292 / 2.8993 | * |
| `cold/process/startup` | 16.0345 / 24.5176 | 16.7594 / 28.5442 | * |
| `cold/process/render_import` | 220.8859 / 249.5240 | 226.9005 / 257.0269 | * |
| `cold/small/transcript/append` | 0.2580 / 0.3435 | 0.2626 / 0.3263 |  |
| `cold/small/render/en/unicode-explicit/120` | 227.3755 / 248.8754 | 230.2118 / 246.8486 |  |
| `cold/small/render/zh-CN/ascii-auto/40` | 233.1301 / 253.8691 | 231.0306 / 248.7172 |  |
| `cold/medium/transcript/warm` | 2.2971 / 2.3940 | 2.2921 / 2.4240 |  |
| `cold/medium/agents/40` | 0.6242 / 0.6396 | 0.6497 / 0.6586 | * |
| `cold/medium/agents/120` | 0.6620 / 0.6943 | 0.6898 / 0.7440 | * |
| `cold/large/render/en/ascii-auto/120` | 226.4950 / 248.6798 | 226.8300 / 240.3990 |  |
| `cold/large/agent_process/40` | 226.1520 / 254.9592 | 225.9585 / 243.5792 |  |
| `cold/large/agents/120` | 2.7392 / 2.8639 | 2.8075 / 2.9506 |  |

## Scenarios

`small`/`medium`/`large` contain 100/10,000/100,000 transcript rows, 0/8/32 agents and 32/1,000/10,000 Git files. Agents include nested records and distinct long Unicode text. `agents` measures refreshes in one process; `agent_process` measures fresh official CLI processes. Main rows cover English/Chinese, ASCII automatic/Unicode explicit layouts and 40/120 columns. Setup is excluded; warm-cache assertions forbid repeated transcript reads or Git collection.

## Warm bytecode

| Scenario | Baseline P50 / P95 | Candidate P50 / P95 | P50 delta | Review flag |
| --- | ---: | ---: | ---: | --- |
| `process/startup` | 14.6518 / 18.1901 | 14.7665 / 19.1791 | +0.1147 |  |
| `process/render_import` | 52.9881 / 65.5630 | 52.0663 / 64.2023 | -0.9218 |  |
| `small/transcript/cold` | 1.3058 / 1.6954 | 1.2993 / 2.6288 | -0.0065 |  |
| `small/transcript/warm` | 0.1249 / 0.1482 | 0.1268 / 0.1448 | +0.0019 | * |
| `small/transcript/append` | 0.2456 / 0.2886 | 0.2443 / 0.2949 | -0.0013 |  |
| `small/git/clean/miss` | 3.8641 / 4.2602 | 3.7473 / 4.1484 | -0.1168 |  |
| `small/git/clean/hit` | 0.0368 / 0.0490 | 0.0366 / 0.0533 | -0.0002 |  |
| `small/git/clean/expired` | 3.9750 / 4.3204 | 3.7697 / 4.0907 | -0.2053 |  |
| `small/git/dirty/miss` | 3.9466 / 4.1753 | 3.7645 / 4.0858 | -0.1821 |  |
| `small/git/dirty/hit` | 0.0357 / 0.0701 | 0.0362 / 0.0781 | +0.0005 |  |
| `small/git/dirty/expired` | 3.7423 / 4.1817 | 3.7557 / 4.1759 | +0.0134 |  |
| `small/render/en/ascii-auto/40` | 52.3766 / 64.6098 | 53.1871 / 63.3826 | +0.8105 |  |
| `small/render/en/ascii-auto/120` | 50.9698 / 61.7338 | 53.8037 / 64.9998 | +2.8339 | * |
| `small/render/en/unicode-explicit/40` | 54.9558 / 65.0377 | 52.0224 / 64.4697 | -2.9334 |  |
| `small/render/en/unicode-explicit/120` | 54.4433 / 65.7497 | 54.6519 / 65.3929 | +0.2086 |  |
| `small/render/zh-CN/ascii-auto/40` | 52.6392 / 64.3342 | 53.6448 / 65.0586 | +1.0056 |  |
| `small/render/zh-CN/ascii-auto/120` | 53.8589 / 64.8949 | 54.2343 / 66.1605 | +0.3754 |  |
| `small/render/zh-CN/unicode-explicit/40` | 52.6257 / 64.2620 | 55.0401 / 65.3462 | +2.4144 | * |
| `small/render/zh-CN/unicode-explicit/120` | 54.7872 / 65.7316 | 54.3338 / 67.5869 | -0.4534 |  |
| `small/agents/40` | 0.0004 / 0.0012 | 0.0004 / 0.0012 | +0.0000 |  |
| `small/agent_process/40` | 48.3878 / 59.5613 | 50.9138 / 61.5789 | +2.5260 | * |
| `small/agents/120` | 0.0004 / 0.0006 | 0.0004 / 0.0006 | +0.0000 |  |
| `small/agent_process/120` | 48.1207 / 57.3827 | 48.9417 / 59.4222 | +0.8210 |  |
| `medium/transcript/cold` | 151.0436 / 160.0878 | 151.8229 / 160.1080 | +0.7793 |  |
| `medium/transcript/warm` | 2.3178 / 2.6246 | 2.3431 / 2.8027 | +0.0253 |  |
| `medium/transcript/append` | 3.3965 / 3.7339 | 3.4007 / 3.7640 | +0.0042 |  |
| `medium/git/clean/miss` | 10.5518 / 13.2918 | 10.1216 / 12.5077 | -0.4302 |  |
| `medium/git/clean/hit` | 0.0337 / 0.0453 | 0.0330 / 0.0450 | -0.0007 |  |
| `medium/git/clean/expired` | 11.0841 / 14.0022 | 10.5658 / 12.7217 | -0.5183 |  |
| `medium/git/dirty/miss` | 11.0871 / 13.3983 | 10.2875 / 13.0994 | -0.7996 |  |
| `medium/git/dirty/hit` | 0.0366 / 0.0514 | 0.0363 / 0.0448 | -0.0003 |  |
| `medium/git/dirty/expired` | 10.5397 / 12.6957 | 10.5007 / 12.9863 | -0.0390 |  |
| `medium/render/en/ascii-auto/40` | 51.9700 / 66.1663 | 52.3742 / 62.6998 | +0.4042 |  |
| `medium/render/en/ascii-auto/120` | 52.2391 / 62.0114 | 53.0651 / 62.7681 | +0.8260 |  |
| `medium/render/en/unicode-explicit/40` | 53.2463 / 62.0298 | 54.0726 / 64.6127 | +0.8263 |  |
| `medium/render/en/unicode-explicit/120` | 52.3202 / 63.1669 | 54.5805 / 64.4880 | +2.2603 | * |
| `medium/render/zh-CN/ascii-auto/40` | 52.2986 / 63.3564 | 55.4371 / 66.1723 | +3.1385 |  |
| `medium/render/zh-CN/ascii-auto/120` | 53.2780 / 63.5970 | 53.4235 / 63.7240 | +0.1455 |  |
| `medium/render/zh-CN/unicode-explicit/40` | 54.8187 / 64.4259 | 52.7467 / 65.3037 | -2.0720 |  |
| `medium/render/zh-CN/unicode-explicit/120` | 53.2747 / 63.0643 | 53.6600 / 62.8707 | +0.3853 |  |
| `medium/agents/40` | 0.6195 / 0.6464 | 0.6513 / 0.6720 | +0.0318 | * |
| `medium/agent_process/40` | 51.2985 / 60.6750 | 53.2820 / 63.3552 | +1.9835 |  |
| `medium/agents/120` | 0.6604 / 0.6971 | 0.6905 / 0.7569 | +0.0301 | * |
| `medium/agent_process/120` | 52.9256 / 64.7630 | 53.3310 / 65.1481 | +0.4054 |  |
| `large/transcript/cold` | 1647.2555 / 1680.3124 | 1658.4494 / 1715.2566 | +11.1939 | * |
| `large/transcript/warm` | 25.1779 / 25.9520 | 24.6951 / 26.1171 | -0.4828 |  |
| `large/transcript/append` | 24.8895 / 26.6664 | 25.2694 / 26.3381 | +0.3799 |  |
| `large/git/clean/miss` | 34.7969 / 46.7259 | 37.0683 / 44.9058 | +2.2714 |  |
| `large/git/clean/hit` | 0.0183 / 0.0255 | 0.0182 / 0.0227 | -0.0001 |  |
| `large/git/clean/expired` | 35.1797 / 44.4067 | 31.1560 / 45.8416 | -4.0237 |  |
| `large/git/dirty/miss` | 32.6273 / 46.0629 | 32.4671 / 42.8675 | -0.1602 |  |
| `large/git/dirty/hit` | 0.0173 / 0.0261 | 0.0168 / 0.0204 | -0.0005 |  |
| `large/git/dirty/expired` | 31.3458 / 38.2951 | 34.9451 / 44.9965 | +3.5993 |  |
| `large/render/en/ascii-auto/40` | 52.1834 / 61.5668 | 55.0205 / 64.8710 | +2.8371 |  |
| `large/render/en/ascii-auto/120` | 53.5348 / 64.8900 | 53.1814 / 64.0173 | -0.3534 |  |
| `large/render/en/unicode-explicit/40` | 55.3930 / 64.9052 | 56.3967 / 66.8987 | +1.0037 |  |
| `large/render/en/unicode-explicit/120` | 55.7013 / 66.4045 | 53.3327 / 63.0816 | -2.3686 |  |
| `large/render/zh-CN/ascii-auto/40` | 55.3513 / 66.2245 | 57.2769 / 67.0281 | +1.9256 |  |
| `large/render/zh-CN/ascii-auto/120` | 53.5320 / 65.7658 | 52.7674 / 63.7150 | -0.7646 |  |
| `large/render/zh-CN/unicode-explicit/40` | 54.3271 / 64.7145 | 55.7703 / 66.1652 | +1.4432 |  |
| `large/render/zh-CN/unicode-explicit/120` | 52.3993 / 61.3487 | 57.8791 / 67.6607 | +5.4798 |  |
| `large/agents/40` | 2.5536 / 2.6400 | 2.6668 / 2.7141 | +0.1132 | * |
| `large/agent_process/40` | 60.4783 / 68.4924 | 58.9576 / 72.7145 | -1.5207 |  |
| `large/agents/120` | 2.6724 / 2.7865 | 2.8201 / 2.9074 | +0.1477 | * |
| `large/agent_process/120` | 57.7843 / 72.2693 | 59.3652 / 70.0509 | +1.5809 |  |

## Cold bytecode

| Scenario | Baseline P50 / P95 | Candidate P50 / P95 | P50 delta | Review flag |
| --- | ---: | ---: | ---: | --- |
| `process/startup` | 15.9314 / 26.8634 | 15.8499 / 24.1175 | -0.0815 |  |
| `process/render_import` | 218.4446 / 233.2898 | 218.2489 / 234.6723 | -0.1957 |  |
| `small/transcript/cold` | 1.3067 / 1.4293 | 1.3103 / 1.3908 | +0.0036 |  |
| `small/transcript/warm` | 0.1259 / 0.1415 | 0.1272 / 0.1439 | +0.0013 |  |
| `small/transcript/append` | 0.2512 / 0.2905 | 0.2485 / 0.3162 | -0.0027 | * |
| `small/git/clean/miss` | 4.4964 / 7.7825 | 5.7217 / 7.7846 | +1.2253 |  |
| `small/git/clean/hit` | 0.0435 / 0.1065 | 0.0471 / 0.0656 | +0.0036 |  |
| `small/git/clean/expired` | 4.7755 / 6.5986 | 3.8177 / 4.5683 | -0.9578 |  |
| `small/git/dirty/miss` | 3.4264 / 3.9435 | 3.6500 / 4.1922 | +0.2236 |  |
| `small/git/dirty/hit` | 0.0387 / 0.1065 | 0.0377 / 0.0848 | -0.0010 |  |
| `small/git/dirty/expired` | 3.4249 / 4.2702 | 3.4920 / 3.7525 | +0.0671 |  |
| `small/render/en/ascii-auto/40` | 222.4391 / 239.5177 | 224.2887 / 237.2295 | +1.8496 |  |
| `small/render/en/ascii-auto/120` | 222.7549 / 238.1184 | 221.2921 / 235.6122 | -1.4628 |  |
| `small/render/en/unicode-explicit/40` | 229.4297 / 249.1300 | 227.7556 / 243.2677 | -1.6741 |  |
| `small/render/en/unicode-explicit/120` | 228.3395 / 242.7405 | 231.8021 / 248.9847 | +3.4626 | * |
| `small/render/zh-CN/ascii-auto/40` | 225.2143 / 241.8351 | 231.3787 / 253.7584 | +6.1644 | * |
| `small/render/zh-CN/ascii-auto/120` | 228.1218 / 245.3920 | 228.9319 / 251.8668 | +0.8101 |  |
| `small/render/zh-CN/unicode-explicit/40` | 230.9749 / 247.5141 | 234.0414 / 252.1739 | +3.0665 |  |
| `small/render/zh-CN/unicode-explicit/120` | 228.5596 / 245.4074 | 230.2787 / 245.5172 | +1.7191 |  |
| `small/agents/40` | 0.0006 / 0.0020 | 0.0006 / 0.0015 | +0.0000 |  |
| `small/agent_process/40` | 215.1126 / 240.3725 | 215.5463 / 240.9349 | +0.4337 |  |
| `small/agents/120` | 0.0004 / 0.0006 | 0.0004 / 0.0005 | +0.0000 |  |
| `small/agent_process/120` | 214.1651 / 233.7207 | 217.4334 / 238.0582 | +3.2683 |  |
| `medium/transcript/cold` | 153.0568 / 165.3035 | 155.4072 / 169.2783 | +2.3504 |  |
| `medium/transcript/warm` | 2.3052 / 2.6228 | 2.3504 / 3.0044 | +0.0452 | * |
| `medium/transcript/append` | 3.3689 / 3.7297 | 3.4034 / 3.7554 | +0.0345 |  |
| `medium/git/clean/miss` | 9.4435 / 18.8846 | 10.5280 / 14.4289 | +1.0845 |  |
| `medium/git/clean/hit` | 0.0315 / 0.0547 | 0.0353 / 0.0379 | +0.0038 |  |
| `medium/git/clean/expired` | 8.6279 / 11.5688 | 10.4778 / 13.0257 | +1.8499 |  |
| `medium/git/dirty/miss` | 10.9162 / 13.0211 | 10.9141 / 13.5960 | -0.0021 |  |
| `medium/git/dirty/hit` | 0.0287 / 0.0440 | 0.0314 / 0.0433 | +0.0027 |  |
| `medium/git/dirty/expired` | 10.7758 / 13.0992 | 10.5696 / 13.5825 | -0.2062 |  |
| `medium/render/en/ascii-auto/40` | 225.4517 / 241.7193 | 227.7019 / 242.1447 | +2.2502 |  |
| `medium/render/en/ascii-auto/120` | 225.1405 / 250.2203 | 224.2199 / 240.8081 | -0.9206 |  |
| `medium/render/en/unicode-explicit/40` | 227.4551 / 254.3770 | 229.3213 / 244.9220 | +1.8662 |  |
| `medium/render/en/unicode-explicit/120` | 228.7823 / 243.0386 | 230.3349 / 243.4649 | +1.5526 |  |
| `medium/render/zh-CN/ascii-auto/40` | 229.0919 / 244.4924 | 231.5069 / 244.0550 | +2.4150 |  |
| `medium/render/zh-CN/ascii-auto/120` | 225.3732 / 254.1671 | 229.4070 / 245.8773 | +4.0338 |  |
| `medium/render/zh-CN/unicode-explicit/40` | 232.0297 / 260.5090 | 229.3131 / 248.0084 | -2.7166 |  |
| `medium/render/zh-CN/unicode-explicit/120` | 230.5708 / 251.4077 | 229.7078 / 246.0784 | -0.8630 |  |
| `medium/agents/40` | 0.6188 / 0.6769 | 0.6557 / 0.7468 | +0.0369 | * |
| `medium/agent_process/40` | 220.0193 / 243.3720 | 220.8175 / 240.1495 | +0.7982 |  |
| `medium/agents/120` | 0.6557 / 0.7008 | 0.6925 / 0.7259 | +0.0368 | * |
| `medium/agent_process/120` | 222.5200 / 243.4188 | 223.3164 / 257.8742 | +0.7964 |  |
| `large/transcript/cold` | 1668.8702 / 1747.2392 | 1690.0951 / 1751.3631 | +21.2249 |  |
| `large/transcript/warm` | 24.9368 / 26.2466 | 24.8792 / 26.7800 | -0.0576 |  |
| `large/transcript/append` | 25.3892 / 25.9120 | 25.5907 / 26.5581 | +0.2015 |  |
| `large/git/clean/miss` | 37.4567 / 47.3313 | 38.7616 / 57.5495 | +1.3049 |  |
| `large/git/clean/hit` | 0.0236 / 0.0358 | 0.0187 / 0.0267 | -0.0049 |  |
| `large/git/clean/expired` | 35.0825 / 45.5726 | 33.6293 / 47.7509 | -1.4532 |  |
| `large/git/dirty/miss` | 34.4387 / 45.4462 | 34.5074 / 46.0576 | +0.0687 |  |
| `large/git/dirty/hit` | 0.0201 / 0.0317 | 0.0182 / 0.0411 | -0.0019 |  |
| `large/git/dirty/expired` | 36.5324 / 48.5134 | 34.4529 / 45.4219 | -2.0795 |  |
| `large/render/en/ascii-auto/40` | 228.2573 / 243.5082 | 228.3969 / 240.3925 | +0.1396 |  |
| `large/render/en/ascii-auto/120` | 226.5884 / 238.9201 | 230.6328 / 250.1724 | +4.0444 | * |
| `large/render/en/unicode-explicit/40` | 227.6854 / 245.9570 | 232.3823 / 250.4373 | +4.6969 |  |
| `large/render/en/unicode-explicit/120` | 228.2866 / 251.5390 | 231.7859 / 252.7801 | +3.4993 |  |
| `large/render/zh-CN/ascii-auto/40` | 230.0981 / 249.1745 | 231.7163 / 249.9525 | +1.6182 |  |
| `large/render/zh-CN/ascii-auto/120` | 226.9373 / 240.0246 | 227.5255 / 238.3697 | +0.5882 |  |
| `large/render/zh-CN/unicode-explicit/40` | 227.9150 / 241.1397 | 229.2196 / 246.9698 | +1.3046 |  |
| `large/render/zh-CN/unicode-explicit/120` | 227.0586 / 241.7039 | 229.6013 / 242.2292 | +2.5427 |  |
| `large/agents/40` | 2.5718 / 2.6160 | 2.6235 / 2.6750 | +0.0517 |  |
| `large/agent_process/40` | 224.3485 / 239.0292 | 228.0387 / 241.7829 | +3.6902 | * |
| `large/agents/120` | 2.7233 / 2.8908 | 2.7973 / 2.8602 | +0.0740 | * |
| `large/agent_process/120` | 225.6027 / 240.7894 | 225.6751 / 237.0156 | +0.0724 |  |

## Opt-in feature costs

These separate measurements use the same candidate, not an old-version comparison. Each case has 50 samples, English/Chinese, 40/120 columns and either a main row or 32 agents. Each cell is the minimum–maximum P50 or P95 across the four language/width combinations, in milliseconds. The disabled profile uses the same configuration with new features off.

### Warm bytecode

| Feature / output | P50 range | P95 range |
| --- | ---: | ---: |
| `disabled/main` | 50.8972–54.8823 | 62.6429–65.4190 |
| `disabled/agents` | 53.6310–57.2239 | 61.8062–69.4845 |
| `conditions/main` | 52.0813–54.7782 | 61.7779–67.4761 |
| `conditions/agents` | 51.6670–56.3318 | 63.3318–78.2617 |
| `item-colors/main` | 52.1206–54.8536 | 60.4883–69.0323 |
| `item-colors/agents` | 57.4530–58.3679 | 66.1429–70.8538 |
| `dark/main` | 53.4322–56.2299 | 62.9851–69.2090 |
| `dark/agents` | 59.0125–66.9248 | 70.3726–76.0552 |
| `light/main` | 53.9266–54.9661 | 62.6509–65.5764 |
| `light/agents` | 58.7210–66.9331 | 69.1286–78.3159 |
| `terminal/main` | 52.4999–54.8825 | 63.3019–67.3882 |
| `terminal/agents` | 59.1744–66.7111 | 66.6133–76.2964 |
| `powerline-ascii/main` | 52.4037–57.0137 | 63.6637–65.5674 |
| `powerline-ascii/agents` | 66.2583–76.2057 | 77.7969–95.1881 |
| `powerline-arrow/main` | 53.3993–57.7234 | 62.9987–67.7551 |
| `powerline-arrow/agents` | 66.3781–72.0273 | 77.2275–83.8170 |
| `powerline-light/main` | 54.1655–56.4701 | 65.7029–68.6527 |
| `powerline-light/agents` | 66.5391–72.0142 | 76.6979–82.3041 |
| `powerline-no-color/main` | 53.9579–58.2635 | 64.7431–83.7014 |
| `powerline-no-color/agents` | 53.7265–55.0663 | 62.6312–67.8471 |

### Cold bytecode

| Feature / output | P50 range | P95 range |
| --- | ---: | ---: |
| `disabled/main` | 224.5182–236.4850 | 234.7700–294.1533 |
| `disabled/agents` | 222.5938–231.3652 | 238.8350–273.8099 |
| `conditions/main` | 224.0186–231.9242 | 237.8275–257.0556 |
| `conditions/agents` | 220.5111–227.2261 | 230.8145–256.7245 |
| `item-colors/main` | 228.7188–235.1342 | 237.9465–262.2132 |
| `item-colors/agents` | 228.2606–231.5037 | 242.9302–252.1344 |
| `dark/main` | 226.8142–233.7839 | 239.3833–250.0965 |
| `dark/agents` | 227.3546–236.2679 | 237.6031–247.6063 |
| `light/main` | 227.9328–235.6836 | 239.9885–261.0291 |
| `light/agents` | 225.3968–243.5459 | 237.9124–271.8887 |
| `terminal/main` | 227.7637–239.0996 | 248.0151–255.9012 |
| `terminal/agents` | 227.8557–245.5635 | 238.6726–275.7360 |
| `powerline-ascii/main` | 228.4173–236.2211 | 245.5260–254.6240 |
| `powerline-ascii/agents` | 233.7187–243.0726 | 246.1759–294.4843 |
| `powerline-arrow/main` | 227.2280–235.8825 | 240.5963–286.4791 |
| `powerline-arrow/agents` | 237.1681–243.2033 | 250.3450–262.6724 |
| `powerline-light/main` | 230.9583–241.6519 | 247.9193–261.0747 |
| `powerline-light/agents` | 238.3625–246.6478 | 253.9317–271.5433 |
| `powerline-no-color/main` | 229.1834–234.4388 | 244.5032–255.3634 |
| `powerline-no-color/agents` | 221.7315–225.1960 | 234.6350–242.6294 |

## SHA256

```text

comparison.json 63e34497597e8966d51e1d1ed708af7b84d3cfd60ec086ca81058b86544ec914

benchmark_compare.py b4eea9900e6bd492d015e9809238923bf76bb6d7e514a550b92241bb120b4b9d

benchmark_render.py 41d0957b0c28f1b7ce4135ba3e56e8397c01d847b7934634c9c89130b4b55e93

benchmarking/__init__.py 8f3bc101757778615701971cca37ad2361160f054ced412ae2b7279f09601972

benchmarking/render.py f89a4bbd3dced75fd0e9cadcd82730167b379c596d25b9f564158b54c5e3db85

benchmarking/source.py 5b9b560e7fd37a6fc366d495d4d82c5e8e30e0eb08063316dfb02285463d4ed1

```

These local measurements are not a performance guarantee for every terminal, font or machine. An asterisk marks a same-direction change across all three rounds exceeding the baseline between-round range; the investigation is recorded above.


Supplemental receipt SHA256:

```text
fixed-seed-controls/comparison.json 1fbd5b779aecd2376b710b2efed2fcbe850f2fe6ee52410bc2d0a26dc401f629
appearance-warm.json 74c03e826e682d8fdbf2446d900a7ea49371d5c8d8e1d1ec8c078449b022ea69
appearance-cold.json e3ec62980351bc2a5fb2919c6b1a4de65bffab98b792d7f404449758d05ffa3c
followup_control.py 68858220bfd15d8a4a67cd8ffe0ee4d57abdc15858eec48cf8ea5a992dd2f8da
profile_controls.py e8233933cd121315655551f870bd09e451b4dbad1b34f656f05c662a13c3c9db
```
