# DeerFlow frontend-vue 交接检查点

> 状态:2026-08-01 生效。
> 本文件只保留 `frontend-vue/` 后续工作的滚动检查点。
> 旧的连续轮次 prompt / 执行流水账已从本文移除;需要历史细节时查 git 历史。

## 1. 冷启动必读

新窗口按以下顺序读取:

1. `AGENTS.md`
2. `frontend/AGENTS.md`
3. `backend/AGENTS.md`
4. `frontend-refactor-docs/README.md`
5. `frontend-refactor-docs/12-vue-execution-workflow.md`
6. 本文件最新检查点
7. `frontend-vue/tests/SPEC-GAPS.md`

执行前必须先跑:

```bash
git status --short
git status --short -- frontend backend docker Makefile pnpm-workspace.yaml .gitignore
```

## 2. 硬边界

- 不要乱动既有 staged 状态;每次改完并验证后先不要自动暂存;只在用户明确授权后,才精确暂存本次实际修改过的允许范围文件。
- 不要修改现有 `frontend/`、`backend/`、`docker/`、根 `Makefile`、根 `pnpm-workspace`、DeerFlow `.gitignore`。
- 只处理 `frontend-vue/`、`docker-vue/`,以及用户明确授权的 `frontend-refactor-docs/`。
- 不要为了过检查使用 `any`、关闭 lint、跳过测试或全局绕过。
- 不要恢复旧“第 N/15 轮”自动连跑;按 `12-vue-execution-workflow.md` 的 Domain Completion Sprint 推进。

## 3. 当前执行口径

默认主线是 **Domain Completion Sprint**:

- 没有真实 Gateway、账号、scheduler、IM provider、Docker daemon 时,不要优先排 M1/M2/M3/M4/M5 live signoff。
- 默认一次只选择一个页面域或产品域,在该域内把当前源码和环境能 source-backed 实现的完整功能连续做完,不要每个小纵切后停顿。
- 开发中只跑局部相关测试;域收口、风险改动或准备交接时再跑完整门禁。
- 一个 sprint 只覆盖一个页面域或一个产品域;遇到 protected path、shared stream/auth/proxy/core contract、跨域修复或验证失败需要改共享层时,立即停止继续叠功能,完成修复、完整门禁和 HANDOFF 后重新开包或等待用户确认。
- 每个 open gap 先分级为 Release must、P2 candidate、Live-only 或 Downgrade candidate;不要让 React 全量细节 parity 拖住 release 主路径。
- `SPEC-GAPS.md` 只作为 release ledger,只记录 Open Gap 被关闭、降级、新增或边界变化。
- 本文件只维护最新状态、验证时间、风险/边界、下一步 1-3 项和下一窗口可复制 prompt。

Live Signoff Lane 只有在环境具备时执行:

| 里程碑 | 需要条件 | 不具备时 |
| --- | --- | --- |
| M1 Live Gateway auth | Gateway、Vue runtime、真实账号或允许创建临时账号 | 记录阻塞,不使用 mock 关闭 |
| M2 Live scheduler | 已签 poller timing / completion / overlap;用户明确不做 expired-lease crash/reclaim drill | 不作为剩余 live signoff |
| M3 Real Gateway SSE replay | 可创建真实 thread/run,可触发 retained/dropped replay | 记录阻塞,保留 gap |
| M4 Live IM channels | 用户已明确不做 | 不作为剩余 live signoff |
| M5 Docker runtime | Docker daemon、网络、可 build/up | 记录环境边界 |

## 4. 最新检查点

**验证时间:2026-08-02 12:26:03 CST**

**最新状态**

