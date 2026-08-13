# M7 phase 3：生产双入口、视觉与性能证据

> 快照日期：2026-08-13。此文件记录本次实测，不替代
> `../10-current-status-and-next.md` 的当前游标。结论仍是 **M7 进行中；M8 未开始**。

## 冷启动与范围

- 起点：clean checkout，`HEAD=3cfcd6a7`；先运行根 `make handoff-check`，再读根/模块
  `AGENTS.md`、文档 10、06、05、07 和现有 phase 1/2 evidence。
- 共享 React spec 保持只读；共享 M7 inventory 保持 **25 files / 120 tests**。
- 未改 `.env`，未进入 M8，未创建第二套 run/thread/stream 状态机。

## 本次业务实现

1. 生产 Compose 同时构建 React/Vue；Nginx 按 `DEER_FLOW_VUE_HOSTNAME` 选择 Vue，
   default/unknown Host 保持 React。两边共用单一 API、LangGraph SSE、WS 与 auth/OIDC 路径，
   Gateway/前端端口不对外发布。
2. Nginx 覆盖 `X-Forwarded-Host`，保留既有可信 `X-Forwarded-Proto`、SSE 不缓冲、WS
   Upgrade、20 MiB body limit 与路径 rewrite。新增 29-test 根门禁和部署/回滚文档。
3. fixture IdP OIDC 增加同一浏览器上下文、同 provider、React/Vue 两 hostname 并发往返；
   双入口要求不配置绝对 `frontend_base_url`/provider `redirect_uri`，真实 IdP 登记两个 callback。
4. 落地 AuroraText、FlickeringGrid、ShineBorder、ConfettiButton，并接入 greeting、登录/初始化、
   运行中 subtask 和已有 Surprise me 入口；均有 reduced-motion 降级。
5. 新增七个确定性产品状态截图：empty、held streaming、settled reasoning/tool、artifact、
   settings、mobile、dark；只 mask 光标、时间和动画等动态区域。
6. 聊天消息 Markdown 使用真实异步组件边界；ArtifactPanel 保持原同步结构。构建 hook 只按
   已生成 chunk 的 moduleIds 命名，不使用 `manualChunks`/`codeSplitting` 重排执行图。
   `.output/public/_nuxt` hard budget 同时统计 raw/gzip、各 vendor 组和全体 client JS。
7. M4a-stream 暴露既有无障碍冲突：无数据的 context gauge 占位符错误声明 `role=status`，
   与 gap 告警形成两个 status。产品侧移除占位符 live-region 语义后门禁 3/3。

## 当前实测

| 命令 | 结果 | 边界 |
| --- | --- | --- |
| `make verify` | 通过：108 files / 1088 tests；59 migrated files / 560 tests | 沙箱首跑因 loopback `EPERM` 产生 12 个 timeout；相同命令在允许 loopback 后通过 |
| `make migration-check` | 通过：58 generated tests；24 RETYPED | 迁移账本，不是生产验收 |
| `make dual-frontend-production-check` | 29/29 | hostname/default、API/SSE/WS/headers、compose bind 与 runtime cleanup |
| `docker compose config --services` | 通过，含 `frontend`、`frontend-vue`、`gateway`、`nginx` | 结构解析；未启动整套公网环境 |
| 镜像内 `nginx -T` | 通过；default React，`vue.localhost` → Vue | 实际模板渲染；没有 DNS/TLS/LB |
| `make e2e-m0` | 通过：proxy 7/7、proxy-options 2/2、auth-disabled 1/1、visual 1/1、splitpanes 1/1、auth-cookie 1/1、run-protocol 1/1 | hermetic/replay |
| `make e2e-m4a` / `make e2e-m4a-stream` | 4/4；修复占位符语义后 3/3 | 数据流与真实分块 SSE |
| `make e2e-m4b` | 66/66 | 精确 11-spec 合同 |
| `make e2e-m5` | 最近完整运行 26/27 | 并行时序红项在共享 panel transition/sidecar scroll 间出现；按用户要求不为门禁拆业务组件 |
| `make e2e-m5-real-backend` | 1/1 | replay Gateway write_file → artifact |
| `make e2e-m6` / `make e2e-m6-real-backend` | 27/27；1/1 | L3 shared gate；Gateway REST/WS binary frame |
| `make e2e-m7` | 119/120 | 唯一稳定红项仍是共享 batched-stream fixture 缺 `Content-Location` 与 terminal `end` |
| `make e2e-m7-local` / `make e2e-m7-auth` | 8/8；7/7 | 独立 Vue-owned inventory |
| `make e2e-m7-real-protocol` | 1/1 | create/resume/cancel/gap/heartbeat |
| `make e2e-auth` / `make e2e-real-backend` | 2/2；3/3 | 共享 auth recovery 与 replay backend |
| `make e2e-external` | WS 1/1；OIDC 2/2 | fixture browser runtime 与 fixture IdP；不等于真实 provider |
| `make e2e-m7-visual` | 7/7 | Chromium/Darwin baselines；非跨引擎视觉结论 |
| `make container-smoke` | 通过 | build、non-root、health、minimal output、SIGTERM |

