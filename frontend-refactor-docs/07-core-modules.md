# 07 · `core/*` 模块清单

36 个领域目录、142 个文件。按职责聚类如下。

## 7.1 传输与配置（基础设施）

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| `api/` | `api-client.ts`(471) `fetcher.ts` `stream-mode.ts` `errors.ts` `feedback.ts` `index.ts` | LangGraph client 单例 + 包装、CSRF fetch、stream mode 白名单、错误映射 |
| `config/` | `index.ts` | `getBackendBaseURL()` / `getLangGraphBaseURL(isMock)` |
| `static-mode.ts` | 单文件 | `isStaticWebsiteOnly()` |
| `clipboard.ts` | 单文件(258) | 富文本/HTML 复制 |

## 7.2 会话核心

| 模块 | 关键文件 | 职责 |
| --- | --- | --- |
| `threads/` | `hooks.ts`(**3072**) `api.ts` `types.ts` `utils.ts` `token-usage.ts` `composer-draft.ts` `export.ts` `thread-search-query.ts` `static-demo.ts` | 流编排、历史合并、thread CRUD、路径构造、草稿、导出 |
| `messages/` | `utils.ts`(861) `human-input.ts`(588) `usage-model.ts`(440) `usage.ts` `run-duration.ts` `workspace-change-anchor.ts` | 消息分组、human-input 协议、token 用量模型、run 级 anchor |
| `tasks/` | `context.tsx` `steps.ts` `lifecycle.ts` `types.ts` `api.ts` `presentation.ts` `subtask-result.ts`(271) `subtask-update.ts` | 子任务（subagent）时间线与状态 |
| `todos/` | `index.ts` `types.ts` | 待办列表 |
| `tools/` | `utils.ts` | 工具调用展示辅助 |

`threads/utils.ts` 的关键导出：
- `pathOfThread()` — **构造 Web UI 聊天路径的唯一入口**，会对自定义 agent 名和
  thread id 都做 percent-encode。禁止手拼路径。
- `THREAD_PINNED_METADATA_KEY = "deerflow_pinned"`、`isThreadPinned()`、`sortPinnedThreads()`
- `channelSourceOfThread()` — 解析 thread 的 IM 渠道来源
- `titleOfThread()`、`textOfMessage()`

## 7.3 内容渲染

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| `streamdown/` | `components.tsx` `plugins.ts` `preprocess.ts`(389) `mermaid.ts` `safe-children.ts` | 流式 Markdown：共享插件配置、预处理、Mermaid、children 安全读取 hook |
| `artifacts/` | `preview.ts`(595) `loader.ts` `hooks.ts` `utils.ts` | 产物加载、预览类型判定、HTML 完整性检查 |
| `citations/` | `sources.ts` | 引文来源解析 |
| `blog/` | `index.ts`(357) | MDX 博客索引与元数据 |
| `utils/` | `markdown.ts` `files.tsx` `datetime.ts` `json.ts` `uuid.ts` | 通用工具（`files.tsx` 返回图标 ReactNode） |

## 7.4 能力与配置面板

| 模块 | 职责 |
| --- | --- |
| `models/` | 模型列表、`tokenUsageEnabled` |
| `skills/` | 技能列表/启停 + `slash.ts`（斜杠技能解析） |
| `mcp/` | MCP server 配置与启停 |
| `memory/` | 持久记忆 CRUD / 导入导出 |
| `agents/` | 自定义 agent CRUD + `feature-cache.ts`（功能可用性缓存） |
| `features/` | `/api/features` 功能开关发现（`useBrowserControlEnabled`） |
| `settings/` | `local.ts`（结构+安全存储门面）`store.ts`（external store）`hooks.ts` |
| `scheduled-tasks/` | 定时任务 CRUD + `cron.ts`(338)（cron 表达式解析/生成）+ `recipes.ts`（预设） |
| `suggestions/` | 建议配置 + `placeholders.ts` |
| `channels/` | IM 渠道连接：`provider-state.ts` `connect-poll.ts` `open-connect-url.ts` |
| `integrations/lark/` | Lark CLI 托管集成的安装/授权/配置四步流程 |
| `notification/` | 浏览器通知（`useNotification`） |

## 7.5 输入辅助

