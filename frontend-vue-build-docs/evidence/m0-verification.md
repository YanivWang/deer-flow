# M0 工程底座验证记录

> 日期：2026-08-05；checkout：本地工作树；结论：**十道 Gate 中九道通过；G0-7 仍未通过，M0 不宣布整体通过，不允许进入 M1**。

## 环境

| 工具 | 实测版本 |
| --- | --- |
| Node | `v22.22.3` |
| Corepack | `0.35.0` |
| pnpm（仓库 runner） | `10.26.2` |
| Python | `3.12.9` |
| uv | `0.11.3` |
| Docker / Compose | `28.2.2` / `2.37.1` |
| Playwright | `1.59.1` |
| resolved app stack | Nuxt `4.5.1`、Nitro `2.13.4`、h3 `1.15.11`、Vue `3.5.40`、Vue Router `5.2.0`、Vite `8.2.0` |

## Gate 结果

| Gate | 命令 | 实际结果 | 状态 |
| --- | --- | --- | --- |
| G0-0 clean install/verify | 根 runner 的 React frozen install；Vue `--frozen-lockfile --strict-peer-dependencies`；`make verify` | 两个 clean-style 重装均成功；最终 lint/format-check/typecheck、6 files / 42 unit、production build 全绿；workflow 已激活且 YAML 可解析 | 通过 |
| G0-1 preview proxy | `make proxy-smoke` | 默认开启态 7/7；关闭流选项对照 2/2。覆盖两前缀 rewrite、LF/CRLF 首帧、请求流、307 与两个 location header、20 MiB、双编码 traversal、client-facing origin 转发与伪造覆盖 | 通过 |
| G0-2 collection | `make e2e-list` | 精确 `25 files / 120 tests`；只证明 collection，不宣称业务 E2E 通过 | 通过 |
| G0-3 auth disabled | `make auth-disabled-smoke` | 1/1；`/workspace` 不跳登录；Nuxt 数值型 runtime flag 的根因已修复并有单测 | 通过 |
| G0-4 visual seed | `make visual-baseline-smoke` | 1/1。light/dark 两态比对 `backgroundColor`/`color`/`borderRadius`/`fontSize`/`fontWeight`/`paddingInline` 六项全等 + 高度相等，light/dark 基线截图落盘 | 通过 |
| G0-5 Cookie/CSRF | `make auth-cookie-smoke` | replay Gateway + Preview 1/1；register、Set-Cookie、CSRF 正/负写、login 轮换、me、logout | 通过 |
| G0-6 WebSocket | `make ws-smoke` | 1/1。真实 Chromium 从 `localhost:3101` 携带 session cookie 直连 `ws://localhost:8011`，握手成功并收到 binary frame。断言要求 `opened && binary`，4404（无会话）不算通过 | 通过 |
| G0-7 OIDC | `make oidc-smoke` | 前置断言要求 provider 列表非空；当前 replay Gateway 无可控 provider。代理侧的 client-facing origin 转发缺口已定位并修复（见下），剩余卡点是可控 IdP | **未通过** |
| G0-8 run protocol | `make run-protocol-smoke` | 1/1。create 单次 POST（`maxRedirects: 0`）、`Content-Location` 存在、无 `Location`、74 事件、1 个 heartbeat、以 `end` 收尾；resume GET + `Last-Event-ID` 返回 `gap`（`stream_replay_gap` / `reload_durable_state`）；浏览器内 cancel 得到 `204`；去敏 trace 落盘 | 通过 |
| G0-9 security/container | `make audit && make proxy-security && make container-smoke` | 官方 npm audit：无已知漏洞；proxy security 24/24；容器 non-root、只含 `.output`、health、SIGTERM 通过 | 通过 |

## 聚合结果

`make e2e-m0` 一次性跑通：7 次 config 运行、**14 个用例全部通过、exit 0**
（proxy 7、proxy-options 2、auth-disabled 1、visual-seed 1、splitpanes 1、
auth-cookie 1、run-protocol 1）。产物在聚合结束后仍然存在：