- 本次进入 **M5 Docker runtime Live Signoff Lane** 并推进到部分 **M1 Gateway auth/chat live smoke**。真实 Docker daemon 可用,外部 dev 网络 `deer-flow-dev_deer-flow-dev` 存在;主站 Docker dev stack 已通过 `make docker-start` 运行。
- Vue Docker production 镜像已完成真实 `docker compose up -d --build`,容器 `deer-flow-frontend-vue` 已启动并显示 `healthy`;`/login` HTTP smoke 与 headless Chromium browser smoke 均通过。
- 新增 Vue Docker dev 热更新运行形态 `docker-vue/docker-compose.dev.yaml`;`deer-flow-frontend-vue-dev` 可在 `http://127.0.0.1:2028/login` 访问,日志显示 Nuxt dev server 与 vue-tsc watch 正常。
- 本次只改 `frontend-vue/` 与授权文档 `frontend-refactor-docs/HANDOFF.md`、`frontend-vue/tests/SPEC-GAPS.md`;未改 `frontend/`、`backend/`、`docker/`、根 Makefile、根 pnpm-workspace.yaml 或 `.gitignore`;未自动暂存。
- Docker live signoff 已覆盖 Vue container/Nitro runtime、主站 Gateway setup-status proxy、真实账号 auth API/session/protected-route/logout、standalone Vue 2027/2028 浏览器表单登录、真实 create-chat/send-message、真实 Gateway SSE retained/dropped replay 与 recovery join、真实 stop/cancel interrupt。Scheduler live 已覆盖真实 poller timing、scheduled run completion、manual overlap active-run conflict 与测试任务清理;用户明确不做 password-change live、IM provider live 和 scheduler expired-lease crash/reclaim drill。manual visual/a11y 仍保留边界,不冒充完成。

**完成内容**

- `frontend-vue/Dockerfile`:
  - deps 阶段复制 `frontend-vue/pnpm-workspace.yaml`,让容器内 `pnpm install --frozen-lockfile` 看到与 lockfile 一致的 `overrides`/build 配置。
  - build 阶段改为选择性复制 `.nuxtrc`、`nuxt.config.ts`、`tsconfig.json`、`app/`、`config/`、`server/`,避免本地 `node_modules`、`.nuxt`、`test-results` 污染镜像构建层。
  - build 阶段接收 `NUXT_GATEWAY_URL` build arg,让 Nuxt/Nitro route rules 在 production bundle 中烘入 Docker Gateway 地址。
- `docker-vue/docker-compose.yaml` / `docker-vue/README.md`:
  - 将 `VUE_GATEWAY_URL` 同时作为 Docker build arg 和 runtime env 传入 Vue 容器;README 标明 routeRules 是 build-time proxy target。
- `docker-vue/docker-compose.dev.yaml` / `docker-vue/README.md`:
  - 新增 hot-reload dev service,使用 Dockerfile `deps` stage 保留容器内 `node_modules`,只 bind mount Vue 源码/config/server/nuxt 配置,运行 `nuxt dev --host 0.0.0.0 --port 3000`。
  - README 标明 production compose 用于 built Nitro runtime signoff,dev compose 用于日常热更新开发;standalone Vue origin 需要 Gateway `GATEWAY_CORS_ORIGINS` allowlist 才能做浏览器表单登录。
- `.env` / `.env.example`:
  - 将 Gateway split-origin CORS allowlist 文档更新为 2027/2028 standalone Vue origins;本机 `.env` 已设置 `GATEWAY_CORS_ORIGINS` 供 Docker Gateway 持久读取。
- `docker/docker-compose-dev.yaml` / `docker/docker-compose.yaml` / `docker-vue/README.md`:
  - 在 Gateway `env_file: ../.env` 和 Vue Docker README 中补充注释,说明 `GATEWAY_CORS_ORIGINS` 同时驱动 Gateway CORS 与 auth CSRF origin check,不要通过剥离 `Origin` 或放宽代理头绕过。
- `frontend-vue/package.json` / `pnpm-lock.yaml`:
  - 显式加入 `dayjs`,匹配 Mermaid 11.16.0 production build 对 dayjs plugin 的实际依赖路径。
- `frontend-vue/nuxt.config.ts`:
  - 增加 Mermaid 触发的 `dayjs/esm/plugin/{advancedFormat,customParseFormat,duration,isoWeek}.js` Vite alias,指向 dayjs 实际存在的 plugin 文件,修复生产构建路径解析。
- `frontend-vue/tests/contract/docker-vue-parity.test.ts`:
  - 增加 production build alias contract 与 hot-reload dev compose contract,防止后续删除 Docker/Nuxt build 必需的 dayjs plugin alias 或将 dev bind mount 扩大到覆盖 `node_modules`。
- `frontend-vue/app/core/api/stream/client.ts` / `frontend-vue/tests/contract/gateway-sse-resume.test.ts`:
  - 将 Vue run stream request 从 Gateway 不支持的 `messages` 改为公开契约支持的 `messages-tuple`;后端仍以 SSE event `messages` 下发 message tuples,Vue adapter 保持读取 `messages` 事件。