| 模块 | 职责 |
| --- | --- |
| `input-polish/` | `api.ts` — 提交前草稿润色（`POST /api/input-polish`） |
| `voice-input/` | `speech-recognition.ts` — 浏览器语音识别封装，转写进本地草稿 |
| `uploads/` | `api.ts` `hooks.ts` `file-validation.ts` `prompt-input-files.ts` — 附件上传与校验 |

## 7.6 会话辅助面板

| 模块 | 职责 |
| --- | --- |
| `sidecar/` | 副驾会话：`api.ts`（找最近 sidecar thread）`thread.ts` `context.ts` `reference-metadata.ts` `reference-state.ts` |
| `workspace-changes/` | run 级变更文件汇总与 diff 拉取：`api.ts` `hooks.ts` `summary.ts` `types.ts` |

## 7.7 鉴权与国际化

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| `auth/` | `server.ts`（SSR 五态判定）`AuthProvider.tsx` `types.ts`（`userSchema`/`buildLoginUrl`/`assertNever`）`gateway-config.ts` `proxy-policy.ts` `remember-login.ts` `setup.ts` `constants.ts` `static-user.ts` `auth-disabled-user.ts` 🔴 `next-path.ts`（登录后跳转目标校验，上游 #4587） | 鉴权全链路 |
| `i18n/` | `context.tsx` `hooks.ts` `server.ts` `locale.ts` `cookies.ts` `translations.ts` + `locales/{en-US,zh-CN,types,index}.ts` | 双语（en-US / zh-CN） |

### i18n 的结构与代价

```
locales/types.ts    888 行   ← 翻译字典的类型定义（结构约束）
locales/en-US.ts   1123 行
locales/zh-CN.ts   1072 行
```

`t` 是一个**强类型嵌套对象**（不是 key 字符串查表），所以加一条文案要改三个文件。
churn 数据显示这三个文件是全前端修改最频繁的（92 / 92 / 81 次），
但这属于**结构性成本而非坏味道**——类型安全的收益是编译期就能发现漏翻。

用法：客户端 `useI18n()` 拿 `{ t, locale, setLocale }`；
服务端 `detectLocaleServer()` 读 cookie。`I18nProvider` 切换语言时写
`locale` cookie（`max-age=31536000`）。

## 7.8 模块规模分布

| 行数区间 | 文件数（core 内） | 代表 |
| --- | --- | --- |
| > 1000 | 3 | `threads/hooks.ts`(3072)、`i18n/locales/en-US.ts`(1123)、`zh-CN.ts`(1072) |
| 500–1000 | 5 | `i18n/locales/types.ts`(888)、`messages/utils.ts`(861)、`artifacts/preview.ts`(595)、`messages/human-input.ts`(588) |
| 200–500 | ~12 | `api/api-client.ts`(471)、`messages/usage-model.ts`(440)、`streamdown/preprocess.ts`(389)、`blog/index.ts`(357)、`scheduled-tasks/cron.ts`(338)、`tasks/subtask-result.ts`(271)、`clipboard.ts`(258) |
| < 200 | 其余 ~120 | 绝大多数模块 |

**结论**：`core` 的粒度整体健康，问题高度集中在 `threads/hooks.ts` 一个文件上。
详见 [10-refactor-hotspots.md](10-refactor-hotspots.md)。

## 7.9 模块内文件命名约定

| 文件名 | 含义 | 使用率 |
| --- | --- | --- |
| `api.ts` | HTTP 调用层（用 `fetchWithAuth`） | 高（17 个模块有） |
| `hooks.ts` | TanStack Query 封装 | 高（17 个模块有） |
| `types.ts` | 领域类型 | 高（`skills/` 例外，用单数 `type.ts`） |
| `index.ts` | re-export 门面 | 中（部分模块只 `export * from "./types"`） |
| `context.tsx` | React Context（仅 `tasks/`、`i18n/`） | 低 |
| 其他具名 | 纯函数模型（`steps.ts` `lifecycle.ts` `preview.ts` `summary.ts` `cron.ts` `slash.ts`） | — |

**新增模块请沿用这套四件套。** 纯函数模型单独成文件（而不是塞进 `hooks.ts`）
是本项目可测试性的主要来源——97 个单元测试里 71 个测的是 `core/`。
