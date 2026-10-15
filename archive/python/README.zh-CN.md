# 冻结的 Python 实现

[English](README.md) | **简体中文**

归档保留 Python 源码、测试、构建配置、历史比较工具和旧发布工作流。
`manifest.json` 记录原路径、SHA-256 和固定的归档前提交。全部 318 个 Python 文件
与 TS-05 责任快照一致，日常生成器不再更新这些副本。

在仓库根目录用 `npm run archive:check` 核验字节；用
`npm run reference:verify -- --python /absolute/python-3.14.4 --report /absolute/new.json`
独立执行历史验证。后者需要 wcwidth 0.9.1 和 pyte 0.8.2，在临时检出中重建原布局，
不修改已有产品。不要直接在归档目录执行旧工具：其原有相对路径刻意保持不变。

Python wheel/PyPI 发布流程仅供历史参考；TS-05 生成私有工程候选。公开 TS 版本、
标签和 Release 属于 TS-06。D06 失败测量继续保留，PERF-01 在 TS-06 后进行。
