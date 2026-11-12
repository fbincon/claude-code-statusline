# 任务浏览与版本审核

[English](task-version-review.md) | **简体中文**

本页说明任务浏览与只读任务证据、本机包审核及其共享编辑器与 Native 展示。原始 v3.11.0 实现与发布证据见[交付记录](history/deliveries/task-version-review.zh-CN.md#任务浏览与版本审核)。[任务用法](../TASK_DETAILS.zh-CN.md) · [包管理](../PACKAGE_MANAGEMENT.zh-CN.md)。

## 职责与接口

Core 管理任务阅读／导航、包审核状态、本地化展示及响应校验；CLI 提供已知任务文件、本机包检查和既有 UPDATE-01 审核服务；platform 处理独立进程启动、包复制和有界 npm 进程；TUI 管理终端 I/O。Native 将完整任务报告保留在宿主侧，仅向 Client 发送有界展示／输入帧。

独立 `task view` 入口要求显式会话，外部编辑器“设置”页提供相同视图。省略任务 ID 沿用已发布的当前任务指针。两端共享代理状态过滤、不区分大小写的名称／ID 搜索、父级上下文、展开折叠、证据显示和稳定行锚点，不增加采集、transcript 扫描、模型调用或后台任务轮询。读取失败时保留上次成功报告及读取时间，界面偏好独立于任务读取初始化。

## 审核与失败行为

进入包页面仅检查本机。显式元数据检查仍标记尚未验证；下载／暂存 dry-run 验证所选产物与接入预检。后续验证固定元数据结果的精确版本和完整性。审核快照绑定安装身份、prefix、配置目录、已保存配置摘要、渠道／历史及宿主身份；快照变化使结果失效。配置还原审核与软件包回退独立，不代表进行了产物验证。

长审核使用私有临时作业；对于已安装包，执行器来自当前包的独立副本。作业仅接受 check／dry-run 操作，具有所有者和截止时间，沿用有界、字面 argv 的 npm 适配器并禁用生命周期脚本。进度由显式查询获取，关闭只取消当前视图作业，迟到的启动结果也会被取消。取消在短请求时限内确认进程退出后才删除执行器副本；未确认停止时保留文件并阻止替换审核。临时审核文件不会成为安装事务或恢复历史。既有 CLI 执行、锁、快照及恢复继续由 UPDATE-01 提供。

损坏历史和快照仅报告、不修复；历史展示每页最多读取 16 条记录，未完成事务单独展示。审核不保存编辑器草稿，也不还原来源授权。

完整的[交付记录](history/deliveries/task-version-review.zh-CN.md#任务浏览与版本审核)已归入开发历史。下方链接直达迁移章节。

- <a id="验证与交付"></a>[验证与交付](history/deliveries/task-version-review.zh-CN.md#验证与交付)
- <a id="已接受源码与不可变交付物"></a>[已接受源码与不可变交付物](history/deliveries/task-version-review.zh-CN.md#已接受源码与不可变交付物)
- <a id="本地与终端验证"></a>[本地与终端验证](history/deliveries/task-version-review.zh-CN.md#本地与终端验证)
- <a id="发布渠道与测试机"></a>[发布渠道与测试机](history/deliveries/task-version-review.zh-CN.md#发布渠道与测试机)
- <a id="延后处理的版本页警告"></a>[延后处理的版本页警告](history/deliveries/task-version-review.zh-CN.md#延后处理的版本页警告)
