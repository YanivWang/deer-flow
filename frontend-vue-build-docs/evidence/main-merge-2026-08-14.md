# main → main-wc 合并与 Vue 独立门禁收口

## 结论

- `main-wc@fea229c2` 已合入 `origin/main@e4a7a047`；合并前分叉为 main-wc 独有 46 个、
  origin/main 独有 71 个提交。
- M7 仍是 Vue 自有精确 **25 files / 120 tests**，合并后连续三次 **120/120**，0 retry。
- React 仍为默认生产前端，Vue 仍只由 secondary hostname 选择。
- 公网目标环境按用户明确要求不执行，记为 **UNRUN**；没有用 fixture、localhost 或自签名
  环境替代公网验收。
- 没有 npm publish、push、PR、默认切流或新功能扩展。

## 冷启动与合并边界

本轮从当前 checkout 重新读取状态和 scoped `AGENTS.md`。合并前 HEAD 为
`fea229c2 fix(frontend-vue): close Vue-owned M7 gates`，目标为
`e4a7a047197069076a97f97e9765784799367b32`。合并发生在 `main-wc`，没有 reset、clean、
checkout 覆盖或改动 `.env`。

文本冲突共 5 个：根 `AGENTS.md`、`Makefile`、根 `README.md`、`backend/AGENTS.md`、
`frontend/AGENTS.md`。解决方式保留 upstream 的分层/scoped guidance 和新增功能，同时保留
Vue 的独立命令、React-default/Vue-secondary 路由与发布边界。`make check-agent-guidance`
验证 24 个 guidance 文件，0 errors、0 warnings。

## 为什么共享清单从 120 漂到 130

`origin/main` 在 React spec 中新增 10 项 React 当前产品行为：custom-agent Browser Live、
Lark integration 和 public showcase 等。直接继续复用四个已变化的 React spec 会让 Vue M7
从 120 漂到 130。这不是 Vue 产品回归，也不是框架无关合同的变化。

正确所有者调整为：

- `frontend-vue/tests/m7/agent-chat.spec.ts`
- `frontend-vue/tests/m7/channels.spec.ts`
- `frontend-vue/tests/m7/integrations.spec.ts`
- `frontend-vue/tests/m7/thread-history.spec.ts`

这四个 spec 冻结合并前已通过的 Vue 产品范围；`m7-inventory.json` 使用完整路径选择它们，
guard 同时断言不再隐式收集对应 React spec。没有把 expected count 改成 130，没有跳过、重试、
sleep、扩大 timeout，也没有在 Vue 产品代码增加 React DOM、动画时序或新功能兼容层。
React 后续能力只有在显式迁移并定义 Vue 行为后才进入 Vue 门禁。

历史 118/120 的两个例外仍保持结构性关闭：Vue batched-stream fixture 拥有真实
`Content-Location` 和终止 `end`；artifact 自动打开保持产品正确行为，测试在动作前观察或验证
稳定最终状态。Vue production fail-closed 未削弱。

## 合并暴露的后端环境问题

首次完整后端套件为 **11297 passed / 20 failed / 72 skipped**。其中 URL 安全测试使用
`example.com`/`github.com`，但当前受管网络把它们解析到 RFC 2544 `198.18.0.0/15`；生产 SSRF
校验正确拒绝 reserved address。测试现在仅在显式 `public_test_dns` fixture 中把这两个文档域名
解析到确定的公网测试地址，生产校验没有放宽。

其余 loopback 失败来自系统代理截获本地 broker/OpenViking 请求。Lark broker 是运维控制的
本地/内网 credential-bearing endpoint，现在明确使用无代理 opener；相应测试以直接
`HTTPConnection` 或显式 loopback `NO_PROXY` 验证。没有修改真实 provider/runtime 语义。

## 验证记录

| 范围 | 命令 | 结果 |
| --- | --- | --- |
| guidance | `make check-agent-guidance` | 24 files，0 errors，0 warnings |
| 双前端路由 | `make dual-frontend-production-check` | 30/30 |
| backend lint | `cd backend && make lint` | 1121 files，clean |
| backend 失败项回归 | 受影响 7 个测试文件 + loopback 专项 | 历史 20 项均直接重跑通过；loopback 最终 22/22 |
| backend full | `cd backend && uv run pytest -m 'not live' tests/ -q --tb=short` | 11317 passed / 72 skipped / 17 warnings，278.41s |
| React static | `cd frontend && python3 ../scripts/pnpm.py check` | 通过 |
| React unit | `cd frontend && python3 ../scripts/pnpm.py test` | 128 files / 1001 tests |
| React Playwright | agent-chat/channels/integrations/thread-history | 40/40 |
| Vue verify | `cd frontend-vue && make verify` | 108 files / 1095 tests；build 通过 |
| Vue migration | `cd frontend-vue && make migration-check` | 58 generated tests；24 RETYPED |
| Vue M7 inventory | `cd frontend-vue && make e2e-m7-list` | 精确 25 files / 120 tests |
| Vue M7 run 1 | `cd frontend-vue && make e2e-m7` | 120/120，36.5s，0 retry |
| Vue M7 run 2 | 同上 | 120/120，36.9s，0 retry |
| Vue M7 run 3 | 同上 | 120/120，36.7s，0 retry |

## Warnings 与未执行项

- Vue lint：0 errors / 35 既有 warnings；另有 Nuxt/Vite large chunk、plugin timing、Tailwind
  sourcemap 和 H3 unused 提示，构建成功。
- Backend 完整套件有 17 个 deprecation、测试短 HMAC key、第三方库与 model-kwargs warnings；
  11317 个非 live 测试全部通过，72 个按 marker 跳过。
- React Playwright 的可选 token-usage/workspace-changes/browser stream 请求在本机记录
  `127.0.0.1:8001 ECONNREFUSED`，相关测试断言仍 40/40；没有把日志写成真实 Gateway 通过。
- 公网 DNS、TLS/SNI/证书链、HTTPS redirect、外层 LB/CDN/Host、SSE buffering、WebSocket、
  真实 IdP、真实公网 Gateway/provider、Channel/OAuth、scheduler、browser 长连接均按用户明确
  范围 **UNRUN**。
