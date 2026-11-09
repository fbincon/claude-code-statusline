# v1.11.0 rendering performance comparison

**English** | [简体中文](performance-v1.11.0.zh-CN.md)

Measurement host: 13th Gen Intel(R) Core(TM) i5-13500H, 16 logical CPUs, approximately 14.9 GiB RAM; Linux 7.0.0-38-generic / glibc 2.43.

The same Linux x86_64 host, CPython 3.14.4, frozen harness and synthetic fixtures run three alternating rounds, 50 samples per case per round, with separate cold/warm bytecode: 39,000 raw samples. Values below are medians of the three round P50/P95 values, in milliseconds. OS filesystem caches are uncontrolled; transcript/Git cold, miss and expired describe application data caches only.

Baseline: `36e26a28a7cbcd9ad03327b614c7955a39069756`. Candidate: `862d0d0072ed52f9442091904430400eccf8d6bd`.

Runtime sources match the accepted candidate wheel; final delivery changes only documentation and distribution metadata. Raw samples and round reports are retained under ignored `dist/validation/v1.11/comparison-final-3`.

## Results and investigation

Cold Unicode initialization was reduced by decoding packed integer tables instead of compiling thousands of tuple literals; unused transcript/timer imports and redundant decoration parsing were removed. In the full matrix, 32-agent in-process warm P50 is 15.1488 → 2.5307 ms at 40 columns and 17.4776 → 2.6947 ms at 120 columns. Fresh 32-agent warm processes are 66.8253 → 62.6633 and 71.2221 → 65.2921 ms. The large-profile Chinese Unicode main render at 40 columns is 57.7906 → 57.8481 ms warm and 247.1922 → 231.2921 ms cold.

Seven screening flags are retained in the tables below. Supplemental controls used the same fixed runtime sources and frozen operations, PYTHONHASHSEED=0, three alternating rounds and 50 samples for each flagged case plus startup/import controls (3,300 selected samples). Other original cases execute one setup/priming sample and are excluded from the supplemental comparison. This is a targeted repeat with a different setup history, not a replacement full matrix or proof that hash randomization alone caused the original differences.

The main-render, Git and append flags did not repeat beyond the observed baseline variation. Empty-agent and eight-agent process changes remained inside the controlled baseline round ranges; an empty-agent import trace adds no modules. Transcript/platform collector code is byte-identical to the baseline, and all hot-cache no-read/no-extra-Git assertions passed. The hot-transcript P95 difference fell from 0.3303 to 0.0079 ms; its remaining P50 offset is 0.0067 ms, against baseline P10–P90 spans of 0.0730–0.0909 ms. An exploratory 4,000-resample within-round bootstrap gives a P50-difference 95% percentile interval of −0.0030 to +0.0194 ms, including zero. These controls did not establish a repeatable product slowdown outside measurement variation; the residual offset and original flags remain visible.

| Controlled case | Baseline P50 / P95 | Candidate P50 / P95 |
| --- | ---: | ---: |
| `warm/small/agent_process/40` | 48.6478 / 58.9585 | 51.4440 / 62.3224 |
| `warm/medium/transcript/warm` | 2.2910 / 2.3804 | 2.2977 / 2.3883 |
| `warm/medium/transcript/append` | 3.3616 / 3.7201 | 3.4334 / 3.7637 |
| `warm/medium/render/zh-CN/ascii-auto/40` | 55.2132 / 65.1672 | 53.7754 / 64.3920 |
| `cold/small/git/clean/miss` | 3.8389 / 4.6957 | 3.7494 / 4.1255 |
| `cold/medium/transcript/append` | 3.3612 / 3.4457 | 3.3543 / 3.4710 |
| `cold/medium/agent_process/40` | 219.7915 / 232.9201 | 221.0507 / 242.6695 |

Full and supplemental raw reports, the control wrapper, import traces and resampling receipt remain in ignored `dist/validation/v1.11`. The earlier incomplete diagnostic runs are explicitly marked STOPPED and are excluded from these results. Terminal glyph presentation and host scheduling remain separate limitations.

