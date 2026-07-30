# 08 · 组件体系与 UI 约定

## 8.1 三类组件

| 类别 | 目录 | 来源 | 是否可改 | ESLint |
| --- | --- | --- | --- | --- |
| **UI 原语** | `components/ui/`（44） | Shadcn UI / MagicUI / React Bits registry | ❌ | ignored |
| **AI 元素** | `components/ai-elements/`（28） | Vercel AI SDK Elements registry | ❌ | ignored |
| **业务组件** | `workspace/` `landing/` `docs/` `auth/` + 根 2 个 | 手写 | ✅ | 全规则 |

生成目录里既有标准原语（`button` `dialog` `select` `sidebar` `resizable` `command`…），
也有视觉特效件（`aurora-text` `flickering-grid` `galaxy` `magic-bento`
`shine-border` `spotlight-card` `number-ticker` `confetti-button` `terminal`）。
后者主要服务落地页。

`ai-elements/` 里被业务重度依赖的几个：
`prompt-input`（输入框受控状态 + `PromptInputProvider`）、`conversation`、
`message`、`reasoning`、`task`、`artifact`、`code-block`、`streamdown`、
`sources`、`web-preview`、`model-selector`、`chain-of-thought`、`plan`、`checkpoint`。

> **重构约束**：需要改生成组件行为时，正确做法是在业务层包一层，
> 而不是直接编辑 `ui/` 或 `ai-elements/` —— 下次从 registry 重新生成会覆盖。

## 8.2 `components/workspace/` 结构

```
workspace/
├── chats/           ChatBox（右面板布局）+ use-thread-chat + use-chat-mode
├── messages/        MessageList → MessageListItem → MessageGroup
│                    + SubtaskCard / HumanInputCard / MarkdownContent
│                    + RunDuration / MessageTokenUsage / Skeleton / context
├── artifacts/       ArtifactTrigger / ArtifactFileList / ArtifactFileDetail + context
├── sidecar/         SidecarTrigger / SidecarPanel / ReferenceAttachments + context
├── browser-view/    BrowserTrigger / BrowserViewPanel / use-browser-stream / keyboard + api + context
├── changes/         WorkspaceChangeBadge / WorkspaceChangePanel
├── agents/          AgentCard / AgentGallery / AgentSettingsDialog(+helpers)
├── channels/        WorkspaceChannelsList / ChannelRuntimeConfigDialog / ChannelProviderIcon
├── citations/       CitationLink / ArtifactLink / CitationSourcesPanel
├── settings/        11 个设置页 + SettingsDialog + SettingsDialogHost + store
└── 根（~30 文件）    InputBox(+helpers) / GoalStatus(+helpers) / TodoList / ThreadTitle
                     WorkspaceSidebar / WorkspaceHeader / WorkspaceNavMenu / CommandPalette
                     TokenUsageIndicator / ExportTrigger / CodeEditor / Welcome …
```

### 组件体量分布（业务组件 Top）

| 文件 | 行数 |
| --- | --- |
| `input-box.tsx` | **2,859** |
| `messages/message-list.tsx` | 1,423 |
| `messages/message-group.tsx` | 1,022 |
| `settings/memory-settings-page.tsx` | 993 |
| `sidecar/sidecar-panel.tsx` | 975 |
| `settings/integrations-settings-page.tsx` | 884 |
| `artifacts/artifact-file-detail.tsx` | 802 |
| `messages/message-list-item.tsx` | 758 |
| `messages/human-input-card.tsx` | 588 |
| `chats/chat-box.tsx` | 467 |
| `browser-view/browser-view-panel.tsx` | 462 |

## 8.3 右侧面板布局（重构高危区）

**三个右面板（artifacts / sidecar / browser）共用同一个 `ResizablePanelGroup`**，
由 [chats/chat-box.tsx](../frontend/src/components/workspace/chats/chat-box.tsx) 拥有。
这里有五条不能违反的约束（issue #4465 就是违反了第一条）：

### ① 不允许按面板种类分叉出"非 resizable"分支
曾经因为这个，artifacts 的分隔线**静默丢掉了拖拽手柄**。三种面板必须走同一条渲染路径。

### ② 开合用 `collapse()` / `resize()`，不是条件渲染
面板开关通过侧面板 imperative handle 上的命令式调用完成，这样宽度才能做动画。

