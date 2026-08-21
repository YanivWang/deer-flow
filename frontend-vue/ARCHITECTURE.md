# Vue 前端架构

本文描述 `frontend-vue` 当前代码结构和依赖边界。它只维护长期有效的实现事实；阶段计划、
迁移过程和单次验收结果不属于本文件。

> **状态边界：** 本文件描述已经存在或应保持的架构边界，不表示 L3 产品能力已与 React
> 完全对齐。当前源码确认的 API 消费、页面、流式、交互和安全差异统一维护在
> [`PARITY_GAPS.md`](PARITY_GAPS.md)。如果架构描述与实际源码不一致，以当前源码为准，
> 并在同一改动中修正文档。

## 运行拓扑

浏览器只访问同源的 Nuxt/Nginx 入口。`/api/langgraph/**` 在代理到 Gateway 前改写为
`/api/**`，其余 `/api/**` 原路径转发。Nitro catch-all
`server/routes/api/[...path].ts` 委托 `server/utils/gateway-proxy.ts`，统一执行：

- 路径穿越、Host 和请求体大小检查；
- 覆盖可信的 `Forwarded` / `X-Forwarded-*` 头；
- SSE 请求与响应流式转发；
- 手动处理重定向，避免 Gateway 的认证跳转被代理吞掉。

Docker 开发统一使用 `make docker-start`：React 与 Vue 都在容器内运行开发服务器，
Compose Watch 同步源码并在依赖清单变化时重建对应镜像；Nginx 以默认 host 选择 React，
以 `vue.localhost` 选择 Vue。本地非 Docker 开发时，`make dev-vue` 启动 Gateway `:8001`
和 Vue `:3100`。生产 Compose 同时构建 React 与 Vue，由 Nginx 按 hostname 选择：
未知/default host 仍进入 React，只有 `DEER_FLOW_VUE_HOSTNAME` 进入 Vue。部署细节见
[`../docs/dual-frontend-production.md`](../docs/dual-frontend-production.md)。

## 三层边界

| 层                 | 当前目录                                                                                          | 职责                                                                   | 禁止依赖                                             |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| L1 通用 Agent 内核 | `packages/agent-core/`                                                                            | SSE 分帧、session 状态机、退避、watchdog、external store、通用消息合同 | Vue/Nuxt、Pinia、TanStack Query、DeerFlow URL/事件名 |
| L2 可复用 UI       | `app/core/markdown/`、`app/components/markdown/`、`app/components/ui/button/`、`app/lib/utils.ts` | Markdown 流式渲染、代码块、Mermaid、Button                             | DeerFlow API、线程、认证、产物和业务 store           |
| L3 DeerFlow 应用   | `app/core/agent-deerflow/`、`app/core/api/`、`app/composables/`、`app/stores/`、页面和业务组件    | Gateway 协议适配、缓存、线程生命周期、认证和产品功能                   | 不得把协议专有知识反向写入 L1/L2                     |

`@deerflow/agent-core` 只允许从包根导入。`package.json#exports` 和
`packages/agent-core/tests/architecture.test.ts` 同时阻止深路径依赖。包仍是私有源码包，
没有发布到 npm；复用方式见 [`REUSE.md`](REUSE.md)。

## 聊天数据流

1. `useThreadStream.ts` 创建当前会话的运行上下文，并通过
   `app/core/agent-deerflow/thread-runner.ts` 装配 L1 session 与 DeerFlow `RunProtocol`。
2. `run-protocol.ts` 负责 create/resume/cancel/inspect；`event-map.ts`、`message-adapt.ts`
   和 `reducer.ts` 把 Gateway wire 事件转换成内核动作。
3. `packages/agent-core/src/session/` 管理 create-once、resume 游标、gap、重试、取消和终态；
   `src/store/` 合并同一宏任务内的通知并发布不可变 snapshot。
4. TanStack Query/composable 将 live snapshot、checkpoint 历史、乐观消息和分页数据
   合并为 UI 状态。`useThreads.ts` 是主线程列表的唯一 server-state 所有者，Pinia 不保留
   第二份列表。排序、sidecar 过滤与身份规则集中在 `app/core/threads/`。
