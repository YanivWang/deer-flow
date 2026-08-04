# 07 · 并行运行与后端共用

`frontend-vue/` 与现有 `frontend/` 在同一仓库内并存、同时运行、共用同一套 Gateway 接口。

> M-1 已冻结最终接线：开发用 Next `3000`、Vue `3100`、Gateway `8001`；生产用两个独立 hostname 的对称同源 nginx/ingress，共享一个 Gateway。完整矩阵见 [09-m1-contract-freeze.md](09-m1-contract-freeze.md)。

## 原则：隔离业务代码，但完整接入仓库

`frontend/` 的产品代码和共享 E2E spec 保持只读；`backend/` 只有在 OIDC 双入口确实需要扩展时才改。但 workflow、pnpm runner、README/AGENTS，以及生产 profile 需要的 nginx/compose 是正常集成范围。

“并存”不能靠一个孤立目录自称完成。开发、干净 CI、认证、WS 和生产入口都必须有明确接线与测试。

### 当前提前存在的 workflow

`.github/workflows/frontend-vue-verify.yml` 已按 [06 G0-0](06-migration-plan.md#g0-0--ci-workflow-对齐) 修成预备态：目录不存在时安全跳过；目录存在时从 clean checkout 安装两个前端并运行真实命令。M0 仍必须用首个 Vue skeleton 提交证明它真的工作，不能把“YAML 已写”当通过。

本地开发直接访问 3100。DeerFlow 双前端生产 profile 已冻结为对称 nginx/ingress：React 与 Vue 使用独立 hostname，但各自暴露相同的 `/api/**`、`/api/langgraph/**` 和 browser WS 路径，共用 Gateway。它复用已验证的 SSE、body limit、WS Upgrade 和同源认证；路径前缀和不同端口都不是生产默认。

## 端口分配

| 服务 | 端口 | 说明 |
| --- | --- | --- |
| Nginx | `2026` | 现有统一入口 → `frontend`(3000) + `gateway`(8001)，不动 |
| Gateway API | `8001` | 共用 |
| `frontend`（Next.js） | `3000` | 现状 |
| **`frontend-vue`（Nuxt）** | **`3100`** | 新增，`make dev` / `make preview` |
| **`frontend-vue` E2E preview** | **`3101`** | ★ 独立端口。E2E 必须跑在自己的 preview 上，不能复用 3100 上的 dev server——理由见 [03](03-project-shape.md#️-为什么-e2e-不能用-3100以及为什么-reuseexistingserver-false) |
| Provisioner | `8002` | 可选 |

### ⚠️ 本机其他项目也会抢端口

`nuxt dev` 默认就是 **3000**，与 DeerFlow 的 `frontend` 直接冲突。本机已有的 `nuxt-modern-starter` 就踩过一次相邻的坑（它的 API 端口原本是 2026，与 DeerFlow 的 nginx 撞，后来改成 2027）。

`frontend-vue` 选 3100 是有意避开的——但**任何新起的 Nuxt 项目都要显式指定端口**，别用默认值。

### ⚠️ 不要用 3001

[`frontend/playwright.auth.config.ts:3`](../frontend/playwright.auth.config.ts) 已占用 3001：

```ts
const frontendPort = process.env.E2E_AUTH_FRONTEND_PORT ?? "3001";
// webServer: `pnpm build && pnpm exec next start -p ${frontendPort}`
// reuseExistingServer: !process.env.CI
```

本地跑 auth E2E 时 `reuseExistingServer` 会**直接复用 3001 上的 Nuxt**，然后拿 Next 的 auth spec 去测 Vue 应用，失败信息毫无指向性。

## 拓扑

```
                    ┌─ frontend (Next.js)  :3000 ─┐
   nginx :2026 ─────┤                             ├─→ Gateway :8001
                    └─ /api/langgraph/* 重写 ──────┘        ↑
                                                            │
   frontend-vue (Nuxt) :3100 ── routeRules proxy ───────────┘
                                （直连，不经过 nginx）
```

## 代理：用 `routeRules`，不要用 `nitro.devProxy`

关键点：**所有 API URL 与 `frontend/` 逐字一致**，包括 `/api/langgraph/*` 前缀和全部裸 `/api/*` 路径。

`nginx.local.conf` 对 langgraph 前缀做的是 `rewrite ^/api/langgraph/(.*) /api/$1`；Nitro 的 `routeRules` 用 `**` 捕获实现同一件事：

```ts
// 条件分支逐条复刻 frontend/next.config.js:30-79
const gateway =
  process.env.DEER_FLOW_INTERNAL_GATEWAY_BASE_URL ?? "http://127.0.0.1:8001";

export default defineNuxtConfig({
  devServer: { port: 3100 },

  routeRules: {
    // ⚠️ sendStream / streamRequest 会被 Nitro 透传给 h3 的 proxyRequest。
    // 不带 streamRequest，h3 会先把整个请求体读进内存（readRawBody）——nginx 侧
    // 对 /api/langgraph/ 配的是 client_max_body_size 20M + proxy_request_buffering off。
    // G0-1 要带/不带各跑一遍确认差异。
    //
    // 复刻 nginx: /api/langgraph/* → Gateway /api/*
    ...(process.env.NUXT_PUBLIC_LANGGRAPH_BASE_URL
      ? {}
      : {
          "/api/langgraph/**": {
            proxy: { to: `${gateway}/api/**`, sendStream: true, streamRequest: true },
          },
        }),
    // 其余 REST 路由 1:1 透传
    ...(process.env.NUXT_PUBLIC_BACKEND_BASE_URL
      ? {}
      : {
          "/api/**": {
            proxy: { to: `${gateway}/api/**`, sendStream: true, streamRequest: true },
          },
        }),
  },

  runtimeConfig: {
    public: {
      // 留空 = 从 window.location.origin 拼 /api/langgraph，
      // 对齐 frontend/src/core/config/index.ts::getLangGraphBaseURL()。
      // 运行时可由 NUXT_PUBLIC_LANGGRAPH_BASE_URL / NUXT_PUBLIC_BACKEND_BASE_URL 覆盖。
      langgraphBaseUrl: "",
      backendBaseUrl: "",
      // E2E 合同的前置条件，对应 frontend 的 DEER_FLOW_AUTH_DISABLED
      authDisabled: "",
    },
  },
});
```

### ⚠️ 为什么不是 `devProxy`

`nitro.devProxy` **只在 `nuxt dev` 生效**。而 Next 版的代理在 [`frontend/next.config.js:30-79`](../frontend/next.config.js) 的 `rewrites()` 里，`next start` 下同样生效——两版的网络行为因此在 E2E、preview、生产三种形态下都一致。

用 devProxy 会让 Vue 版只在 dev 下正确：E2E 的 `webServer` 跑的是 `nuxt build && nuxt preview`，那个进程里没有任何代理，`tests/e2e-auth/` 与 `tests/e2e-real-backend/` 直接不可用，合同 spec 里凡是没被 `page.route()` 覆盖到的请求会 404 而不是打到 Gateway。完整后果表见 [03-project-shape.md](03-project-shape.md#️-为什么代理必须是-routerules-而不是-nitrodevproxy)。

`routeRules` 编译进 Nitro 产物，三种形态共用一份规则。**M0 要实测两件事**：`/api/langgraph/**` 是否确实比 `/api/**` 更优先命中，以及 SSE 是否被缓冲。

### 为什么必须保住这些 URL

不是为了兼容历史，是三条硬约束：

| 约束 | 说明 |
| --- | --- |
| **E2E 合同** | [`frontend/tests/e2e/utils/mock-api.ts`](../frontend/tests/e2e/utils/mock-api.ts) 实测有 **39 个 `page.route()`**：7 个在 `/api/langgraph/*`（threads、threads/\*、/history、/state、/search、runs/stream、threads/\*/runs/stream），**另外 32 个在裸 `/api/*`**——`/api/v1/auth/*`、`/api/threads/*`（含正则 `/\/api\/threads\/[^/]+$/`）、`/api/scheduled-tasks/*`、`/api/features`、`/api/models`、`/api/skills`、`/api/agents`、`/api/integrations/lark/*`、`/api/channels/*`、`/api/suggestions/config`…… 换句话说 **URL 合同不是「一个前缀」，是全部 REST 路径逐字一致** |
| **生产代理调优** | `/api/langgraph/` 是 nginx 里唯一带 `proxy_read_timeout 600s`、`client_max_body_size 20M`、`proxy_request_buffering off` 的 location（[`nginx.local.conf:67`](../docker/nginx/nginx.local.conf)）。裸 `/api/threads/...` 命中的是 `location ~ ^/api/threads`，走默认 60s 超时——DeerFlow 的长工具调用会被掐断 |
| **复用方的接入点** | 模板交付给其他项目时，「agent 流式走哪个前缀」是一个显式配置项，不该散在各处 |

> 早期版本写的是「7 个 route pattern 拦在 langgraph 前缀上」。这个说法本身没错，但会让人以为只要保住一个前缀就安全——实际要保的是 39 条路径的全集。

### 环境变量：比 Next 版更简单

Nuxt 的 `runtimeConfig.public` 可以在运行时改变客户端使用的 base URL；但 `buildProxyRules()` 读取的 `process.env` 会编译进 Nitro route rules。**同一产物可以换客户端直连地址，不代表可以运行时重写已经构建的代理拓扑。** 生产默认仍要求同源反代，不能把 public base URL 当万能逃生口。

## ⚠️ browser-view 的 WebSocket —— 路径已冻结，M0 验证

[`frontend/src/components/workspace/browser-view/api.ts:44`](../frontend/src/components/workspace/browser-view/api.ts) 建的是 `ws://…/api/threads/{id}/browser/stream`。nginx 有[专门的 upgrade location](../docker/nginx/nginx.local.conf) 处理它（`location ~ ^/api/threads/[^/]+/browser/stream`，带 `proxy_set_header Upgrade` + 600s 超时）。

不能假定 Nitro `routeRules` 会处理 `Upgrade`。M-1 已把实现路径冻结为：

1. **开发**：browser WS 直连 `ws://localhost:8001`，Gateway 精确配置 `GATEWAY_CORS_ORIGINS=http://localhost:3100,http://localhost:3101`；HTTP/SSE 仍经 Nuxt 同源 routeRules。所有地址统一写 `localhost`，不混用 `127.0.0.1`，否则 host Cookie 不共享。
2. **生产**：React/Vue 各自的 hostname 都由 nginx/ingress 同源处理 Upgrade，保留 `proxy_http_version 1.1`、`Upgrade`、`Connection` 和 600s timeout。
3. 如果 M0 后续实现并安全验证了 Nuxt WS proxy handler，它可以替换“开发直连”，但不能改变生产同源 ingress 合同。

> ⚠️ **不要把「跨源丢 cookie」直接套到 WebSocket 上。** 下一节讲的是 **fetch** 跨源：那是 CORS + `credentials` 的问题，需要 `Access-Control-Allow-Credentials` 与精确 origin 白名单。
>
> WebSocket 不走 CORS 那套。`localhost:3100` → `localhost:8001` 虽然是不同 **origin**，但**端口不属于 site**，两者是 **same-site**，所以 `SameSite=Lax` 的 `access_token` cookie 在 WS 握手时照样会被带上。
>
> Cookie 可能会带上，但当前 Gateway 的 `_ws_origin_allowed()` 还会比较 Origin 与 target host 或显式 CORS allowlist。默认 `localhost:3100 → localhost:8001` 会因端口不同被拒绝；直连方案必须显式配置 `GATEWAY_CORS_ORIGINS=http://localhost:3100` 并测试。

**G0-6 的通过条件是上述开发路径在真实浏览器 Origin+Cookie 下工作，不是只记录 routeRules 不支持。**

## ⚠️ 跨源会丢认证 cookie —— 不要轻易绕开同源代理

`localhost:3100` 与 `localhost:2026` 是**不同 origin**（端口不同）。走 `routeRules` 同源代理时这不构成问题：浏览器看到的一直是 `:3100` 自己。但一旦改用 `NUXT_PUBLIC_BACKEND_BASE_URL` 直连 Gateway，请求就变成跨源的，两件事同时发生：

1. **认证 cookie 不会被带上**（除非同时配 `credentials: "include"` + Gateway 侧 `Access-Control-Allow-Credentials` + 精确 origin 白名单，通配 `*` 不允许）
2. **CSRF 校验可能失败**——Gateway 的 `csrf_token` 机制若比对 Origin / Referer，跨源请求会被拒

这不是推测：[`frontend/playwright.real-backend.config.ts:64`](../frontend/playwright.real-backend.config.ts) 的注释已经踩过并写明——

> Leave `NEXT_PUBLIC_*` unset so the frontend uses its built-in next.config rewrites (same-origin proxy) instead of talking to the gateway cross-origin — cross-origin fetches drop the auth cookies.

所以 `NUXT_PUBLIC_LANGGRAPH_BASE_URL` / `NUXT_PUBLIC_BACKEND_BASE_URL` 这两个变量的正确定位是**「部署在同源反代之后时用来指向别处」**，不是「开发时图省事绕过代理」。默认必须留空。

## OIDC 双前端回跳

Gateway 当前只有一个 `auth.oidc.frontend_base_url`，每个 provider 也只有一个可选的 `redirect_uri`。任一项固定成 React 地址时，Vue 发起的 SSO 都会被固定送回 React；这不是前端路由能补救的问题。

双前端 profile 的优先方案是：两个 public origin 都通过同源 `/api/v1/auth/*` 访问 Gateway，OIDC provider 注册两个 callback URI，同时让 Gateway 的 `frontend_base_url` **和 provider 的 `redirect_uri` 都留空**。这样登录发起与 callback 都由当前请求的 proxy-aware origin 生成，成功/失败 redirect 保持相对路径并回到本次 callback 所在 origin。必须确认 nginx/ingress 只接受可信代理并正确转发 Host/Proto，再用两个入口各跑一次真实或可控 OIDC provider 测试。

开发环境若两个入口只是同一 hostname 的不同端口（例如 `localhost:2026` 与 `localhost:3100`），Cookie 仍按 hostname/path 而不是端口隔离。OIDC state cookie 名只按 provider 区分，所以两个端口**并发**发起同一 provider 登录会互相覆盖；G0-7 要验证此场景并明确限制。生产 dual profile 推荐使用两个独立 hostname，不能把“不同端口”当成认证隔离边界。

如果部署环境必须配置绝对 `frontend_base_url` 或单个绝对 provider `redirect_uri`，则需要后端把合法 return origin/callback 写进受签名 state，并用服务端 allowlist 校验；不能接受客户端任意 return URL。该后端扩展及安全测试属于生产双前端 profile 的发布阻断。

## 运行

```bash
# 1. 起后端（Gateway 必须在 8001）
make dev
```

```bash
# 2. 另开终端起 Vue 版
cd frontend-vue && make dev
```

M0 先支持模块内 `make dev`，并在根级新增显式 `make dev-vue` / `make dev-dual` 生命周期；现有 `make dev` 继续作为 React 默认，避免无提示地改变已有开发入口。根 Makefile、`scripts/serve.sh`、README/AGENTS 同步更新。

| 检查 | 期望 |
| --- | --- |
| `localhost:2026` | 现有 Next 前端正常，未受影响 |
| `localhost:3100` | Nuxt 前端可访问 |
| `localhost:3100` 上调用 `/api/features` | 返回 Gateway 的真实响应，不是 404/502 |
| **`PORT=3101 nuxt preview` 下同样调用 `/api/features`** | **同上**——这一条是 `routeRules` 相对 `devProxy` 的全部意义所在，必须在 **preview** 上单独验 |
| `localhost:3100` 上发起一个 run | `/api/langgraph/threads/…/runs/stream` 命中 Gateway，且 token **逐条到达**而不是攒到最后（代理未缓冲） |
| browser-view WS | 开发直连 8001 + exact allowlist，在真实 Origin/cookie 下完成握手（[G0-6](06-migration-plan.md#m0-的十道-gate)） |
| `make e2e-list` | clean install 后列出 **25 个 spec / 120 个 test**；实时数量由 CI 输出 |
| 真实认证 smoke | 经 preview 完成 register/login、CSRF 写请求、refresh、logout |
| run resume smoke | create POST 只发生一次，续传切 GET 并带 `Last-Event-ID` |

### 扩展并统一使用 `scripts/pnpm.py`

[`scripts/pnpm.py:56`](../scripts/pnpm.py) 硬编码了工作目录：

```python
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
result = subprocess.run([*command, *arguments], check=False, shell=False, cwd=FRONTEND_DIR)
```

当前 runner 默认目录确实硬编码为 `frontend/`，所以 M0 在开始调用它之前增加 `--dir frontend|frontend-vue`：

- 不传参数继续使用 `frontend`，现有调用完全兼容；
- `--dir frontend-vue` 只允许仓库内白名单目录；
- 拒绝绝对路径、`..`、不存在目录和无 `package.json` 目录；
- `backend/tests/test_pnpm_script.py` 覆盖以上行为。

Vue Makefile 使用 `python3 ../scripts/pnpm.py --dir frontend-vue`，不再为新目录另造直接 Corepack 例外。

## ⚠️ 两个前端共享 localhost 的 Cookie

Cookie **不按端口隔离**。`localhost:2026` 与 `localhost:3100` 对浏览器是同一个 host，因此共享 Gateway 的 `HttpOnly access_token` 和可读的 `csrf_token`：

- 在一个前端登录，另一个直接就是登录态（联调时方便）
- **在一个前端登出，另一个也会掉线**（容易被误判成 Vue 版的 auth 写错了）

需要隔离时用浏览器的不同 profile 或无痕窗口。Playwright 的每个 context 本来就隔离，E2E 不受影响。

## 仓库集成

### `.gitignore` 放在 `frontend-vue/` 内

git 支持嵌套 `.gitignore`，不需要改仓库根的那份：

```gitignore
# frontend-vue/.gitignore
node_modules/
.nuxt/
.output/
.data/
dist/
test-results/
playwright-report/
```

### 独立 `node_modules`

仓库根没有 `pnpm-workspace.yaml`（已确认），两个前端各自独立安装。

`frontend-vue/` 内部自己放一份 `pnpm-workspace.yaml`（`.` + `packages/*`），让 `packages/agent-core/` 成为真包、用 `workspace:*` 引用。理由见 [08](08-agent-core-contract.md#包与-workspace-契约)。

唯一的跨目录引用是 `@playwright/test` 的 `link:../frontend/node_modules/@playwright/test`。clean CI 必须先 frozen-install `frontend/`，再安装 Vue 并断言 link target；本机已有 node_modules 不算验证。

### 文档同步

首个可运行产物必须在同一变更集更新根 README/AGENTS：Repository Map、命令、开发端口、CI、是否包含生产 profile。架构变化不能先落代码、后补 source-of-truth。

## 生产部署

交付分为两个明确 profile：

1. **Standalone template**：复用方提供同源 reverse proxy，满足下表要求；
2. **DeerFlow dual-frontend production**：React 与 Vue 同时部署，分别使用独立 hostname；两个同源 nginx/ingress 入口复用同一组 API/SSE/WS location并指向共享 Gateway，同时完成 OIDC 双回跳。

如果本期只完成开发 profile，发布说明必须标为“development preview”，不能称 production-ready。

| 需求 | 说明 |
| --- | --- |
| 产物 | `nuxt build` → `.output/`，`node .output/server/index.mjs`（自包含，运行时不需要 pnpm / node_modules） |
| 镜像 | Node 22 多阶段构建；runtime stage 只复制 `.output`、使用非 root 用户、固定工作目录，不复制 `.env`/源码/node_modules；基础镜像与 resolved 依赖可追溯 |
| 代理 | agent 流式前缀（默认 `/api/langgraph/*`）必须配 `proxy_read_timeout ≥ 600s`、`proxy_buffering off`、`proxy_request_buffering off`，并按当前合同以 `client_max_body_size 20M` 拒绝超限请求（413）；Nuxt 的 `streamRequest` 只防内存缓冲，不代替大小限制 |
| WebSocket | browser-view 启用时必须同源 Upgrade，或显式 allowlist 的直连方案 |
| 认证 | HTTPS Cookie、CSRF、register/login/logout、OIDC 两个入口回跳均有测试 |
| 环境变量 | public base URL 可运行时注入；Nitro proxy topology 是构建配置，不能混为一谈 |
| 运维 | Nuxt 自身 `/health` 与 Gateway health 分开；进程启动、stdout/stderr 日志、SIGTERM 优雅退出、失败重启、回滚版本与带 hash 静态资源缓存策略 |
| 安全响应头 | 至少 `nosniff`、referrer policy、frame policy；CSP 先 report-only 验证 Mermaid/KaTeX/iframe/worker，再决定 enforce |

### 关于安全响应头（CSP 等）

实测：**DeerFlow 当前 nginx 与 `next.config.js` 里一个安全响应头都没有**（`add_header` / `headers()` 均无）。

不能因为 React 当前没有安全头就把模板的生产缺口永久继承。基础无争议头可以启用；CSP 容易误伤 Mermaid/Shiki worker、KaTeX inline style 和 artifact iframe，所以先用 report-only 收集，再冻结策略。Nuxt 侧挂载点是 `routeRules.headers` 或外层 ingress：

```ts
"/**": { headers: { "x-content-type-options": "nosniff", … } }
```

⚠️ 有一个坑值得预先记下来（`nuxt-modern-starter` 已经踩过并在注释里写明）：**预渲染 / SWR 缓存的 HTML 与 CSP `nonce` 天然冲突**——nonce 要求每个响应唯一，而缓存 HTML 是复用的。要么保留 `script-src 'unsafe-inline'`，要么单独实现构建期 hash 注入。本项目营销区正是 `prerender: true`，一旦要开 CSP 就会直接撞上这条。

dual-frontend profile 已由 M-1 选中；nginx/compose/health-check 在 M7 production readiness 完成，不得推迟到发布之后，也不在当前文档窗口提前修改业务运行代码。

---

## 附录：何时让两个前端都走 nginx

对称部署是冻结的生产方案：实际发布由外层 ingress 根据两个 hostname 路由；本地/compose 可以用第二个 loopback published port 验证入口。两个前端拿到逐字相同的 `/api/*` 配置，SSE 调优、WebSocket、压缩全部复用，不会漂移。

它要求改至少以下仓库文件：

| 文件 | 改动 |
| --- | --- |
| `docker/nginx/nginx.local.conf` + `nginx.conf` | 抽出共享 API location；为 Vue 增加按 hostname 的 server/入口，本地 profile 可用第二 loopback 端口验证 |
| `scripts/serve.sh` | 五处端口接线 |
| `docker/docker-compose*.yaml` | 加服务与第二个发布端口 |
| `backend/tests/test_compose_default_bind_host.py` | `test_nginx_entry_defaults_to_loopback` 断言的是单元素列表，加端口后会红 |

冻结结论按 profile：

- standalone template：不修改 DeerFlow nginx，由复用方提供等价入口；
- 本地开发：3100 routeRules 负责 HTTP/SSE，WS 直连 8001 + exact allowlist；
- DeerFlow 生产双前端：**必须使用两个独立 hostname 的对称同源 nginx/ingress**。它以有限根级改动换回 SSE 调优、WS、认证和压缩的一致性。

每个 profile 都必须保住全部 API URL（含 `/api/langgraph` 前缀），并用同一套 real-backend contract 验证。
