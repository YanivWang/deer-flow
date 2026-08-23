# DeerFlow Vue 前端

[English](README.md) | 简体中文

`frontend-vue` 是与 React 共存的 DeerFlow Nuxt 4 实现，与 `../frontend` 共用同一套
Gateway 接口，并已建立聊天工作区、产物、sidecar、浏览器控制、智能体、渠道、集成、
定时任务、设置、目标/模式、认证、Showcase、移动端布局和生产容器。基于当前源码的 API
响应消费与产品行为工作包已在本地闭环，执行清单与证据统一维护在
[PARITY_GAPS.md](PARITY_GAPS.md)。

生产环境目前仍由 React hostname 作为默认入口，只有 `DEER_FLOW_VUE_HOSTNAME` 选择
Vue。本地 parity 证据不代表可以直接切换默认入口；公网 DNS、TLS、外层代理信任、
真实 IdP callback 注册与目标环境验收仍需在生产切流前完成。

## 文档入口

- [PARITY_GAPS.md](PARITY_GAPS.md)：基于当前源码的 React/Vue 可平替审计、实施顺序、
  验收标准、完成证据与剩余环境风险；本地门禁全绿不是生产切流证据。
- [ARCHITECTURE.md](ARCHITECTURE.md)：当前分层、运行数据流、状态所有权、代理与认证边界。
- [BEHAVIOR_CONTRACTS.md](BEHAVIOR_CONTRACTS.md)：修改时必须保留的产品、流式、顺序、
  缓存、面板与 Vue 语义。
- [REUSE.md](REUSE.md)：私有 `@deerflow/agent-core` 与可复用 UI 边界。
- [双前端生产说明](../docs/dual-frontend-production.md)：hostname、OIDC、验证和回滚。
- [app/core/PROVENANCE.md](app/core/PROVENANCE.md)：`app/core/` 当前源码溯源台账。
- [I18N_INVENTORY.md](I18N_INVENTORY.md)：实时产品 SFC 文案清单、翻译/动态内容分类与
  source guard 边界。

## Docker 运行

在仓库根目录启动统一的 Docker 开发栈：

```bash
make docker-start
```

Vue 访问 `http://vue.localhost:2026`，React 仍访问 `http://localhost:2026`。两个前端都在
容器内运行框架开发服务器；Compose Watch 同步源码以触发 HMR，依赖清单变化则重建对应镜像。
命令会保持前台运行，使用 `Ctrl+C` 停止。

## 本地运行

在仓库根目录执行：

```bash
make dev-vue   # Gateway :8001 + Vue :3100
make dev-dual  # Gateway :8001 + React :3000 + Vue :3100
make stop
```

只运行 Vue 工作区：

```bash
cd frontend-vue
make install
make dev       # http://localhost:3100
```

如果希望 shell 留在仓库根目录，可使用等价命令 `make -C frontend-vue dev`。

## 验证改动

先运行与改动最相关的最小门禁，常规模块改动最终运行 `make verify`：

```bash
make verify
make consumer-check     # 修改 packages/agent-core 时运行
make e2e-list           # 查看共享浏览器合同清单
make e2e-m5             # artifacts、sidecar 与面板生命周期合同
make e2e-m5-real-backend # 真实 Gateway artifact Range/PUT/冲突合同
make e2e-m6             # 包含 Vue 自有 browser DOM/wire 合同
make e2e-m6-real-backend # 真实本地 Gateway + Chromium browser runtime
make e2e-m7             # 完整 Vue 浏览器合同：29 files / 165 tests
make i18n-source-check  # 全部产品 Vue SFC 的 AST 文案门禁
make e2e-wp07-real-backend # 真实 Gateway scheduled-task HTTP/UI 生命周期
make e2e-wp08-real-backend # 真实 Auth/Gateway/SQLite channel 生命周期
make e2e-wp09-real-backend # 真实 Auth/Gateway/setup_agent/Agent 持久化
make e2e-wp10-real-backend # 真实 Auth/DeerMem/Noop/Skills/MCP 设置生命周期
make e2e-wp11-real-backend # 真实 Auth/thread/workspace-changes 壳层生命周期
make e2e-m7-auth        # 认证请求与安全
make proxy-security     # Nitro body 限制、无 body/chunked DELETE、SSE 与 traversal
make e2e-m7-real-protocol
make e2e-m7-visual
make asset-budget
make container-smoke
```

执行 `make help` 可查看全部代理、协议、真实 Gateway、视觉、清单和维护命令。部分命令名
保留 `m0`–`m7` 历史测试套件标识；它们是稳定的测试入口，不表达可平替差异的完成状态。

## 运行配置

浏览器默认使用同源请求，由 Nuxt 代理到 `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL`（默认
`http://127.0.0.1:8001`）。也可以配置公开 base URL，绕过对应的同源代理：

