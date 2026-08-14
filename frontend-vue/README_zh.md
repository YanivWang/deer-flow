# DeerFlow Vue 前端

[English](README.md) | 简体中文

这个 Nuxt 4 工作区是与 `../frontend` 并存、共用同一 Gateway 的已落地 Vue 前端。
**M-1 至 M8 的仓库内里程碑均已关闭；M7 已通过 Vue 自有的 130/130 门禁完全收口。**
聊天工作区、产物、工作区变更、侧边面板、设置、浏览器、智能体、渠道、定时任务、
目标/模式和移动端界面均已接入现有 Gateway/数据流，并与当前 React 前端对齐；其中包括
同一次 run 的重连顺序、公开 Showcase、自定义智能体的 Browser Live 可见性、Buzz 渠道和
Lark 应用切换。生产 Compose 保持 React 为默认入口，Vue 通过次级 hostname 访问。
历史上两个共享测试例外已经关闭，且没有削弱 Vue 产品行为。公网部署激活被明确排除在
当前交付范围之外，仍为未执行（UNRUN）。

M8 冻结了私有 `@deerflow/agent-core` 根 API、最小 L2 源码边界和隔离的自定义后端消费者；
它不发布 npm 包，也不改变生产路由。修改本工作区前，请先阅读
[落地状态记录](../frontend-vue-build-docs/10-current-status-and-next.md)；各里程碑的
evidence 只代表历史结果，不是当前状态的事实来源。

请把 Makefile 作为唯一的开发入口：

```bash
make install
make dev       # http://localhost:3100
make verify
make migration-check
make consumer-check
make header-check
make e2e-m0
make e2e-m4a
make e2e-m4a-stream
make e2e-m4b
make e2e-m5-list
make e2e-m5
make e2e-m5-real-backend
make e2e-m6-list
make e2e-m6
make e2e-m6-real-backend
make e2e-m7-list
make e2e-m7      # 精确的 Vue 自有 25 文件/130 测试门禁
make e2e-m7-local-list
make e2e-m7-local  # 精确的 1 spec/8 测试 sidebar/IME/a11y/H7-H8 门禁
make e2e-m7-auth-list
make e2e-m7-auth   # 精确的 1 spec/7 测试鉴权请求/安全门禁
make e2e-m7-real-protocol  # replay Gateway 的 resume/gap/cancel 浏览器门禁
make e2e-m7-visual  # 七个确定性产品状态截图
make asset-budget  # 构建并检查客户端资源 raw/gzip 预算
make e2e-list  # 汇总共享的 M1+ 业务契约；不代表这些契约已经通过
```

在仓库根目录下，如果需要同时启动 Gateway 和 Vue，使用根 Makefile 的生命周期命令：

```bash
make dev-vue   # Gateway :8001 + Vue :3100
```

如果只想启动 Vue，并且不进入 `frontend-vue` 目录，使用 Make 的大写 `-C` 目录参数：

```bash
make -C frontend-vue dev
```

`make -C frontend-vue dev` 等价于 `cd frontend-vue && make dev`，但你的终端仍停留在仓库根目录。
这里的 `-C` 必须大写；小写 `-c` 不是 Make 的目录参数。也可以写成长参数：
`make --directory=frontend-vue dev`。

如需了解在其他项目中通过 workspace/tarball 接入、自定义 `RunProtocol` + `EventReducer` +
消息适配器示例、L2 接缝以及完整的 L3 替换清单，请阅读 [REUSE.md](REUSE.md)。该包是
私有包，尚未发布到 npm。

`make e2e-external` 包含浏览器运行时 WebSocket（G0-6）和受控 fixture IdP 的 OIDC 双回调
（G0-7）。它们没有放进 `make e2e-m0`，因为它们需要后端 browser extra 和不同的 Gateway
工具集；CI 通过 [frontend-vue-verify.yml](../.github/workflows/frontend-vue-verify.yml) 中的
手动 `external-gates` job 执行它们。如果启用了 VPN 或系统代理，本地 fixture 流量必须绕过代理：

