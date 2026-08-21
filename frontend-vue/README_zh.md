# DeerFlow Vue 前端

[English](README.md) | 简体中文

`frontend-vue` 是与 React 共存的 DeerFlow Nuxt 4 实现，与 `../frontend` 共用同一套
Gateway 接口，并已建立聊天工作区、产物、sidecar、浏览器控制、智能体、渠道、集成、
定时任务、设置、目标/模式、认证、Showcase、移动端布局和生产容器。当前源码审计仍发现
API 响应消费和产品行为差异，统一维护在 [PARITY_GAPS.md](PARITY_GAPS.md)。

生产环境目前仍由 React hostname 作为默认入口，只有 `DEER_FLOW_VUE_HOSTNAME` 选择
Vue。这只是部署拓扑，不能证明 Vue 已具备替换 React 的条件；
[PARITY_GAPS.md](PARITY_GAPS.md) 中的 P0/P1 项关闭前不能切换默认入口。公网 DNS、TLS、
外层代理信任和真实 IdP callback 注册仍需在目标环境配置。

## 文档入口

- [PARITY_GAPS.md](PARITY_GAPS.md)：基于当前源码的 React/Vue 可平替差异、实施顺序、
  验收标准与完成证据；现有门禁全绿不能作为这些差异已经关闭的证明。
- [ARCHITECTURE.md](ARCHITECTURE.md)：当前分层、运行数据流、状态所有权、代理与认证边界。
- [BEHAVIOR_CONTRACTS.md](BEHAVIOR_CONTRACTS.md)：修改时必须保留的产品、流式、顺序、
  缓存、面板与 Vue 语义。
- [REUSE.md](REUSE.md)：私有 `@deerflow/agent-core` 与可复用 UI 边界。
- [双前端生产说明](../docs/dual-frontend-production.md)：hostname、OIDC、验证和回滚。
- [app/core/PROVENANCE.md](app/core/PROVENANCE.md)：`app/core/` 当前源码溯源台账。

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
make e2e-m7             # 完整 Vue 浏览器合同
make e2e-m7-auth        # 认证请求与安全
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