```bash
NUXT_PUBLIC_LANGGRAPH_BASE_URL=http://localhost:8001/api
NUXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8001/api
```

`DEER_FLOW_AUTH_DISABLED=1` 只用于隔离的合同测试环境。真实认证必须通过同源的
Nuxt/Gateway 链路验证。`NUXT_PUBLIC_M0_TEST_PAGES=1` 只为测试开放内部视觉 fixture；
变量名为了兼容现有测试配置而保留。

生产路由、OIDC callback 规则和回滚命令统一维护在
[双前端生产说明](../docs/dual-frontend-production.md) 中。

## 浏览器控制

面板默认进入 Live；切到 Static 时保留最后可见帧，Live transport 不可用时使用 Gateway
REST 导航。URL/title 只接受 Gateway WebSocket 事件或 REST 响应。关闭面板、切换线程或
feature 禁用都会停止重连 timer、socket 和未完成 REST。详细所有权与输入/清理硬合同见
[ARCHITECTURE.md](ARCHITECTURE.md) 和 [BEHAVIOR_CONTRACTS.md](BEHAVIOR_CONTRACTS.md)。

## Artifacts

Artifact 能力只由显式的路径/source 策略决定：已知 UTF-8 文本和代码可加载，图片、音频、
视频与 PDF 使用专用预览；Office、archive、SVG、无扩展名和未知二进制一律 fail closed 为
仅下载。MIME 元数据不能把未知文件提升为可编辑文本。正式 HTML 只有完整加载并通过文档
完整性检查后才创建预览。

只有 `/mnt/user-data/outputs` 下完整加载且带 SHA-256 修订的正式 UTF-8 文件可以编辑。
保存携带已加载修订；Gateway 冲突或权限错误会保留本地草稿。dirty 草稿统一保护切文件、
关面板、切线程、路由离开和页面关闭。打开与下载会先执行带认证的一字节 Range 预检；
安装 Skill 只对真实 skill artifact 和具备管理员权限的当前用户开放。

## 定时任务

工作区定时任务页面支持 Gateway 实际拥有的 `once` 与 `cron` 类型、
hourly/daily/weekly/monthly/custom cron、可编辑 IANA 时区、DST-aware 单次时间转换、
新建 thread 或复用现有 thread 的 context，以及内置 recipes。编辑时保持 schedule type
不可变；暂停、恢复、立即触发和二次确认删除分别使用 Gateway 的专用 endpoint。筛选覆盖两种
类型和全部六种 task 状态；运行历史使用明确的 `limit/offset` 分页，并展示全部 run 状态、
时间、thread/run ID 和错误。

`make e2e-wp07-real-backend` 会启动真实本地 FastAPI Gateway、SQLite、Nuxt preview 与
Playwright Chromium，覆盖真实 once/cron 创建与校验、context/thread 权限、PATCH、
pause/resume、trigger、分页 run 记录和 delete。模型侧使用签入的 replay fixture，认证也处于
测试隔离模式；该门禁不证明生产 scheduler/模型、真实时间推进、DNS/TLS、外层代理信任或
真实 IdP。

## Channels

Channel provider 只描述服务端能力与运行时配置，不拥有用户连接状态。当前认证用户的
`/api/channels/connections` 响应是连接状态和账号 instance 的唯一真相，同一 provider 可同时
展示多个账号。Connect 会精确消费 Gateway 的 URL、instruction 与有限 expiry：deep link
通过同步预开的浏览器窗口打开，轮询只观察当前用户 scope 下的 connections，直到新增账号
成功、过期或取消。query、mutation、poll 与 AbortController cleanup 全部由
`useChannelConnections` 独占。

Settings 明确区分两种破坏性操作：用户按准确 connection ID 断开单个账号；管理员移除
provider runtime 配置，该操作会在实例级撤销此 provider 的有效连接。
`make e2e-wp08-real-backend` 使用受控外部 worker/callback fixture，真实验证
FastAPI/Auth/CSRF/SQLite 路由与 Vue 收敛；它不证明 Slack、Telegram、Discord、Feishu 等
真实平台授权、生产凭据、真实 deep-link handler、DNS/TLS、外层代理或真实 IdP。

## Agents

Agent 创建在 bootstrap 期间保留 new-agent 页面，同时把预先创建的真实 thread 作为可见流
scope。Save 只发送一条隐藏 human 指令，再将名为 `setup_agent` 的
`AIMessage.tool_calls` 与相同 `ToolMessage.tool_call_id` 关联；只有明确的
`status: "success"` 才进入有限可见性验证。tool/run 错误和耗尽 404 重试都会保持可见且可重试；
重复点击复用同一个在途 owner，路由或 scope 销毁会同时中止 run 和有界的
`GET /api/agents/{name}` 验证。