```
test-results/visual/.../button-light.png
test-results/visual/.../button-dark.png
test-results/real-backend/.../run-protocol-redacted.json
```

`run-protocol-redacted.json` 实测内容（只保留事件名与 presence，不含用户内容或凭据）：

```json
{
  "create":  { "status": 200, "followedRedirect": false, "contentLocation": "present",
               "location": "absent", "eventCount": 74, "heartbeatFrames": 1 },
  "resume":  { "status": 200, "firstEvent": "gap",
               "gapCode": "stream_replay_gap", "gapRecovery": "reload_durable_state" },
  "cancel":  { "createStatus": 200, "status": 204 }
}
```

## 本轮定位并修复的两处失败

之前 G0-4 与 G0-8 被记为“未执行”，实际是**执行后失败**，失败产物就在
`frontend-vue/test-results/` 里。两处都是测试自身的缺陷，不是产品实现漂移。

**G0-4：主题切换与 `transition-all` 竞态。** Button 带 150ms `transition-all`，
点击主题开关后旧断言用两次独立 `evaluate()` 先后读同一个正在插值的
`backgroundColor`，于是 reference 读到过渡前的 `oklab(0 0 0)`、Vue 读到一帧之后的
`oklab(0.00870511 0 0)`。`reducedMotion: "reduce"` 挡不住——`main.css` 里没有
`prefers-reduced-motion` 规则，Chromium 不会因此停掉 CSS transition。同一竞态也让
两张“基线截图”可能拍在过渡中间，基线本身不可重复。
修法：注入 `transition/animation: none !important`，并把整组属性合并成单次
`evaluate` 读取。顺带把 dark 态从只比 `backgroundColor` 提升为比全部六项。

**G0-8：`queue_maxsize: 2` 把创建流掐断。** 直连 Gateway 的原始 SSE 探针显示，
创建流在 `t=0.17s` 就收到 `event: gap` 并终止——实时订阅者立刻落后于保留窗口。
流在 0.17 秒就结束，自然不可能出现依赖 16 秒空闲窗口的 heartbeat；`gap` 之后的
resume 与 cancel 断言也根本没执行到，所以“已补实现 cancel/gap”当时只有代码、
没有任何执行证据。

保留窗口实测扫描（每档一次完整真实 run，事件总数恒为 74）：

| `queue_maxsize` | 创建流被 gap | heartbeat | resume（首游标） |
| --- | --- | --- | --- |
| 256 | 否 | 1 | `values`（未淘汰，拿不到 gap） |
| 64 | 否 | 1 | `gap` |
| 32 | 否 | 1 | `gap` |
| 16 | 否 | 1 | `gap` |
| 8 | 否 | 1 | `gap` |
| 2 | **是（0.17s）** | 0 | — |

窗口必须同时高于实时突发、低于本 run 的事件总数。定为 **32**：下界实测到 8 仍安全，
上界距 74 有 2.3 倍余量。`run_m0_gateway.py` 增加 `--queue-maxsize`
（`DEERFLOW_M0_QUEUE_MAXSIZE` 可覆盖），测试对两侧都写了显式前置断言，
越界时直接给出调参提示而不是变成一个难懂的失败。

同时修掉的两个证据缺陷：

- 去敏 trace 之前用 `testInfo.attach({ body })`，list reporter 在**通过**的用例上
  不会序列化内存附件，这道 Gate 实际没有可复核产物。改为写实体文件再 attach。
- 视觉基线之前硬编码写到 `test-results/m0/`，那是 `playwright.m0.config.ts` 的
  `outputDir`，同一条 `make e2e-m0` 里后跑的 splitpanes 每次都会把它清空。改为写进
  本次运行的 `testInfo.outputPath`。

另外把 create 请求里那个恒真的 `createRequests` 计数换成 `maxRedirects: 0`——前者
自增后断言等于 1，证明不了任何事；后者才真的能让一次 307 暴露出来。run body 也改为
直接使用 fixture 自带的 `context`，与 backend golden test 一致。