## Scenarios

`small`/`medium`/`large` contain 100/10,000/100,000 transcript rows, 0/8/32 agents and 32/1,000/10,000 Git files. Agents include nested records and distinct long Unicode text. `agents` measures refreshes in one process; `agent_process` measures fresh official CLI processes. Main rows cover English/Chinese, ASCII automatic/Unicode explicit layouts and 40/120 columns. Setup is excluded; warm-cache assertions forbid repeated transcript reads or Git collection.

`ascii-auto` uses ASCII input labels and automatic layout; built-in labels still use the selected language. `unicode-explicit` adds a complex-grapheme custom label and explicit layout.

## Warm bytecode

| Scenario | Baseline P50 / P95 | Candidate P50 / P95 | P50 delta | Review flag |
| --- | ---: | ---: | ---: | --- |
| `process/startup` | 15.9829 / 25.1328 | 15.6901 / 25.7559 | -0.2928 |  |
| `process/render_import` | 54.7371 / 65.7567 | 53.1854 / 61.9402 | -1.5517 |  |
| `small/transcript/cold` | 1.3383 / 1.6530 | 1.3451 / 1.7648 | +0.0068 |  |
| `small/transcript/warm` | 0.1315 / 0.2619 | 0.1308 / 0.1598 | -0.0007 |  |
| `small/transcript/append` | 0.2640 / 0.3190 | 0.2494 / 0.3019 | -0.0146 |  |
| `small/git/clean/miss` | 4.5130 / 6.9469 | 3.9928 / 5.0709 | -0.5202 |  |
| `small/git/clean/hit` | 0.0352 / 0.0536 | 0.0346 / 0.0479 | -0.0006 |  |
| `small/git/clean/expired` | 4.1381 / 5.0833 | 3.4938 / 4.7346 | -0.6443 |  |
| `small/git/dirty/miss` | 3.8500 / 5.6428 | 4.0869 / 5.1827 | +0.2369 |  |
| `small/git/dirty/hit` | 0.0391 / 0.0997 | 0.0398 / 0.0841 | +0.0007 |  |
| `small/git/dirty/expired` | 4.4422 / 7.5647 | 3.7633 / 4.1759 | -0.6789 |  |
| `small/render/en/ascii-auto/40` | 59.6155 / 70.0700 | 55.3400 / 69.1263 | -4.2755 |  |
| `small/render/en/ascii-auto/120` | 56.2772 / 66.4759 | 54.9461 / 65.9526 | -1.3311 |  |
| `small/render/en/unicode-explicit/40` | 55.7244 / 65.4620 | 56.4454 / 66.2914 | +0.7210 |  |
| `small/render/en/unicode-explicit/120` | 57.6709 / 68.9695 | 56.7214 / 70.7242 | -0.9495 |  |
| `small/render/zh-CN/ascii-auto/40` | 61.1108 / 72.8282 | 56.2512 / 66.2968 | -4.8596 |  |
| `small/render/zh-CN/ascii-auto/120` | 58.0156 / 68.5285 | 53.3972 / 63.6556 | -4.6184 |  |
| `small/render/zh-CN/unicode-explicit/40` | 60.0588 / 73.7072 | 55.9485 / 65.4149 | -4.1103 |  |
| `small/render/zh-CN/unicode-explicit/120` | 57.5911 / 67.9180 | 55.0159 / 66.7765 | -2.5752 |  |
| `small/agents/40` | 0.0004 / 0.0011 | 0.0003 / 0.0011 | -0.0001 |  |
| `small/agent_process/40` | 50.4771 / 61.6372 | 52.1666 / 63.3324 | +1.6895 | * |
| `small/agents/120` | 0.0006 / 0.0009 | 0.0004 / 0.0007 | -0.0002 |  |
| `small/agent_process/120` | 51.3401 / 60.4079 | 51.2706 / 61.3081 | -0.0695 |  |
| `medium/transcript/cold` | 152.8785 / 160.6048 | 152.6227 / 162.5463 | -0.2558 |  |
| `medium/transcript/warm` | 2.2706 / 2.3388 | 2.3128 / 2.6691 | +0.0422 | * |
| `medium/transcript/append` | 3.3610 / 3.7491 | 3.4031 / 4.4066 | +0.0421 | * |
| `medium/git/clean/miss` | 9.9407 / 15.2700 | 9.9583 / 13.0977 | +0.0176 |  |
| `medium/git/clean/hit` | 0.0336 / 0.0524 | 0.0329 / 0.0410 | -0.0007 |  |
| `medium/git/clean/expired` | 8.9976 / 12.7374 | 9.3109 / 11.7853 | +0.3133 |  |
| `medium/git/dirty/miss` | 12.6167 / 19.0613 | 10.6766 / 15.5226 | -1.9401 |  |
| `medium/git/dirty/hit` | 0.0363 / 0.0454 | 0.0370 / 0.0637 | +0.0007 |  |
| `medium/git/dirty/expired` | 11.1882 / 13.8350 | 11.4567 / 16.5482 | +0.2685 |  |
| `medium/render/en/ascii-auto/40` | 57.9820 / 69.5109 | 53.6689 / 63.5128 | -4.3131 |  |
| `medium/render/en/ascii-auto/120` | 57.3779 / 67.5397 | 53.9883 / 63.9649 | -3.3896 |  |
| `medium/render/en/unicode-explicit/40` | 56.1354 / 66.0779 | 56.7735 / 68.6934 | +0.6381 |  |
| `medium/render/en/unicode-explicit/120` | 57.8883 / 67.0099 | 54.8033 / 67.6215 | -3.0850 |  |
| `medium/render/zh-CN/ascii-auto/40` | 54.5981 / 65.7125 | 58.2676 / 68.3719 | +3.6695 | * |
| `medium/render/zh-CN/ascii-auto/120` | 56.9329 / 67.8742 | 57.2519 / 68.7836 | +0.3190 |  |
| `medium/render/zh-CN/unicode-explicit/40` | 56.1792 / 66.6726 | 59.0175 / 70.0996 | +2.8383 |  |
| `medium/render/zh-CN/unicode-explicit/120` | 56.6421 / 68.4608 | 55.8651 / 64.3631 | -0.7770 |  |
| `medium/agents/40` | 3.7122 / 3.8129 | 0.6277 / 0.6557 | -3.0845 |  |
| `medium/agent_process/40` | 53.1655 / 62.7098 | 55.1770 / 64.1074 | +2.0115 |  |
| `medium/agents/120` | 4.3489 / 4.4722 | 0.6573 / 0.7216 | -3.6916 |  |
| `medium/agent_process/120` | 55.1278 / 65.9761 | 53.8403 / 63.8234 | -1.2875 |  |
| `large/transcript/cold` | 1670.7854 / 1749.9470 | 1685.2143 / 1757.2909 | +14.4289 |  |
| `large/transcript/warm` | 24.4156 / 26.7759 | 24.5888 / 25.4846 | +0.1732 |  |
| `large/transcript/append` | 25.4086 / 26.2011 | 24.8194 / 26.3747 | -0.5892 |  |
| `large/git/clean/miss` | 38.6190 / 48.2821 | 33.7060 / 46.2871 | -4.9130 |  |
| `large/git/clean/hit` | 0.0169 / 0.0254 | 0.0174 / 0.0281 | +0.0005 |  |
| `large/git/clean/expired` | 38.1725 / 47.8475 | 39.7292 / 46.2137 | +1.5567 |  |
| `large/git/dirty/miss` | 36.6718 / 48.9013 | 36.5298 / 46.0795 | -0.1420 |  |
| `large/git/dirty/hit` | 0.0169 / 0.0272 | 0.0181 / 0.0256 | +0.0012 |  |
| `large/git/dirty/expired` | 33.4883 / 46.1473 | 36.4695 / 44.7589 | +2.9812 |  |
| `large/render/en/ascii-auto/40` | 56.8648 / 67.4763 | 52.8617 / 64.7302 | -4.0031 |  |
| `large/render/en/ascii-auto/120` | 55.1634 / 64.3998 | 54.4231 / 65.4538 | -0.7403 |  |
| `large/render/en/unicode-explicit/40` | 56.3773 / 65.5793 | 55.3173 / 66.6973 | -1.0600 |  |
| `large/render/en/unicode-explicit/120` | 55.1226 / 63.4031 | 56.5566 / 68.9538 | +1.4340 |  |
| `large/render/zh-CN/ascii-auto/40` | 56.5486 / 69.4127 | 54.2583 / 67.1775 | -2.2903 |  |
| `large/render/zh-CN/ascii-auto/120` | 57.4503 / 66.4874 | 58.2161 / 69.5119 | +0.7658 |  |
| `large/render/zh-CN/unicode-explicit/40` | 57.7906 / 69.6711 | 57.8481 / 69.0111 | +0.0575 |  |
| `large/render/zh-CN/unicode-explicit/120` | 56.5605 / 70.3293 | 59.0514 / 69.2237 | +2.4909 |  |
| `large/agents/40` | 15.1488 / 15.3326 | 2.5307 / 2.5856 | -12.6181 |  |
| `large/agent_process/40` | 66.8253 / 80.7430 | 62.6633 / 72.0452 | -4.1620 |  |
| `large/agents/120` | 17.4776 / 17.7114 | 2.6947 / 4.3096 | -14.7829 |  |
| `large/agent_process/120` | 71.2221 / 83.8338 | 65.2921 / 74.4477 | -5.9300 |  |