Gallery 和模型目录的服务端状态分别只归 `useAgents`、`useModels`。设置从真实模型响应选择，
精确提交 `model`、`model_settings`、`thinking_enabled`、`reasoning_effort`，包括显式
`false`、数值零，以及切换到不支持 capability 的模型时用 `null` 清理旧配置。卡片保留
skills/tool groups 的响应顺序和重复项；`tool_groups: null` 明确显示为不限制已配置分组，
`[]` 明确显示为没有配置分组。

`make e2e-wp09-real-backend` 真实经过 FastAPI Auth/CSRF/features/models、thread/run router、
LangGraph、`setup_agent`、SQLite Agent 持久化、用户隔离和 Vue UI 收敛；只有外部 LLM
被确定性模型替换。该门禁不证明生产模型/provider、生产模型凭据、真实 IdP、DNS/TLS、
外层代理或生产部署。

## Memory 与管理员设置

Memory 是用户隔离的服务端状态，只由 `useMemory` 持有。页面支持搜索、confidence 筛选、
精确的 `0`～`1` confidence 编辑、导出，以及带确认的新增、编辑、删除与清空，不在组件内
复制 Gateway 响应。导入只接受完整 export 结构，并先展示覆盖预览。malformed、storage
不接受的 fact 和重复 fact ID 会在请求前拒绝；未知字段及不同 ID 的重复 content 会保留到
预览并明确警告。Gateway 按请求模型校验时可能忽略 forward-compatible 未知字段。

普通认证用户可以读取 Skills，但只有管理员可以启停；MCP 配置的读取和写入都只允许管理员，
因此 session 已证明是普通用户时，Vue 不会发送 MCP 请求。auth-disabled 合同环境沿用
Gateway 的管理员语义，不额外发明 static role。每次 mutation 只发送文档定义的字段，成功后
重读共享 TanStack Query 缓存；权限错误与未认证、普通传输错误分别展示。

`make e2e-wp10-real-backend` 通过 Nuxt 与 Playwright Chromium 真实经过本地 Auth/CSRF、
FastAPI router、用户隔离 DeerMem、独立真实 Noop manager、skill discovery/config write、MCP
原子配置写入和 secret masking，并固定 malformed 422、校验 400、missing 404、duplicate 与
revision-conflict 409、corrupted-storage 500、unsupported 501。fixture 只 seed operator-owned
skill/MCP 输入文件，并仅为损坏后恢复自身 manifest 的断言暴露本轮隔离临时 home。该门禁不
证明 Mem0/Honcho/OpenViking、真实外部 MCP 进程、生产 SkillScan/LLM/IdP/凭据、DNS/TLS、
外层代理或部署。

## Workspace 壳层与 Workspace Changes

workspace layout 只持有一个 command palette、settings host 和 toast store。palette 实现
React 当前跨平台快捷键集合，并排除 repeat、IME 和 editable target 冲突。Settings 由路由
持有：`?settings=<section>` 打开具备 focus trap 的 dialog，关闭只移除该 query key，浏览器
前进/后退恢复同一深链和焦点边界。Gateway unavailable 与 authenticated recovery 共用唯一
session Query owner，包括路由 middleware 先于 banner 挂载写入 unavailable 的时序。

每个 recent-thread menu 独立持有 rename、pin、share、export 和 delete 状态。Share 沿用纯
客户端稳定 URL/clipboard 合同，不发明 Gateway endpoint；Export 先加载真实 thread state，
再调用已有 serializer，并始终释放临时 anchor 与 object URL。列表 recency 只从 Gateway
`updated_at` 渲染。

Workspace-change summary/detail 使用独立 TanStack Query identity，完整包含 thread、run 和
两个 include flag。identity 切换会中止旧请求，late response 不能覆盖当前结果。UI 保留 summary
truncated、四种 status、五种精确 diff unavailable reason、保真 Gateway error 与显式 retry。

`make e2e-wp11-real-backend` 通过 Nuxt 与 Chromium 真实经过本地 Auth/CSRF/FastAPI Gateway、
thread/checkpoint、run-event store、production owner check 和 workspace-changes response builder。
隔离的 test-only seed 只向 Gateway 自身 event store 写一条受控 workspace event；include 过滤、
状态/reason 保留、认证、跨用户拒绝、thread state、clipboard 和下载仍是生产路径。唯一注入的
503 只用于证明 unavailable 到真实 session 的恢复；该门禁不证明生产 IdP、DNS/TLS、外层
代理或部署。

## 流式与历史行为

聊天 run 显式订阅 `values`、`messages-tuple`、`updates` 和 `custom`。task 生命周期与
`llm_retry` custom 事件统一折叠为 thread-scoped UI 状态；子任务卡片展示状态、模型、累计
token 和实时步骤，刷新后展开卡片可回填持久化步骤。长会话初次只请求最新一页历史，只有
显式按钮或用户向上滚动后才加载更早页面。已建立会话的 `/compact` 会调用真实 Gateway
接口；Gateway 拒绝时保留草稿并展示原始错误。