**splitpanes：拖拽用例的间歇性失败。** 同一条用例在连续几轮聚合里两绿一红。根因与 G0-4
同类：`[data-restore]` 会带动画回流，用例在动画结束前就读 `boundingBox()`，拿到过渡中间
坐标，`mouse.down()` 落在 splitter 旁边，整段拖拽不产生任何 resize 事件。插桩证实：加一个
固定等待后 `resize=5 / resized=1`，且 restore 前后 splitter 的 x 完全相同（674.703125）。
改为先 `splitter.hover()`——Playwright 的 actionability 本身包含"元素已停止移动"——再读取
坐标。修复后连续 6 次全绿，耗时稳定在 9.2s。

## G0-6：本机解除阻塞并通过

之前判定为"需要外部 browser runtime"，实际不需要：仓库自带 agentic browser control，
且 `POST /api/threads/{id}/browser/navigate`（`routers/browser.py:74`）能在**不跑 agent**
的前提下建立 live browser session，所以不必为此录一条新的 replay fixture。解除步骤：

```bash
cd backend && uv sync --extra browser && uv run playwright install chromium
```

`run_m0_gateway.py` 增加 `--browser`，把 `browser_navigate` 注入 replay config 的
`tools:` 列表。它是 **opt-in**：启用该工具会改变 lead-agent 工具集，进而改变系统提示词，
直接打破 run-protocol 依赖的 fixture hash。因此 G0-6 使用独立的
`playwright.m0-external.config.ts`，`m0-real-backend` 那条链保持原工具集不变。

探针为保持自洽（不依赖公网），导航目标就是 Nuxt preview 自身，配套在夹具里开启
`allow_private_addresses`。关闭码语义已在断言消息中固化：`4401` 未认证 / `4403` 跨源 /
`4404` 无会话。

## G0-7：定位到一处必须先修的实现缺口

在搭建可控 IdP 之前，先核实了 Gateway 侧的两条机制：

- `_resolve_oidc_redirect_uri`（`routers/auth.py:604`）在 `redirect_uri` 留空时，**从请求
  自身的 proxy-aware origin 推导** callback，这正是"两个入口各自拿到自己的 callback"的机制。
- callback 回跳（`routers/auth.py:832`）在 `frontend_base_url` 留空时是**相对路径**，
  由浏览器解析回发起请求的 origin。

两者合起来才是"Vue 用户不会被送回 React"的真正防线。但 Vue 侧目前**满足不了前一条**：

`server/utils/gateway-proxy.ts` 不设置任何 `X-Forwarded-*`，而 h3 的 `proxyRequest` 调用
`getProxyRequestHeaders(event, { host: target.startsWith("/") })`——我们的 target 是绝对
URL，所以 `host` 落入 `ignoredHeaders` 被丢弃。Gateway 因此只能看到 `Host: 127.0.0.1:8011`，
推导出的 `redirect_uri` 指向 Gateway 自己而不是 `localhost:3101`。

对照另外两个入口，Vue 是唯一一个什么都不传的：nginx 在 5 处 location 都写了
`Host $http_host` + `X-Forwarded-Proto $scheme`，Next.js rewrites 由框架转发。
后端本身是对的，不需要改。

**已修复。** `proxyGatewayRequest` 现在显式发送 `Forwarded` / `X-Forwarded-Host` /
`X-Forwarded-Proto` / `X-Forwarded-Port`，取值来自 Nitro 直连请求本身
（`getRequestHost(event)` 与 `getRequestProtocol(event, { xForwardedProto: false })`，
都不读客户端的 x-forwarded 值）。四个头一律**覆盖而非透传**。

覆盖是必需的，不是防御性冗余，已实测：