## Cold bytecode

| Scenario | Baseline P50 / P95 | Candidate P50 / P95 | P50 delta | Review flag |
| --- | ---: | ---: | ---: | --- |
| `process/startup` | 37.3478 / 47.6557 | 39.1820 / 50.5017 | +1.8342 |  |
| `process/render_import` | 237.3797 / 259.7074 | 224.5452 / 249.1875 | -12.8345 |  |
| `small/transcript/cold` | 1.3208 / 1.4468 | 1.3252 / 1.3941 | +0.0044 |  |
| `small/transcript/warm` | 0.1256 / 0.1369 | 0.1258 / 0.1386 | +0.0002 |  |
| `small/transcript/append` | 0.2435 / 0.2932 | 0.2454 / 0.2958 | +0.0019 |  |
| `small/git/clean/miss` | 3.8343 / 4.1951 | 3.9525 / 8.9310 | +0.1182 | * |
| `small/git/clean/hit` | 0.0362 / 0.0652 | 0.0362 / 0.0498 | +0.0000 |  |
| `small/git/clean/expired` | 4.0135 / 4.9608 | 3.9729 / 4.2754 | -0.0406 |  |
| `small/git/dirty/miss` | 3.9358 / 4.2498 | 3.0209 / 4.1232 | -0.9149 |  |
| `small/git/dirty/hit` | 0.0380 / 0.0632 | 0.0275 / 0.0511 | -0.0105 |  |
| `small/git/dirty/expired` | 3.3295 / 3.8147 | 3.2775 / 4.3325 | -0.0520 |  |
| `small/render/en/ascii-auto/40` | 239.3713 / 254.1032 | 230.5925 / 254.2065 | -8.7788 |  |
| `small/render/en/ascii-auto/120` | 240.9506 / 259.7467 | 224.9296 / 242.9020 | -16.0210 |  |
| `small/render/en/unicode-explicit/40` | 243.4735 / 260.4520 | 233.1396 / 247.4529 | -10.3339 |  |
| `small/render/en/unicode-explicit/120` | 245.7241 / 267.2403 | 231.9663 / 249.9828 | -13.7578 |  |
| `small/render/zh-CN/ascii-auto/40` | 253.2380 / 279.9259 | 237.2330 / 257.2966 | -16.0050 |  |
| `small/render/zh-CN/ascii-auto/120` | 241.2126 / 259.6135 | 231.2852 / 247.1271 | -9.9274 |  |
| `small/render/zh-CN/unicode-explicit/40` | 241.5323 / 255.7492 | 231.3724 / 246.9341 | -10.1599 |  |
| `small/render/zh-CN/unicode-explicit/120` | 239.5576 / 256.1277 | 231.8395 / 247.5671 | -7.7181 |  |
| `small/agents/40` | 0.0004 / 0.0011 | 0.0004 / 0.0011 | +0.0000 |  |
| `small/agent_process/40` | 214.4093 / 237.8708 | 215.4932 / 229.3654 | +1.0839 |  |
| `small/agents/120` | 0.0004 / 0.0006 | 0.0004 / 0.0006 | +0.0000 |  |
| `small/agent_process/120` | 218.0183 / 242.3735 | 216.0779 / 231.5502 | -1.9404 |  |
| `medium/transcript/cold` | 153.1201 / 160.5185 | 152.4465 / 160.1968 | -0.6736 |  |
| `medium/transcript/warm` | 2.3494 / 2.7111 | 2.3438 / 2.6302 | -0.0056 |  |
| `medium/transcript/append` | 3.3540 / 3.6707 | 3.3911 / 3.9459 | +0.0371 | * |
| `medium/git/clean/miss` | 10.7650 / 13.1518 | 10.1469 / 13.3871 | -0.6181 |  |
| `medium/git/clean/hit` | 0.0364 / 0.0471 | 0.0377 / 0.0485 | +0.0013 |  |
| `medium/git/clean/expired` | 10.9491 / 12.9864 | 10.6014 / 12.7723 | -0.3477 |  |
| `medium/git/dirty/miss` | 12.0799 / 19.5690 | 10.1964 / 13.3951 | -1.8835 |  |
| `medium/git/dirty/hit` | 0.0368 / 0.0779 | 0.0346 / 0.0818 | -0.0022 |  |
| `medium/git/dirty/expired` | 11.1094 / 13.3028 | 10.4489 / 13.2355 | -0.6605 |  |
| `medium/render/en/ascii-auto/40` | 243.1329 / 256.1513 | 231.6060 / 250.9638 | -11.5269 |  |
| `medium/render/en/ascii-auto/120` | 247.8650 / 265.3150 | 225.8414 / 242.9004 | -22.0236 |  |
| `medium/render/en/unicode-explicit/40` | 238.8977 / 255.7639 | 231.6134 / 253.5870 | -7.2843 |  |
| `medium/render/en/unicode-explicit/120` | 243.3054 / 257.1312 | 230.7099 / 246.4804 | -12.5955 |  |
| `medium/render/zh-CN/ascii-auto/40` | 247.4023 / 270.7165 | 229.7099 / 245.7134 | -17.6924 |  |
| `medium/render/zh-CN/ascii-auto/120` | 242.8422 / 260.6576 | 235.8757 / 253.5456 | -6.9665 |  |
| `medium/render/zh-CN/unicode-explicit/40` | 246.0563 / 262.3115 | 233.3647 / 248.3430 | -12.6916 |  |
| `medium/render/zh-CN/unicode-explicit/120` | 243.3714 / 271.0117 | 230.1558 / 248.3846 | -13.2156 |  |
| `medium/agents/40` | 3.7781 / 3.8290 | 0.6273 / 0.6440 | -3.1508 |  |
| `medium/agent_process/40` | 218.3630 / 235.7646 | 222.3564 / 240.1202 | +3.9934 | * |
| `medium/agents/120` | 4.3989 / 4.4820 | 0.6660 / 0.6834 | -3.7329 |  |
| `medium/agent_process/120` | 220.2585 / 237.4300 | 223.2203 / 241.4010 | +2.9618 |  |
| `large/transcript/cold` | 1662.4455 / 1725.1422 | 1663.2482 / 1713.4521 | +0.8027 |  |
| `large/transcript/warm` | 24.9366 / 26.7446 | 24.1416 / 25.5499 | -0.7950 |  |
| `large/transcript/append` | 25.4426 / 26.5921 | 25.1724 / 26.7799 | -0.2702 |  |
| `large/git/clean/miss` | 35.9064 / 47.4032 | 36.6572 / 46.9531 | +0.7508 |  |
| `large/git/clean/hit` | 0.0172 / 0.0250 | 0.0175 / 0.0260 | +0.0003 |  |
| `large/git/clean/expired` | 39.9620 / 48.1088 | 39.4838 / 47.3925 | -0.4782 |  |
| `large/git/dirty/miss` | 40.7130 / 52.7703 | 39.7082 / 48.1890 | -1.0048 |  |
| `large/git/dirty/hit` | 0.0183 / 0.0232 | 0.0174 / 0.0253 | -0.0009 |  |
| `large/git/dirty/expired` | 41.1239 / 51.5179 | 38.8901 / 50.3763 | -2.2338 |  |
| `large/render/en/ascii-auto/40` | 241.6417 / 255.4894 | 231.0573 / 248.8687 | -10.5844 |  |
| `large/render/en/ascii-auto/120` | 240.5359 / 254.1507 | 228.8343 / 245.9353 | -11.7016 |  |
| `large/render/en/unicode-explicit/40` | 239.6775 / 258.3096 | 229.3113 / 249.4263 | -10.3662 |  |
| `large/render/en/unicode-explicit/120` | 240.8698 / 267.0845 | 235.5991 / 249.5089 | -5.2707 |  |
| `large/render/zh-CN/ascii-auto/40` | 245.2746 / 261.9175 | 230.3858 / 245.0634 | -14.8888 |  |
| `large/render/zh-CN/ascii-auto/120` | 243.2317 / 259.8207 | 235.6411 / 246.6641 | -7.5906 |  |
| `large/render/zh-CN/unicode-explicit/40` | 247.1922 / 259.8488 | 231.2921 / 247.1472 | -15.9001 |  |
| `large/render/zh-CN/unicode-explicit/120` | 245.7240 / 257.4726 | 238.3989 / 254.0091 | -7.3251 |  |
| `large/agents/40` | 15.2105 / 15.5778 | 2.5500 / 2.6570 | -12.6605 |  |
| `large/agent_process/40` | 239.4925 / 253.1991 | 234.2163 / 258.8693 | -5.2762 |  |
| `large/agents/120` | 17.5780 / 17.9528 | 2.7318 / 3.2826 | -14.8462 |  |
| `large/agent_process/120` | 240.0129 / 254.5994 | 233.3401 / 249.4234 | -6.6728 |  |

