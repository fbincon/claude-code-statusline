# Native capacity repair captures

**English** | [简体中文](README.zh-CN.md)

These five images reconstruct actual cells from the installed v3.9.1 candidate in isolated Linux x64 PTYs with Claude Code 2.1.310 and Node 24.21.0. They are not operating-system screenshots or human desktop acceptance. Every pictured journey passed its interaction, save/cancel and host-log assertions. Final release gates and package identities are tracked separately in the [delivery record](../../development/native-capacity.md).

Source: [`d195f7a41d23d0b8d38c53addd7575e9a06e874a`](https://github.com/fbincon/claude-code-statusline/commit/d195f7a41d23d0b8d38c53addd7575e9a06e874a). Candidate package SHA-256: `34150c0bf8c0cbae0c4890c68e227cb2ca0cad55626c3b42279cc35ae2c31c9e`. The crops preserve original text and styles. [Provenance](provenance.json) records cell/image/renderer/font digests and exact crop bounds. Raw ANSI streams, matrices and host logs remain in private validation output.

| Scenario | Capture | Checked behavior |
| --- | --- | --- |
| Quick setup | [Appearance](quick-setup.png) | Open use cases, select a candidate, cancel without changing the display file |
| Four foreground gradients | [Preview](gradients.png) | Main/agent page changes and retained colored production preview |
| Copy and save | [24 saved instances](saved-24.png) | One apply, 24 instances read back, successful-save notice and active controls |
| Tall minimal configuration | [Full tall pane](tall-pane.png) | A 200×220 terminal gives the 72×213 Client a valid drawing and visible footer |
| Resize with an unsaved copy | [Retained draft](resized-draft.png) | Shrink to 200×50, retain the dirty draft and preview, cancel without writing |

![Saved configuration and visible result](saved-24.png)

![Draft retained after shrinking the tall terminal](resized-draft.png)

Reproduce with `npm run capture:native-capacity` using a verified fixed-commit package, then `npm run capture:render` with the recorded bounds and fonts. The selected frames are English; the separate extended external-editor capture suite covers all six languages. Neither set closes the six existing [accepted gaps](../../releases/approvals/v3.9.1.json).
