# 07 · 并行运行与后端共用

`frontend-vue/` 与现有 `frontend/` 在同一仓库内并存、同时运行、共用同一套 Gateway 接口。

## 原则：仓库改动只有一处

`frontend/` 与 `backend/` 是 GitHub 上游在维护的项目，仓库根的配置文件（`Makefile`、`docker/nginx/`、`docker-compose`、`scripts/`）也不属于本次工作区。

**因此接线方式必须做到零改动**——`frontend-vue` 自己解决代理，不碰 nginx、不碰 `serve.sh`、不碰 `scripts/pnpm.py`、不加 `make` 目标。

### ⚠️ 但有一个已经存在的例外

**`.github/workflows/frontend-vue-verify.yml` 已经在仓库里且已提交**，触发条件是 `paths: frontend-vue/**`，执行的是本方案不存在的 `make verify` 与 `playwright.vue.config.ts`。它是上一轮实现留下的——目录清掉了，workflow 没清。

**不处理它，建完 `frontend-vue/` 的第一次 push 就会 CI 红**，且失败信息是 `make: command not found`，指不到真实原因。

处理它要动 `.github/`，属于仓库根配置，**需要先征得同意**。三个选项与推荐做法见 [06 的 G0-0](06-migration-plan.md#g0-0--ci-workflow-对齐)——这是 M0 的第一件事。

所以准确的表述是：**除这一个遗留文件外零仓库改动。**

> 早期版本提议让两个前端对称地都走 nginx（新增 2027 入口、抽 `api-locations.conf`、改 `serve.sh` 与 compose）。那套方案的前提是「frontend-vue 将来取代 `frontend/`」。产品目标改为[通用模板](08-agent-core-contract.md)后前提不成立，且它要改 4 个仓库文件——**已废弃**，理由与取舍见[文末附录](#附录为什么不再让两个前端都走-nginx)。

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

Next 的 `NEXT_PUBLIC_*` 是**构建时内联**的，换后端地址必须重新构建。Nuxt 的 `runtimeConfig.public` 由 `NUXT_PUBLIC_*` **运行时注入**，同一个产物可以换环境。这是本次重写少数几个净收益之一。

## ⚠️ browser-view 的 WebSocket —— 提前到 M0 验

[`frontend/src/components/workspace/browser-view/api.ts:44`](../frontend/src/components/workspace/browser-view/api.ts) 建的是 `ws://…/api/threads/{id}/browser/stream`。nginx 有[专门的 upgrade location](../docker/nginx/nginx.local.conf) 处理它（`location ~ ^/api/threads/[^/]+/browser/stream`，带 `proxy_set_header Upgrade` + 600s 超时）。

**Nitro 这边大概率不行**：`routeRules` 的 `proxy` 底层是 h3 的 `proxyRequest`，纯 HTTP 转发，不处理 `Upgrade` 握手；Nitro 自身的 WebSocket 能力服务的是它自己的 handler，不是 proxy 规则。

**所以这条从 M6 提前到 [M0 的 G0-5](06-migration-plan.md#m0-的六道-gate)。** 理由不是它更重要，而是**它的两条出路里有一条需要征得同意**（改 nginx），而征得同意这件事越晚成本越高——M6 时再发现，等于在最后一个里程碑上卡一个需要跨团队决策的事。验它 10 分钟。

结论若是"不通"，两个选项：

1. **让 WS 直连 Gateway**（`NUXT_PUBLIC_BACKEND_BASE_URL` 或单独给 WS 一个 base URL）
2. 申请在 nginx 加一个入口

> ⚠️ **不要把「跨源丢 cookie」直接套到 WebSocket 上。** 下一节讲的是 **fetch** 跨源：那是 CORS + `credentials` 的问题，需要 `Access-Control-Allow-Credentials` 与精确 origin 白名单。
>
> WebSocket 不走 CORS 那套。`localhost:3100` → `localhost:8001` 虽然是不同 **origin**，但**端口不属于 site**，两者是 **same-site**，所以 `SameSite=Lax` 的 `access_token` cookie 在 WS 握手时照样会被带上。
>
> 也就是说：**选项 1 对 WS 很可能是可行的，即使它对普通 REST 请求不可行。** 这两件事必须分开判断，混成一条会让人误以为唯一出路是改 nginx。真正要验的是握手能否完成、以及 Gateway 侧是否校验 `Origin`。

**在 G0-5 拿到结论之前，不要为这一个 L3 功能改 nginx。**

## ⚠️ 跨源会丢认证 cookie —— 不要轻易绕开同源代理

`localhost:3100` 与 `localhost:2026` 是**不同 origin**（端口不同）。走 `routeRules` 同源代理时这不构成问题：浏览器看到的一直是 `:3100` 自己。但一旦改用 `NUXT_PUBLIC_BACKEND_BASE_URL` 直连 Gateway，请求就变成跨源的，两件事同时发生：

1. **认证 cookie 不会被带上**（除非同时配 `credentials: "include"` + Gateway 侧 `Access-Control-Allow-Credentials` + 精确 origin 白名单，通配 `*` 不允许）
2. **CSRF 校验可能失败**——Gateway 的 `csrf_token` 机制若比对 Origin / Referer，跨源请求会被拒

这不是推测：[`frontend/playwright.real-backend.config.ts:64`](../frontend/playwright.real-backend.config.ts) 的注释已经踩过并写明——

> Leave `NEXT_PUBLIC_*` unset so the frontend uses its built-in next.config rewrites (same-origin proxy) instead of talking to the gateway cross-origin — cross-origin fetches drop the auth cookies.

所以 `NUXT_PUBLIC_LANGGRAPH_BASE_URL` / `NUXT_PUBLIC_BACKEND_BASE_URL` 这两个变量的正确定位是**「部署在同源反代之后时用来指向别处」**，不是「开发时图省事绕过代理」。默认必须留空。

## 运行

```bash
# 1. 起后端（Gateway 必须在 8001）
make dev
```

```bash
# 2. 另开终端起 Vue 版
cd frontend-vue && make dev
```

不加 `make dev-vue` 目标——那要改根 `Makefile`。`scripts/pnpm.py` 同理不能用（它硬编码 `cwd=frontend/`，见下）。

| 检查 | 期望 |
| --- | --- |
| `localhost:2026` | 现有 Next 前端正常，未受影响 |
| `localhost:3100` | Nuxt 前端可访问 |
| `localhost:3100` 上调用 `/api/features` | 返回 Gateway 的真实响应，不是 404/502 |
| **`PORT=3101 nuxt preview` 下同样调用 `/api/features`** | **同上**——这一条是 `routeRules` 相对 `devProxy` 的全部意义所在，必须在 **preview** 上单独验 |
| `localhost:3100` 上发起一个 run | `/api/langgraph/threads/…/runs/stream` 命中 Gateway，且 token **逐条到达**而不是攒到最后（代理未缓冲） |
| `ws://localhost:3100/api/threads/x/browser/stream` | 握手能否完成（[G0-5](06-migration-plan.md#m0-的六道-gate)）。大概率不行，结论要在 M0 拿到 |
| `make e2e -- --list` | 列出 **25 个 spec / 约 120 个用例**。列不出来说明撞上了 `@playwright/test` 双实例，见 [03](03-project-shape.md#️-m0-必须先验证-spec-能被收集到) |

### ⚠️ 不要用 `scripts/pnpm.py` 启动

[`scripts/pnpm.py:56`](../scripts/pnpm.py) 硬编码了工作目录：

```python
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
result = subprocess.run([*command, *arguments], check=False, shell=False, cwd=FRONTEND_DIR)
```

「先 `cd frontend-vue` 再调用」无效——`cwd=` 覆盖 shell 的当前目录，实际在 `frontend/` 里执行，**启动的是 Next.js 而不是 Nuxt，且不报错**。

仓库根 `AGENTS.md` 要求 host 侧 pnpm 调用走这个 runner，但那条约束的对象是**仓库既有的构建流程**；`frontend-vue` 不接入 `make`，直接用 `pnpm` 即可。`frontend-vue/` 同样 pin `packageManager: "pnpm@10.26.2"`，Corepack 会在该目录下取到正确版本。

> 若将来决定把 `frontend-vue` 接进 `make dev`，届时给 `pnpm.py` 加一个 `--dir` 参数（默认值保持 `frontend`，现有调用方行为不变）——**需要先征得同意**。

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

`frontend-vue/` 内部**自己放一份 `pnpm-workspace.yaml`**（`.` + `packages/*`），让 `packages/agent-core/` 成为真包、用 `workspace:*` 引用——文件在本目录内，仍属零仓库改动。理由见 [08](08-agent-core-contract.md#l1-为什么是独立包)。

唯一的跨目录引用是 `@playwright/test` 的 `link:../frontend/node_modules/@playwright/test`——它是**故意**的，为了让共用 testDir 的 spec 与 runner 命中同一个物理实例（见 [03](03-project-shape.md#️-m0-必须先验证-spec-能被收集到)）。代价：`frontend/` 必须已经 `pnpm install` 过。

### 文档同步

本次不改根 `AGENTS.md`（属于需要同意的范围）。等 `frontend-vue` 有可运行产物后再一并申请更新：Service Topology 表、Repository Map。

## 生产部署

**本文档只覆盖开发态。** `frontend-vue` 作为通用模板交付时，生产部署由**复用方**决定，我们只需要说清它需要什么：

| 需求 | 说明 |
| --- | --- |
| 产物 | `nuxt build` → `.output/`，`node .output/server/index.mjs`（自包含，运行时不需要 pnpm / node_modules） |
| 代理 | agent 流式前缀（默认 `/api/langgraph/*`）必须配 `proxy_read_timeout ≥ 600s`、`proxy_buffering off`、`client_max_body_size ≥ 20M`、`proxy_request_buffering off` |
| WebSocket | 若启用 browser-view，需要 upgrade 转发 |
| 环境变量 | `NUXT_PUBLIC_LANGGRAPH_BASE_URL` / `NUXT_PUBLIC_BACKEND_BASE_URL`，运行时注入。⚠️ 默认留空走同源代理，理由见[上文](#️-跨源会丢认证-cookie--不要轻易绕开同源代理) |
| **安全响应头** | **默认不开，由复用方决定**——见下方说明 |

### 关于安全响应头（CSP 等）

实测：**DeerFlow 当前 nginx 与 `next.config.js` 里一个安全响应头都没有**（`add_header` / `headers()` 均无）。

所以 `frontend-vue` 也**不默认开启**——加上就是对 `frontend/` 的行为偏离，违反 [06](06-migration-plan.md#不做的事) 的「不要在移植过程中改行为」，而且 CSP 很容易在这个应用上误伤：Mermaid / Shiki 用 `blob:` worker，KaTeX 注入行内样式，artifacts 预览用 `iframe`。

但作为**通用模板**交付时，零安全头是个真实缺口。所以写在这张交付清单里而不是代码里。Nuxt 侧的挂载点是 `routeRules` 的 `headers`：

```ts
"/**": { headers: { "x-content-type-options": "nosniff", … } }
```

⚠️ 有一个坑值得预先记下来（`nuxt-modern-starter` 已经踩过并在注释里写明）：**预渲染 / SWR 缓存的 HTML 与 CSP `nonce` 天然冲突**——nonce 要求每个响应唯一，而缓存 HTML 是复用的。要么保留 `script-src 'unsafe-inline'`，要么单独实现构建期 hash 注入。本项目营销区正是 `prerender: true`，一旦要开 CSP 就会直接撞上这条。

如果 DeerFlow 自己也要部署 Vue 版，届时再讨论 nginx / compose 改动。

---

## 附录：为什么不再让两个前端都走 nginx

对称部署（nginx 新增 2027 入口 → frontend-vue）在「frontend-vue 取代 `frontend/`」的前提下是更好的方案：两个前端拿到逐字相同的 `/api/*` 配置，SSE 调优、WebSocket、压缩全部复用，不会漂移。

但它要求改 4 个仓库文件：

| 文件 | 改动 |
| --- | --- |
| `docker/nginx/nginx.local.conf` + `nginx.conf` | 抽出 `api-locations.conf`，各加一个 `listen 2027` server 块 |
| `scripts/serve.sh` | 五处端口接线 |
| `docker/docker-compose*.yaml` | 加服务与第二个发布端口 |
| `backend/tests/test_compose_default_bind_host.py` | `test_nginx_entry_defaults_to_loopback` 断言的是单元素列表，加端口后会红 |

产品目标确定为**通用模板**（不取代 `frontend/`）之后，这些代价换不回相应的收益：

- 生产部署是复用方的事，DeerFlow 侧的 nginx 对称性不再是刚需
- 唯一需要 WebSocket 的 browser-view 是 L3，且排在最后的 M6
- 用 `routeRules` 的 `proxy` 复刻前缀重写，且**它在 preview 与生产产物里同样生效**，E2E 合同与 URL 约束都能满足

**保住全部 API URL（含 `/api/langgraph` 前缀）是这条决策的前提**——把 URL 丢掉再绕过 nginx，才是两头不落好。
