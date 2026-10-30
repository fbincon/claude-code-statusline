# SHOWCASE-01 gallery

**English** | [简体中文](README.zh-CN.md)

The [walkthrough](../../SHOWCASE.md) reproduces these scenes with published **v3.16.0**. Download the associated profile, inspect it, import it and preview before activation. All new displays use compact separators without Powerline. The [capture inventory](captures.json) records product/collector identity, inputs, method, dimensions, fonts, transformations and file digests; [acceptance](../../development/showcase.md) is separate from the pictures.

## Five display scenes

These ten English/Chinese scene images use named fixed observations through the installed production renderer. They do not show actual account usage. The narrow scene is deliberately 40 columns; other selected scenes use their recorded width. See the inventory for dark/light/no-color verification variants.

### Daily development

![English compact daily statusline showing model, project, Git, context, task time and session cost](en/daily.png)

[Profile](../../../examples/showcase/daily.json) · [Chinese image](zh-CN/daily.png). Derived from `daily-development`, with an Ocean theme and ordinary foreground gradient.

### Agent workbench

![English compact task and activity groups with separate subagent rows](en/agents.png)

[Profile](../../../examples/showcase/agents.json) · [Chinese image](zh-CN/agents.png). Derived from `agent-workbench`; task and agent timing retain separate scopes.

### Quotas and cost

![English compact quota and reset rows with context, spending and cost-rate groups](en/quota.png)

[Profile](../../../examples/showcase/quota.json) · [Chinese image](zh-CN/quota.png). Derived from `quota-cost`; quota values are samples, not billing evidence.

### Narrow terminal

![English forty-column ASCII statusline with adaptive context indicator and visible directory](en/narrow.png)

[Profile](../../../examples/showcase/narrow.json) · [Chinese image](zh-CN/narrow.png). Derived from `narrow-terminal`; numeric meaning remains readable as the bar shrinks.

### Light terminal

![English light-theme statusline with compact separators and readable foreground colors](en/light.png)

[Profile](../../../examples/showcase/light.json) · [Chinese image](zh-CN/light.png). Derived from `light-readable`; no Powerline background is enabled.

## Short walkthroughs

The editor clips reconstruct actual installed-editor PTY keyframes. Their previews use fixed samples. Each selected frame is held for **1.4 seconds**; the clips are edited walkthroughs, not real-time screen recordings or performance measurements.

### Configure and save

![English configuration walkthrough showing a reviewed display change, save and reopening](en/configure.gif)

[Chinese clip](zh-CN/configure.gif) · [Steps and cancellation behavior](../../SHOWCASE.md#edit).

### Reuse and history

![English editor walkthrough showing visual reuse and draft history controls](en/reuse.gif)

[Chinese clip](zh-CN/reuse.gif) · [Style and group reuse](../../DRAFT_HISTORY.md).

### Tasks and subagents

![English montage of completed-task input replay followed by the offline task viewer, with two completed agents and unavailable active-time evidence](en/tasks.gif)

[Chinese clip](zh-CN/tasks.gif) · [Task-viewing steps](../../SHOWCASE.md#tasks).

The task montage has two separately attributed sources: completed-task observations replayed through the installed renderer, then actual viewer PTY frames reading the copied stores. The main task ends at 14 seconds and the agents at 5/7 seconds. It is not the original statusline callback. The viewer retains `active_unknown`, `runtime_disabled` and `incomplete` where observed. The actual CLI session cost is USD 0.00199048; a displayed `$0.00` is two-decimal rounding, not a free-call claim. The [inventory](captures.json) records both sources, transformations and keyframe timing.

## Sources and versions

![English source manager with isolated source state and explicit review and refresh operations above a fixed-sample preview](en/sources.png)

[Chinese source page](zh-CN/sources.png) · [Source walkthrough](../../SHOWCASE.md#sources).

![Cropped English version actions and diagnostics, including the warning to select the intended installation prefix](en/versions.png)

[Chinese version excerpt](zh-CN/versions.png) · [Version walkthrough](../../SHOWCASE.md#versions). This crop covers cells `[0,12,120,11]`; the complete prefix and current-version header are outside it. The multiple-prefix warning is an actual diagnostic, so choose the intended `--prefix` explicitly. On the actual already-current 3.16.0 installation, the separate dry-run returned `unchanged: true` and `artifact_verified: false`; this image does not establish a newly downloaded archive check.

## Provenance and limits

The public package source is `c89a2ca088099ccd3ceb76baf59ecf11d84b08f0`, with tgz SHA256 `2030ef2f8d386b2fcb1f616fb49ce6f16eed92ec21ea22486799da68151b8c8a`. Collector identities remain separate. Raw private session logs, credentials and preferences are not published; any input sanitization and rendering transformations are recorded.

No picture grants source access or enables collection. Continuous row backgrounds require colored Powerline and are explained in the [appearance guide](../../APPEARANCE.md), outside this gallery's visual choices. Earlier screenshots retain their original files and identities in the [image index](../README.md).

Automated assertions, agent visual inspection, terminal reconstruction and human/physical acceptance are recorded separately. This gallery does not establish a new human usability study; the six existing [issue #96 gaps](https://github.com/fbincon/claude-code-statusline/issues/96) remain unverified.
