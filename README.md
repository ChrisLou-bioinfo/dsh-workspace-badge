# dsh-workspace-badge · 会话行工作区标签

DSH 侧边栏会话列表在「单列 / 最新在上」（flat + updated）模式下不显示每条会话属于哪个
工作区（项目文件夹）——项目一多就无法分辨。本插件在每行标题旁注入工作区标签，
排序逻辑完全不动，最新依然在最上。

Shows the workspace (project folder) badge on each session row in the flat,
recency-sorted sidebar list of DeepSeek Harness. Sorting is untouched.

## 效果

- flat 模式：`标题 [工作区] 3分钟前` —— 每行常显工作区名（cwd basename）
- 分组模式（按工作区 / 工作区树）：自动不注入（行上已有分组头）
- **运行中的工作区自动置顶**：分组顺序官方只跟随手动拖拽的注册表顺序（「最近更新」只排
  组内会话）；本插件监听会话运行状态，把含运行中会话的工作区通过官方 `insertBefore`
  命令浮到最前（多个时按其运行中会话的最新活动时间排序）。会话停止后不自动复位，
  可随时拖拽调整。
- 悬停卡片兜底：通过官方 `sidebar.session.row.hover` 槽位显示完整工作区路径

## 安装

```bash
dsh plugin add github:ChrisLou-bioinfo/dsh-workspace-badge
```

适配 DSH `0.2.0-rc.2+`（依赖行上的 `data-row-key="session:<id>"` 锚点，0.2 起官方渲染自带）。

## 实现说明

- 纯客户端 DOM patch：`data-row-key` 取 sessionId → `ctx.sessions.list` 快照查 `cwd`
  → basename 注入行内 badge；MutationObserver + microtask 合帧，已标记行跳过。
- flat 模式判定读 localStorage `dsh.workspace.view.v5`（官方视图 store 的持久化键）。
- 搜索结果行自带工作区名，插件检测到后跳过，不重复显示。
- 宿主 DOM 结构若随版本变化，badge 静默失效，不影响列表本身。

## License

[MIT](./LICENSE)