## SHA256

```text

comparison-final-3/review.json 5703bec354a02cb5ce6e385813da02b126b71574d42a25bed61e6e54a07e3c43

fixed-seed-controls/comparison.json ffccc667aceb57fc907df478e12aad9546c0ad80ed76ede7fe4dc1eee2f33576

fixed-seed-controls/investigation.json 8e84fcf2af7bf7004c9873066193140e3b86ade9a3598206eec05990621d3b2c

followup_control.py 2c17d445d4d29d962432c4135b87c4aa32f8aa087755bec8cafe3e32ec4be5bd

comparison.json a02c2b7356d37ec11be89c1563f25fc2002cc7a9cefdb930c3fa18281d550241

benchmark_compare.py b4eea9900e6bd492d015e9809238923bf76bb6d7e514a550b92241bb120b4b9d

benchmark_render.py 1c374db8a7078578fb616b52fa08812a39c1c1980fd4c0a6b6b6bbf6532322d9

benchmarking/__init__.py 8f3bc101757778615701971cca37ad2361160f054ced412ae2b7279f09601972

benchmarking/render.py f89a4bbd3dced75fd0e9cadcd82730167b379c596d25b9f564158b54c5e3db85

benchmarking/source.py 5b9b560e7fd37a6fc366d495d4d82c5e8e30e0eb08063316dfb02285463d4ed1

```

These local measurements are not a performance guarantee for every terminal, font or machine. An asterisk marks a same-direction change across all three rounds exceeding the baseline between-round range; the investigation is recorded above.
