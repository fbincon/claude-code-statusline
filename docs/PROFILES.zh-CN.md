# 显示方案与项目绑定

[English](PROFILES.md) | **简体中文**

保存完整的命名显示方案，并在多个项目间复用。打开任一配置编辑器，选择 **设置 → 显示方案与项目**，或按 **Ctrl+O**。示例预览不会修改已保存设置。

## 选择编辑目标

编辑器默认打开工作目录匹配的方案；无绑定时使用用户默认。顶部显示编辑目标、匹配根目录和共享绑定数。本次编辑目标保持固定；切换有未保存修改的草稿时，可选择保存、放弃或取消。

```sh
claude-statusline configure
claude-statusline configure --user
claude-statusline configure --profile "日常开发"
claude-statusline configure --project "/work/project"
```

编辑命名方案并保存，会影响所有绑定该方案的项目。需要独立副本时，选择**当前显示另存为并绑定**。重命名保留稳定 ID；删除方案前须解除项目绑定。

**载入默认草稿**会复制方案供审阅，普通保存后才生效。用户默认是独立快照：以后修改命名方案不会自动改变默认设置。现有 `config set`、`config preset`、`config import` 和 `config reset` 继续操作用户默认；重置不会删除个人方案库。

方案包含输出语言、组件实例和选项、布局、颜色及子代理显示设置。界面语言、采集开关、两个编辑器的安装偏好及 Claude 宿主偏好不在其中。编辑器中的宿主字段仍属于用户级设置，复制或导入方案不会复制它们。

## CLI 方案管理

```sh
claude-statusline config profile list
claude-statusline config profile save "日常开发"
claude-statusline config profile preview "日常开发" --width 80
claude-statusline config profile rename "日常开发" "开发"
claude-statusline config profile activate "开发"
claude-statusline config profile export "开发" ./development.profile.json
claude-statusline config profile import ./development.profile.json --dry-run
claude-statusline config profile import ./development.profile.json --name "导入方案"
claude-statusline config profile delete "导入方案"
```

CLI `save` 复制已保存的用户默认，不读取编辑器未保存草稿。编辑器的**当前显示另存为**保存当前显示草稿。名称区分大小写，去除首尾空白并进行 NFC 规范化，允许 1–128 个 Unicode 码点，不允许控制字符；ID 与名称独立。

覆盖同名方案或导出文件须指定 `--overwrite`。导入支持 `--name` 和 `--dry-run`；dry-run 只验证并输出候选显示配置。检查及管理命令支持 `--json`。选择其他用户配置目录时，将 `--config-dir PATH` 放在 `config` 后面。

## 绑定项目根目录

```sh
claude-statusline config project bind "/work/project" "开发"
claude-statusline config project list --json
claude-statusline config project resolve "/work/project/src" --json
claude-statusline config profile save "独立方案" --bind "/work/other"
claude-statusline config project unbind "/work/project"
```

根目录已绑定其他方案时，须使用 `--overwrite` 明确替换。另存为和绑定在同一次事务中提交。绑定保存在用户配置中，不读取项目可执行配置。

解析选择当前目录最深的已注册祖先根目录，使用原生真实路径和目录身份，处理符号链接别名及大小写敏感卷。`/work/project-old` 不会误匹配 `/work/project`。Worktree 按独立根目录处理；位于已绑定根之外时需要显式绑定，无须查询 Git 或托管服务。

主状态栏及所有子代理行使用所属会话目录，不按各代理的工作目录选择不同方案。未绑定、目录不可用、路径别名冲突或方案缺失时回退用户默认；更深根目录的方案缺失时，不会悄悄改用父目录方案。`project resolve` 和[真实输入诊断](DIAGNOSTICS.zh-CN.md)会解释选择原因。

移动项目不会自动改写绑定，请解除旧路径并绑定新根目录。方案不能开启采集。绑定方案需要自定义子代理行时，工具协调自身显示入口，保留其他渲染器的所有权保护；项目关闭自定义行时继续显示 Claude 默认行。

## 文件、冲突与恢复

Claude 用户配置目录中的版本 1 `claude-statusline-profiles.json` 保存方案集合和绑定，仅在保存或绑定时创建。现有 `claude-statusline.json` 继续保存显示 schema 8 的用户默认。集合限制为 128 个方案、512 个绑定和 32 MiB。

单方案导出格式为 `claude-code-statusline-profile`、版本 1，包含名称和显示设置，不包含项目路径或内部方案 ID；传输大小上限为 1 MiB。它与现有还包含工具宿主设置的 `claude-code-statusline` portable 配置包不同，请使用对应导入命令。

写入复用安装锁、revision 检查、不可变备份和恢复日志。并发修改会拒绝旧草稿，请重新读取并核对。保存响应丢失时，先刷新已保存状态，再进行下一次写入。损坏方案库保留原文件并明确报错，渲染则安全回退。

旧版本继续读取用户默认快照并忽略方案库。若有未完成事务，降级前先使用新版本恢复。通过现有[恢复流程](USER_GUIDE.zh-CN.md)处理备份，并保留方案库供以后升级使用。