最终资产预算通过：`vendor-vue` 9 chunks、351.2 KiB raw/73.8 KiB gzip/max 185.6 KiB；
`vendor-markdown` 6 chunks、958.4 KiB raw/291.5 KiB gzip/max 322.9 KiB；`vendor-ui`
5 chunks、88.9 KiB raw/28.2 KiB gzip/max 44.3 KiB；全体 client JS 437 chunks、
12,839.0 KiB raw/2,844.9 KiB gzip，max 761.6 KiB raw/224.7 KiB gzip。CodeMirror 当前
没有安装/消费，`vendor-codemirror` 因而必须是 0，而不能伪造一个 chunk；现有 Shiki
language/WASM 动态块仍会触发 Vite 默认 >500 KiB warning，warning limit 没有被放宽。

## 失败与取舍

- 共享 M7 batched-stream fixture 不包含真实 Gateway 要求的响应 header 和终止帧；未修改共享
  spec，也未放宽生产 fail-closed。M5 本地等价 fixture 继续只补这两个协议事实。
- 尝试把 ArtifactPanel 和 MessageList 都改为异步组件后，并行 M5 的打开动画时序不稳定；
  ArtifactPanel 已恢复原同步结构。没有新增面板业务状态，也没有为门禁继续拆组件。
- 完全静态 Markdown 会让单个 `vendor-markdown` 达 501.5 KiB；最终业务结构只保留
  MessageList 异步 Markdown，ArtifactPanel 同步，对应 maxRaw 360 KiB hard cap 和实测
  322.9 KiB，不为预算继续拆业务组件。
- 早前 phase 2 的手工 Rolldown 分包曾造成循环 chunk 和 `n is not a function`；本次没有
  复活该方案，只命名构建器本来就产生的 chunk。

## A-N 与发布边界

- A-C、E-I、K、M 的当前实现继续由 M4a-M7 专项/共享门禁覆盖；本次没有改协议 reducer、
  auth fail-closed 或唯一 thread/run 状态路径。
- D8 CodeMirror 当前没有依赖和业务消费，不能把 0-byte vendor 组写成已完成编辑器同构。
- J5/J6 的双 hostname 并发由 fixture IdP 2/2 覆盖；真实 IdP 白名单、第三方 Cookie 和组织策略未知。
- L 的 Nginx/Compose/API/SSE/WS 结构与 replay 通过；公网 DNS、TLS、证书续期、CDN/WAF/LB
  buffering、真实长连接仍未验证。
- N 的真实 Chrome 权限、第三方策略、locale/font 首帧以及 Chromium 之外浏览器视觉未验证。
- 公网 hostname、TLS 与真实 provider/runtime 未完成，因此 **M7 不能写 complete，Vue 也不能
  写成默认生产前端**。M8 未开始。