5. custom 帧由 `tasks/custom-event.ts` 统一折叠 task 生命周期、步骤、累计 token、模型和
   `llm_retry`；`SubtaskCard.vue` 展开历史 run 时才回填持久化步骤。
6. `MessageList.vue`、composer、产物/sidecar/browser 面板消费同一线程状态；产物面板等扩展
   通过事件和 panel state 接入，不改变 L1 session 状态机。

流式重连、消息顺序、缓存失效和面板行为的硬合同见
[`BEHAVIOR_CONTRACTS.md`](BEHAVIOR_CONTRACTS.md)。

## 路由、渲染与认证

- `config/routes.ts` 是 CSR/prerender 分区、代理常量和转发头策略的单一来源。
- `/workspace/**`、登录/设置/认证回调使用 CSR；首页、价格和关于页可预渲染。
- `app/core/auth/session-query.ts` 与 `app/composables/useAuthSession.ts` 是 Gateway session
  的唯一服务端状态来源。全局 middleware 通过同一个 Vue Query key 做路由判定，workspace
  banner 复用该缓存做后台/手动恢复；401 才进入登录，Gateway unavailable 保留当前工作区
  并显示可见恢复路径，不清 session/cookie。
- `/auth/callback` 复用同一 session query，按 `next-path.ts` 的规则拒绝开放重定向，并把
  authenticated、401、Gateway unavailable 收敛为不同状态和 replace 跳转。`/workspace`
  在真实模式固定 replace 到 `/workspace/chats/new`，不恢复 static demo/mock 分支。
- 密码和 access token 不进入前端存储，CSRF/HttpOnly cookie 由 Gateway 管理。
- 双 hostname OIDC 依赖请求 Host/Proto 重建回调地址。目标环境仍需配置真实 DNS、TLS、
  外层可信代理和 IdP callback allowlist；本地 fixture 不能替代这些部署配置。

## 状态所有权

以下是目标所有权边界。当前尚未完全遵守的缓存失效、thread-scoped composer、sidecar
生命周期等事项以 [`PARITY_GAPS.md`](PARITY_GAPS.md) 为执行清单。

- 线程列表、历史页和 token usage：TanStack Query 缓存；`useThreads.ts` 负责主列表的
  raw-offset 分页和 sidecar 过滤，失效/删除镜像规则在 `app/core/threads/cache-invalidation.ts`。
- 当前流、乐观消息、prepared replay 掩码、task/retry 状态：thread composable 的
  thread-scoped ref；切换 thread、stop、error、finish 或 scope dispose 时按合同收敛。
- Pinia 只允许保存跨页面的客户端/UI 状态，不得复制 thread/session 等服务端真相。
- artifacts、sidecar、browser：各自 composable 持有面板状态，但最终业务数据仍来自同一
  thread snapshot/API。
- composer draft、上传、语音和通知是前端瞬态状态；不得错误跨 thread 复用。
- locale 使用 `app/core/i18n/`、`app/plugins/i18n.ts` 与兼容 cookie；字典完整性由
  `make i18n-check` 守护。

## 验证入口

```bash
cd frontend-vue
make verify          # lint、格式、类型、单测、清单、i18n、OpenAPI、header、build
make consumer-check  # 打包并在隔离 consumer 中验证 @deerflow/agent-core
make e2e-list        # 列出共享产品合同
make e2e-m7          # 当前完整 Vue 浏览器合同入口（名称为既有测试套件标识）
make container-smoke # 生产镜像、health、SIGTERM、Showcase 资源与拒绝策略
```

Makefile 中保留的 `m0`、`m4a`、`m7` 等名称是已经稳定下来的测试套件标识，不表示项目仍在
迁移，也不表示可平替差异已经关闭。新增功能应按实际影响选择 unit、协议、浏览器、视觉、
真实 Gateway 或生产镜像门禁，不要从旧阶段编号或单次全绿推断完成状态。