```bash
NO_PROXY=127.0.0.1,localhost make e2e-external
```

这是当前环境要求，Makefile 尚未强制保证这一点。

必须先安装 React 测试宿主，再安装本工作区，因为框架无关的共享 spec 与 Vue runner 有意使用
同一个物理 `@playwright/test` 实例。框架特定的 Vue 行为通过 Vue inventory 中的完整路径选择，
不会被强制套用 React DOM 或 transition 契约。Agent chat、channels、integrations 和 thread
history 均有 Vue 自有 spec。只有 React 变更的产品语义在 Vue 中显式实现后，才能进入此门禁；
因此当前 Browser Live、Lark、Buzz 和 Showcase 增量已被覆盖，但没有引入 React DOM 结构：

```bash
python3 scripts/pnpm.py install --frozen-lockfile
python3 scripts/pnpm.py --dir frontend-vue install --frozen-lockfile
```

## 迁移账本（M1）

`baseline/` 保存机器生成的账本，用于描述 `../frontend/src/core` 如何映射到 `app/core/`。
这些账本从 Git 对象重新生成，绝不能手工编辑：

```bash
make baseline-refresh   # 重新生成；需要完整 clone，提交差异供审查
make baseline-check     # 已提交账本过期时失败
make land-copied        # 将 COPIED 集合逐字节复制到 app/core
make land-retyped       # 将声明的重新类型化改动应用到 app/core
make codemod-tests      # 从 rstest 源重新生成 tests/unit/core
make migration-check    # baseline-check + codemod-check + land-retyped-check
make i18n-check         # 字典健康检查；也会在 `make verify` 中执行
make i18n-diff          # 对照 baseline/i18n-keys.json 检查 key 漂移
make i18n-unused        # 报告未被代码引用的 key（M4b 之前仅报告）
```

i18n 基线有意在字典仍与上游逐字节一致时建立。一旦开始改写组件，如果没有这份基线，就无法
回答“这次改写丢失了哪个 key”。同时从两个 locale 中删除同一个 key 仍能通过类型检查——只有
基线能发现这种问题。

`COPIED` 文件与上游逐字节一致，并受 SHA-256 保护；`RETYPED` 文件由本项目维护——它们带有
六段式文件头，会参与格式化和 lint，而且相对上游的每一处差异都必须在
`scripts/land-retyped.mjs` 中声明。如果已落地的 `RETYPED` 文件被手工修改，
`make land-retyped-check` 会失败；这与 `codemod-check` 对生成测试执行的是同一种契约。

账本锚定到 Makefile 中 `BASELINE` 固定的**冻结基线提交**，绝不能使用 `HEAD`。使用 `HEAD`
会自我失效：账本记录其生成来源提交，提交账本后 `HEAD` 随即移动，导致 `baseline-check`
立即判定过期。变更基线必须显式修改，并审查产生的差异。

`make verify` 有意**不**运行 `baseline-check` 或 `codemod-check`：普通 CI 不应依赖历史 Git
对象是否存在。CI 实际强制执行的是：

- `tests/guards/core-provenance.test.ts`：`app/core/` 下的每个文件都必须出现在
  [app/core/PROVENANCE.md](app/core/PROVENANCE.md) 中；归类为 `COPIED` 的内容必须与
  `baseline/core-sha256.json` 逐字节一致。如果需要修改 `COPIED` 文件，应说明原因并将其
  降级为 `RETYPED`/`ADAPTED`；不能通过刷新基线让守卫变绿。
- `make collected-check`：Vitest 只报告实际收集到的测试，因此测试套件即使悄悄停止收集某个
  文件也可能通过。该命令把实际收集集合与 `baseline/core-test-manifest.json` 比较，包括每个
  测试由哪个 project 执行；任一方向存在差异都会失败。