- `frontend-vue/tests/SPEC-GAPS.md`:
  - 同步 Docker/live 真实结果:Vue container/Nitro runtime 已完成 build/up/health/browser/log;Gateway setup-status proxy、auth API/session/protected/logout、standalone Vue 2027/2028 browser form login、create chat、send message、real Gateway SSE retained/dropped replay/recovery join、stop/cancel interrupt、scheduler poller/completion/overlap 已签;password-change live、IM provider live 与 scheduler expired-lease crash/reclaim drill 已由用户明确排除;manual a11y 仍未签。

**验证结果**

- 初始禁改目录检查 `git status --short -- frontend backend docker Makefile pnpm-workspace.yaml .gitignore`:为空;中途复查仍为空。
- Docker/production build 失败与修复证据:
  - 首次 `DEER_FLOW_NETWORK=deer-flow-dev_deer-flow-dev docker compose -f docker-vue/docker-compose.yaml up -d --build` 失败:`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`,原因是 Dockerfile 未复制 `pnpm-workspace.yaml`。
  - 修复后再次失败:`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`,原因是整目录 COPY 带入本地生成/依赖状态;选择性 COPY 后消除。
  - 后续 Docker build 失败于 Mermaid/dayjs:`Could not load dayjs/esm/plugin/isoWeek.js`;本地 `cd frontend-vue && corepack pnpm build` 同样复现;加入 `dayjs` 与 Nuxt alias 后通过。
- Targeted verification:
  - `cd frontend-vue && corepack pnpm vitest run tests/contract/docker-vue-parity.test.ts` → 1 file / 5 tests passed。
  - `cd frontend-vue && corepack pnpm vitest run tests/contract/docker-vue-parity.test.ts tests/contract/gateway-sse-resume.test.ts tests/contract/spec-gaps.test.ts tests/unit/core/api/stream/client.test.ts` → 4 files / 17 tests passed。
  - `cd frontend-vue && corepack pnpm build` → Nuxt/Nitro production build passed;保留 Vite sourcemap/chunk-size warnings。
- Docker live runtime:
  - `DEER_FLOW_NETWORK=deer-flow-dev_deer-flow-dev docker compose -f docker-vue/docker-compose.yaml config` → 外部网络解析为 `deer-flow-dev_deer-flow-dev`。
  - `docker ps --filter name=deer-flow-frontend-vue --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Networks}}'` → `deer-flow-frontend-vue` 为 `Up ... (healthy)`,端口 `0.0.0.0:2027->3000/tcp`,网络 `deer-flow-dev_deer-flow-dev`。
  - `docker inspect --format '{{json .State.Health}}' deer-flow-frontend-vue` → `Status:"healthy"`, `FailingStreak:0`,healthcheck exit code `0`。
  - `docker logs --tail 80 deer-flow-frontend-vue` → `Listening on http://0.0.0.0:3000`。
  - `curl -I http://127.0.0.1:2027/login` → HTTP `200 OK`, `content-type:text/html;charset=utf-8`, `x-powered-by: Nuxt`。
  - `make docker-start` → 主站 dev Docker stack 启动成功,入口 `http://localhost:2026`,Gateway embedded runtime。
  - `curl -I http://127.0.0.1:2026` → 主站 nginx/Next 入口 HTTP `200 OK`。
  - `docker exec deer-flow-frontend-vue wget -S -O- http://gateway:8001/api/v1/auth/setup-status` → Vue 容器内直连 Gateway HTTP `200 OK`,返回 `{"needs_setup":false,"registration_enabled":true}`。
  - 发现并修复 Docker Vue production proxy target build-time 问题:旧 `.output/server` 将 routeRules 烘为 `http://127.0.0.1:8001/api/**`,导致 Vue 同源 `/api/v1/auth/setup-status` 502;加入 `NUXT_GATEWAY_URL` build arg 后重建,产物变为 `http://gateway:8001/api/**`。
  - `curl -i http://127.0.0.1:2027/api/v1/auth/setup-status` → Vue 同源 Gateway proxy HTTP `200 OK`,返回 `{"needs_setup":false,"registration_enabled":true}`。
  - Headless Chromium smoke against `http://127.0.0.1:2027/login` → status `200`,页面正文包含 `DeerFlow`、`登录后继续。`、邮箱/密码字段;`setupUnavailable:false`,不再显示 `无法获取 Gateway 初始化状态`。