| 直连 Gateway 的请求（CORS 允许清单故意不含 `localhost:3101`） | 结果 |
| --- | --- |
| A 不带转发头（修复前行为），`Origin: http://localhost:3101` | `403` |
| B 带上代理现在发送的转发头，同一 Origin | `201` |
| C 伪造 `Forwarded: host="evil.example";proto=http` + `Origin: http://evil.example` | **`201`** |

A/B 证明修复真的让 Gateway 推导出 `http://localhost:3101` 而不是自己；C 证明若把
客户端的 `Forwarded` 透传上去，敌对 origin 会被当成同源接受，即
`is_allowed_auth_origin` 要防的 login-CSRF / session-fixation 被绕过。RFC 7239 的
`Forwarded` 在 `_request_origin` 里**优先于** `X-Forwarded-Host`，所以只设后者不够。

Host 头在插入带引号的 `Forwarded` 值前先过 `isSafeForwardedHost`；不合法的 Host 直接
400，避免闭合引号后注入第二个 `host=` 参数。

覆盖：`config/routes.ts` 的纯函数 13 条单测（unit 从 29 增至 42），加 `@proxy` 一条
e2e——同时断言干净请求的四个头取值，以及伪造的四个头被完全覆盖（响应里不含
`evil.example`）。`make proxy-security` 从 11 增至 24。

M0 dual 模式下 Nuxt 是最外层一跳，所以客户端转发头是输入而非信任来源。**M7 把 nginx
放到 Nuxt 前面时必须重新审视这里**，改为承认那一层的转发头。

G0-7 剩余工作：补可控 IdP 并实测两入口各自回跳；独立 hostname 与 DNS/TLS 仍属 M7。

## 外部 Gate 的自动化通路

- `make e2e-external` 把 `ws-smoke` 与 `oidc-smoke` 聚成一对，刻意留在 `e2e-m0` 之外，
  以免把仓库可自证的套件掺假。
- `.github/workflows/frontend-vue-verify.yml` 增加 `workflow_dispatch` 入口和
  `external-gates` job；缺少任一前提时**显式失败并列出缺什么**，不是静默 skip。

## 其他真实验证

- runner 与启动链路：定向组合 `test_pnpm_script.py + test_frontend_vue_startup.py` 为 **20 passed**。
- Vue fast gates：`make verify` 为 **6 files / 42 tests passed** 并完成 production build。
- dual lifecycle：`serve.sh --dev --dual --skip-install` 实际启动 Gateway `8001`、React `3000`、Vue `3100`，三个 HTTP 探针均 200；`serve.sh --stop` 后三端口无残留。
- Docker：clean-context 多阶段 build 成功；`container-smoke.sh` 退出 0。
- workflow：三个 job（`verify` / `real-backend` / `external-gates`）YAML 解析成功。
- Markdown：GitHub slugger 语义检查 `frontend-vue-build-docs/` 相对目标与锚点全部存在。
- 构建警告：Tailwind Vite plugin 的 sourcemap warning、Nuxt h3 bridge 的未使用 import warning 均未降低门禁。

## 已知观察（不属于 M0 范围）

replay 场景 `write_read_file.ultra` 的 run 终态是 `error` 而不是 `success`。这不是
M0 测试夹具引入的：`DEERFLOW_M0_REPLAY_DELAY_SECONDS=0` 同样复现，也不是 replay
hash miss——工具确实执行了（`write_file` 返回 `OK`）。状态来自
`worker.py:977` 的 `_delivery_error`，因为 `produced_paths` 非空而 `satisfied` 不为
`True`。`backend/tests/test_replay_golden.py` 只比对 SSE 形状、不断言终态，所以一直是绿的。
M0 的 run 协议 Gate 只断言 SSE 协议形状，不依赖 run 终态，因此不受影响；该问题应在
backend 侧单独处理。

## 结论

十道 Gate 中九道通过，`make e2e-m0` 与 `make ws-smoke` 均为真实绿色。**G0-7 仍未通过**，
且已定位到必须先修的代理转发头缺口。在 G0-7 拿到真实绿色结果前，不得宣布 M0 整体通过，
也不得开始 M1。