- `make typecheck`：使用 `baseline/typecheck-known.json` 中的预算，而不是直接采用原始
  `vue-tsc` 结果。在 `RETYPED` 之前落地 `COPIED` 必然产生已知的模块缺失错误；只要列表多
  **或少**一项，预算都会失败，因此每批文件落地时都必须显式缩减列表，并在 M1 结束时归零。
  `make typecheck-raw` 可查看未过滤输出。

`COPIED` 文件不参与 Prettier 和 ESLint——这是实测结果，不是主观假设：Prettier 3.9.6 会重新
格式化其中 7 个文件（上游使用 3.8.1），ESLint 会在 4 个文件中报告 5 个问题。一次
`make format` 就会破坏逐字节一致性守卫。只有这一类文件被排除；本项目在 `app/core/` 下编写的
文件仍会接受完整检查，文件一旦不再属于 `COPIED`，也会自动恢复检查。

`NUXT_PUBLIC_AUTH_DISABLED=1` 仅用于 mock 测试。
`NUXT_PUBLIC_M0_TEST_PAGES=1` 会暴露隔离的 `/__m0/*` 可视化与 splitpanes fixture；
在正常生产配置中，这些路径返回 404。

## 当前验证边界

当前 checkout 的 `make verify` 已通过，共 110 个 Vitest 文件、1102 个测试；同时已通过
`make migration-check`、M4a 4/4、chunked SSE 3/3、M4b 73/73、M5 27/27、M6 30/30、
真实 Gateway artifact 1/1、浏览器 binary frame 1/1、replay Gateway
resume/heartbeat/cancel/gap 1/1、real-backend 3/3 和资源硬预算。精确的 Vue M7 inventory
为 25 个文件、130 个测试，并在连续三次完整运行中取得 **130/130**，重试次数为零。
本地交互和鉴权门禁分别通过 8/8 与 7/7；七状态可视化门禁、fixture IdP/browser 外部门禁、
生产容器 smoke 以及 React 默认/Vue 次级生产路由契约也全部通过。容器 smoke 现在还会验证
所有 allowlist 中的 Showcase JSON/HTML/image 资源均进入生产镜像，并确保 unknown、unlisted
和 traversal 路径 fail closed。

历史上的 118/120 例外已经从结构上关闭。Vue 自有 protocol-complete batched-stream 和原生
splitpanes panel spec；框架无关的 React spec 继续共享。产品不再为了等待 listener 而延迟
artifact 自动打开，不再注入 React separator DOM，不再重复实现 splitpanes keyboard/ARIA，
也不再在 UI 组件内二次映射 wire chunk。生产环境仍然要求同时存在 `Content-Location` 和终止
`end`，因此继续保持 fail closed。

公网 DNS/TLS/外层代理/真实 IdP 行为因交付范围明确排除而仍为 **UNRUN**。本地真实 MiniMax
Gateway create/stream 已成功，但它不能证明公网目标已经通过。React 仍是默认生产前端；Vue
仍只能通过次级 hostname 访问。

精确命令、失败原因、M4b/M5/M6 退出门槛和有序任务计划请参阅
[10-current-status-and-next.md](../frontend-vue-build-docs/10-current-status-and-next.md) 与
[M7 最终证据](../frontend-vue-build-docs/evidence/m7-vue-gate-final-closure.md)。后续的
`origin/main` 合并与独立门禁证据记录在
[main-merge-2026-08-14.md](../frontend-vue-build-docs/evidence/main-merge-2026-08-14.md)。
React 到 Vue 的显式功能对齐收口记录在
[react-parity-closure-2026-08-14.md](../frontend-vue-build-docs/evidence/react-parity-closure-2026-08-14.md)。
最终完整矩阵复跑与生产镜像加固证据记录在
[react-vue-final-gates-2026-08-14.md](../frontend-vue-build-docs/evidence/react-vue-final-gates-2026-08-14.md)。
双前端运维和回滚方式记录在
[dual-frontend-production.md](../docs/dual-frontend-production.md)；公开激活 Vue 前仍必须完成
DNS/TLS 与目标环境验证。[M0 验证记录](../frontend-vue-build-docs/evidence/m0-verification.md)
仅作为历史里程碑证据保留。