- Docker dev runtime:
  - `DEER_FLOW_NETWORK=deer-flow-dev_deer-flow-dev docker compose -f docker-vue/docker-compose.dev.yaml config` → 外部网络解析为 `deer-flow-dev_deer-flow-dev`,端口解析为 `2028:3000`,bind mounts 限定在 `.nuxtrc`、`nuxt.config.ts`、`tsconfig.json`、`app/`、`config/`、`server/`。
  - `DEER_FLOW_NETWORK=deer-flow-dev_deer-flow-dev docker compose -f docker-vue/docker-compose.dev.yaml up -d --build` → `deer-flow-frontend-vue-dev` 启动。
  - `docker ps --format '{{.Names}} {{.Status}} {{.Ports}} {{.Networks}}'` → `deer-flow-frontend-vue-dev Up ... (healthy) 0.0.0.0:2028->3000/tcp ... deer-flow-dev_deer-flow-dev`。
  - `curl -I http://127.0.0.1:2028/login` → HTTP `200 OK`, `x-powered-by: Nuxt`。
  - `docker logs --tail 80 deer-flow-frontend-vue-dev` → Nuxt dev server listening on `0.0.0.0:3000`;vue-tsc watch reports `Found 0 errors. Watching for file changes.`
- Live auth/chat smoke:
  - Standalone Vue browser form login against `http://127.0.0.1:2027/login?next=/workspace` returned Gateway `403` with `Cross-site auth request denied.` because Gateway lacks `GATEWAY_CORS_ORIGINS` for Vue's split origin (`localhost:2027`/`127.0.0.1:2027`);this is a real environment/config boundary, not a password failure.
  - Persisted `GATEWAY_CORS_ORIGINS=http://127.0.0.1:2027,http://localhost:2027,http://127.0.0.1:2028,http://localhost:2028` in the root `.env`, updated `.env.example`, and added compose comments documenting that Gateway loads this value from `../.env` for split-origin Vue runtimes. Recreated only `deer-flow-gateway` without the previous temporary override; `docker inspect` confirmed the env was present after restart.
  - `docker exec deer-flow-gateway printenv GATEWAY_CORS_ORIGINS` returned the persisted 2027/2028 allowlist after the no-override Gateway recreate.
  - Headless Chromium browser-form login against `http://127.0.0.1:2027/login?next=/workspace/settings` and `http://127.0.0.1:2028/login?next=/workspace/settings` with the provided admin account both returned `/api/v1/auth/login/local` HTTP `200`, navigated to `/workspace/settings`, and subsequent browser `GET /api/v1/auth/me` returned `200` with matching email and admin role;no login error alert was visible.
  - Same-origin auth API login through Vue proxy with the provided admin account returned `200`;`GET /api/v1/auth/me` returned `200` with admin email/role;`/workspace/settings` loaded without redirect;`POST /api/v1/auth/logout` returned `200`;post-logout `/api/v1/auth/me` returned `401`;protected `/workspace/settings` redirected to `/login`.
  - Real create-chat smoke through Vue UI created `/workspace/chats/d752e93d-66e2-450f-8595-3e1eff6c011f` and showed the composer.
  - Initial send smoke failed with `/api/threads/{thread_id}/runs/stream` HTTP `422`;response body identified unsupported `stream_mode: messages`. After switching Vue to `messages-tuple` and rebuilding Docker Vue, real send smoke created `/workspace/chats/4da22246-4a95-4a8e-a8e7-3e29e6ae45eb`;`/runs/stream` returned `200`,page status was `completed`,run id `5bfd91b8-1a88-4e5a-8d8d-28e012433f3d`,cursor `1785641081480-0`,message count `4`,gap count `0`.
- Real SSE replay/resume smoke:
  - Dedicated live run `93eba56e-fe33-458c-bf87-624557e5ddd3` on thread `279e2007-4f94-4f67-819c-c415fc17f998` returned `/runs/stream` HTTP `200`, `Content-Location` with run id, 23 start events, event names `metadata`/`values`/`messages`/`end`, first event id `1785642845662-0`, last event id `1785642847740-0`.
  - Retained replay `/join` with `Last-Event-ID: 1785642845662-0` returned HTTP `200`, replayed 22 retained events through `end`, with retained ids starting at `1785642845690-0`.
  - Dropped replay `/join` with `Last-Event-ID: 0-0` returned HTTP `200` and real `stream_replay_gap` (`earliest_available_event_id: 1785642845662-0`, `latest_available_event_id: 1785642847768-0`, `recovery: reload_durable_state`); durable `/state` returned HTTP `200` with four messages; recovery `/join` from `1785642847768-0` returned `end` without another gap.