### ③ 尺寸过渡加在 group 上，且只在开合进行中
```
[&>[data-panel]]:transition-[flex-grow]
```
- 加在 **group** 上而非子元素，因为真正被 flex 定尺的是库自己的 `[data-panel]`
  元素，不是 `className` 落在的那个子节点。
- **只在开/合进行中**应用，否则拖拽会被逐帧插值。

### ④ 动画期间面板内容锁定在最终宽度（`cqw`）并裁剪
- 消息列表若在动画中回流，会重跑 scroll-to-bottom
  （被 `tests/e2e/sidecar-chat.spec.ts` 的 no-animated-scroll 测试钉住）。
- 会重排的 composer 会改变它显示哪些响应式标签。

### ⑤ `0%` 的处理：只认 `onLayoutChanged`，不认 `onResize`
因为面板是 `collapsible` 的，拖拽越过 `minSize` 时库可以**自行**把它折叠到 `0%`，
不经过拥有它的 state。
- `onResize` 只在指针移动期间记录最后一个正数尺寸。
- `sidecar` / `browserView` / `artifactsOpen` 这三个 state **只能镜像
  `onLayoutChanged` 里的最终 `0%` 布局**（指针释放之后）。
- 在第一个 `0%` resize 帧就关闭，会破坏"拖到边缘再往回拖然后松手"的连续手势。

相关常量：`RIGHT_PANEL_ANIMATION_MS = 280`、`RIGHT_PANEL_DEFAULT_SIZE = "40%"`。
移动端走 `Sheet` 而非 resizable（`useIsMobile()`）。

## 8.4 其他单点约束

### BrowserViewPanel 的点击
[browser-view-panel.tsx](../frontend/src/components/workspace/browser-view/browser-view-panel.tsx)
把每个物理指针点击**转发为一个 `click` 输入**。
❗ 不要同时为同一手势再发 `down` / `up`——远端 Playwright 的 click 会执行两次。

### MessageList 的职责边界
`MessageList` 拥有：
- human-input 卡片的 answered / latest / pending 判定
- 刚完成 turn 的临时客户端 run 时长
- 最新可编辑 user turn 的检测与内联编辑器渲染

`MessageList` **不拥有**：branch / edit-regenerate 的提交（页面拥有，见
[03-routing-and-pages.md §3.6](03-routing-and-pages.md#36-页面级职责归属不可下沉到组件)）。

### sidecar 内的 MessageList 是受限实例
sidecar 面板里的 `MessageList` **不接收** branch action。新增 message-level 交互时
要显式决定它在 sidecar 里是否可用。

## 8.5 样式约定

- **Tailwind CSS 4**，`@import` 语法，主题走 CSS 变量
  （[src/styles/globals.css](../frontend/src/styles/globals.css)，唯一一个全局 CSS 文件）。
- 条件 class **必须**用 `cn()`（`@/lib/utils`，clsx + tailwind-merge）。
- 自定义容器宽度用 CSS 变量：`max-w-(--container-width-sm)` / `-md`。
- 深色模式：`next-themes` 的 `attribute="class"` + `enableSystem` +
  `disableTransitionOnChange`。
- Prettier 配 `prettier-plugin-tailwindcss`（class 自动排序）。
- 少量 `.css` 伴随生成组件（`galaxy.css` `magic-bento.css` `spotlight-card.css`）。

## 8.6 交互细节的既有处理

| 问题 | 解法 | 位置 |
| --- | --- | --- |
| 中文输入法组合态下回车不应发送 | `lib/ime.ts` 判定 composition | `InputBox` |
| 滚动跟随 | `use-stick-to-bottom` | `MessageList` |
| 移动端断点 | `hooks/use-mobile.ts` | 多处 |
| 全局快捷键 | `hooks/use-global-shortcuts.ts` | `CommandPalette` 等 |
| 过度滚动视觉 | `workspace/overscroll.tsx` | 聊天区 |
| Gateway 掉线 | `GatewayOfflineBanner` + `GatewayOfflineFallback`（后者自带 AuthProvider） | workspace layout / content |
| 设置弹窗深链 | `WorkspaceSettingsDeepLink` + `settings-dialog-store.ts` | workspace content |

⚠️ `GatewayOfflineBanner` 已在 `WorkspaceContent` 的侧栏布局内挂载，
所以 `GatewayOfflineFallback` 传 `renderBanner=false`，避免双挂载。