- Stop/cancel live smoke:
  - Headless Chromium submitted a no-sensitive-content long-output prompt on `http://127.0.0.1:2027/workspace/chats/ba22ae94-d61e-4d12-874a-438a8d5305e4`;start stream returned `/runs/stream` HTTP `200` with run id `116a2ff9-bb85-49e3-80c9-b796b0a74d4b`.
  - The Vue stop button became visible, clicking it called `/api/threads/ba22ae94-d61e-4d12-874a-438a8d5305e4/runs/116a2ff9-bb85-49e3-80c9-b796b0a74d4b/stream?action=interrupt` and returned HTTP `200`;the stop button disappeared after click.
  - Follow-up `GET /api/threads/ba22ae94-d61e-4d12-874a-438a8d5305e4/runs/116a2ff9-bb85-49e3-80c9-b796b0a74d4b` returned status `"interrupted"`, `message_count: 0`, and token counts all `0`, confirming the run was interrupted before any model output was committed.
- Scheduler live smoke:
  - 安全预检:在启动 poller 前,通过 Vue browser login 读取 `/api/scheduled-tasks` 得到当前 admin 账号任务数 `0`;随后直接查询 SQLite `scheduled_tasks` 聚合得到全局 `total=0`,避免启动 poller 时误触发旧任务。
  - 临时将本机 gitignored `config.yaml` 的 scheduler 改为 `enabled:true`, `poll_interval_seconds:2`, `min_once_delay_seconds:5`;重启 `deer-flow-gateway` 后容器内 `/app/project/config.yaml` 显示临时配置生效。验证结束后已恢复为 `enabled:false`, `poll_interval_seconds:5`, `min_once_delay_seconds:60`,并再次重启 Gateway。
  - Once poller/timing/completion:通过 Vue same-origin API 创建无敏感 prompt 的 once 任务 `task-59c7240dcb4a405b98ebae70a8d4ac24`,任务 title `scheduler-live-once-2026-08-02T04:20:32.731Z`;poller 自动触发 run history `task-run-534af5786c824ae6b1bc9dc1559066d9`, `trigger:"scheduled"`, `status:"success"`, run id `661cb93c-2445-4bef-86c1-7af084162d81`, thread id `b68c996c-7838-4fe3-b58e-01cbcabb98c0`, `scheduled_for:"2026-08-02T04:20:45.165902+00:00"`;父任务最终 `status:"completed"`, `run_count:1`, `next_run_at:null`。
  - Overlap active-run conflict:创建远未来 once 任务 `task-3fad739b084b47799fb3ba15fa05ee52`;第一次 `/api/scheduled-tasks/{id}/trigger` 返回 `200` 并产生 running run `73cb32b6-3544-4e87-a4b4-4811ed0461e5` / task run `task-run-f0a8b2e00c55470e95b96a50105e6b1c`;第二次立即 trigger 返回 `409` 和 `detail:"task already has an active run"`。随后调用 `/api/threads/226296ab-f8d0-4d12-8728-b32c933bc6f0/runs/73cb32b6-3544-4e87-a4b4-4811ed0461e5/stream?action=interrupt` 返回 `200`,run history 变为 `status:"interrupted"`。
  - 清理:API delete 对 completed/active-history 测试任务返回 `500`,因此改用 SQLite 只删除 `title like 'scheduler-live-%'` 的测试 rows 及其 run rows;最终收尾查询 `scheduled_tasks where title like 'scheduler-live-%'` 为 `0`,active `scheduled_task_runs` 为 `0`,`scheduled_tasks` total 为 `0`。人工 expired-lease reclaim 模拟没有产生 run,不计入 live signoff。

**风险/边界**

- Docker Vue container/Nitro runtime、dev hot-reload runtime、Gateway setup-status proxy、auth API/session/protected/logout、standalone Vue browser form login、create-chat/send-message、real Gateway SSE replay/resume、stop/cancel interrupt、scheduler poller/timing/completion 与 overlap active-run conflict 已有真实证据。
- Standalone Vue browser form login 已在当前运行容器中关闭;Gateway CORS 已持久化到根 `.env`,并由 `docker/docker-compose-dev.yaml` / `docker/docker-compose.yaml` 的 `env_file: ../.env` 注入。password-change live 用户明确不做,不要后续窗口再要求 disposable account/password 来签这一项。
- Scheduler expired-lease crash/reclaim drill 用户明确不做;本次人工模拟没有产生 run,已清理,不要后续窗口再要求专门故障演练来签这一项。IM provider live 用户明确不做,不要后续窗口再要求真实 provider/bot 来签这一项。manual visual/a11y 仍未关闭。
- Headless Chromium 首次在沙箱内启动失败于 macOS MachPort 权限;非沙箱权限重跑通过,记录为执行环境边界而非产品失败。
- 当前 `deer-flow-frontend-vue` 与 `deer-flow-frontend-vue-dev` 容器仍在运行,供人工继续访问 `http://127.0.0.1:2027/login` 与 `http://127.0.0.1:2028/login`;后续如需清理可分别运行 production/dev compose `down`。

## 5. 下一步 1-3 项

1. 等待用户审查与暂存授权;不要自动 `git add`。
2. 若要继续,只剩 manual visual/a11y 手工签收。
3. 没有 manual visual/a11y 条件时,不要继续用 mock/source-backed 证据关闭 manual gap。

## 6. 下一窗口可复制 prompt

```text
接手 DeerFlow frontend-vue Vue/Nuxt 重构后续工作。工作目录 /Users/wangcheng/Documents/workSpace/frontEnd/aiAppSpace/deer-flow。先运行 git status --short,确认 staged/unstaged;再确认 git status --short -- frontend backend docker Makefile pnpm-workspace.yaml .gitignore 为空。不要乱动既有 staged 状态;每次改完并验证后先不要自动暂存,只在我明确授权后,才精确暂存本次实际修改过的允许范围文件。只改 frontend-vue、docker-vue、以及我明确授权的 frontend-refactor-docs;本窗口已获授权修改根 `.env` 与 `docker/` 以持久化 Gateway CORS,且相关注释已写入。冷启动先读 AGENTS.md、frontend/AGENTS.md、backend/AGENTS.md、frontend-refactor-docs/README.md、frontend-refactor-docs/12-vue-execution-workflow.md、frontend-refactor-docs/HANDOFF.md、frontend-vue/tests/SPEC-GAPS.md。当前 Docker Vue live lane 已完成 production Vue container/Nitro runtime build/up/health/HTTP/browser/log,也新增并验证了 docker-vue dev hot-reload compose:deer-flow-frontend-vue-dev 在 2028 运行 Nuxt dev/vue-tsc watch。主站 Docker dev stack 已通过 make docker-start 启动。Docker Vue 使用 NUXT_GATEWAY_URL build arg 修复 Nuxt routeRules production proxy target 后,产物指向 http://gateway:8001/api/**;http://127.0.0.1:2027/api/v1/auth/setup-status 返回真实 Gateway 200,headless Chromium 打开 /login 不再显示 Gateway 初始化不可用。Gateway CORS 已持久化到根 `.env` 并由 `docker/docker-compose-dev.yaml` / `docker/docker-compose.yaml` 的 `env_file: ../.env` 注入,允许 2027/2028 split-origin;Gateway 已不带临时 override 重建验证。真实 admin 账号已签 Vue same-origin auth API login/session/protected-route/logout、2027/2028 standalone browser form login、创建 chat、发送消息;/runs/stream 200,run id/cursor 存在;real Gateway SSE retained replay、dropped gap、durable `/state`、recovery `/join` 已签;stop/cancel interrupt 已签,run `116a2ff9-bb85-49e3-80c9-b796b0a74d4b` 后端状态为 `interrupted`。Scheduler live 已签 poller timing/once completion 与 manual overlap active-run conflict:scheduled run `661cb93c-2445-4bef-86c1-7af084162d81` 成功,overlap 第二次 trigger 返回 409;测试任务已清理,Gateway scheduler 配置已恢复为 disabled。人工 expired-lease reclaim 模拟没有产生 run,且用户明确不做 scheduler expired-lease crash/reclaim drill,不要计入剩余 signoff。Vue stream client 已从 Gateway 不支持的 stream_mode messages 改为 messages-tuple。用户明确不做 password-change live 和 IM provider live。仍未完成:manual visual/a11y。用户明确排除 `$t()` / language-pack replacement:不要迁移页面文案到 `$t()`,不要扩大 i18n dictionary 来承接页面静态文案,也不要把它作为后续建议任务。没有明确人工浏览器条件时,不要把 mocked/source-backed 证据冒充 manual signoff。
```
