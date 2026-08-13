# frontend-vue M0 developer entrypoint. package.json intentionally contains only postinstall.

.PHONY: help install dev build preview lint format format-check typecheck typecheck-core test verify asset-budget \
	e2e-install e2e-list e2e-m0 e2e-m4a e2e-m4a-stream e2e-m4b-list e2e-m4b e2e-m5-list e2e-m5 e2e-m5-real-backend e2e-m6-list e2e-m6 e2e-m6-real-backend e2e-m7-list e2e-m7 e2e-m7-local-list e2e-m7-local e2e-m7-auth-list e2e-m7-auth e2e-m7-real-protocol e2e-m7-visual e2e-external e2e e2e-auth e2e-real-backend e2e-visual \
	proxy-smoke auth-disabled-smoke auth-cookie-smoke visual-baseline-smoke splitpanes-smoke \
	ws-smoke oidc-smoke run-protocol-smoke proxy-security audit docker-build container-smoke \
	baseline-refresh baseline-check land-copied land-retyped land-retyped-check \
	codemod-tests codemod-check collected-check migration-check typecheck-raw \
	typecheck-refresh i18n-check i18n-diff i18n-unused i18n-refresh \
	gen-api-types gen-api-types-check consumer-check

PYTHON ?= python3
PNPM = $(PYTHON) ../scripts/pnpm.py --dir frontend-vue
EXEC = $(PNPM) exec
E2E_EXEC = node scripts/with-loopback-no-proxy.mjs -- $(EXEC)
DEV_PORT ?= 3100
E2E_PORT ?= 3101
E2E_M4B_PORT ?= 3102
E2E_M5_PORT ?= 3105
E2E_M6_PORT ?= 3106
E2E_M7_LOCAL_PORT ?= 3107
E2E_M7_AUTH_PORT ?= 3108
E2E_M7_VISUAL_PORT ?= 3109
IMAGE ?= deer-flow-frontend-vue:ci

help:
	@echo "frontend-vue M0 commands:"
	@echo "  make dev / build / preview     Nuxt lifecycle (dev port $(DEV_PORT))"
	@echo "  make verify                    lint + format-check + typecheck + unit + build"
	@echo "  make e2e-m0                    runnable M0 proxy/auth/visual/replay suite"
	@echo "  make e2e-m4a                   M4a data-flow gate (send/stream/stop/reload ordering)"
	@echo "  make e2e-m4a-stream            M4a real chunked-SSE gate (heartbeat/resume cursor/gap)"
	@echo "  make e2e-m4b-list              verify/list the exact M4b 11-file contract inventory"
	@echo "  make e2e-m4b                   run the exact M4b shared contract gate"
	@echo "  make e2e-m5                    run the exact M5 artifacts/sidecar/changes gate"
	@echo "  make e2e-m5-real-backend       run M5 write-file/artifact against replay Gateway"
	@echo "  make e2e-m6-real-backend       run M6 browser panel against browser-enabled replay Gateway"
	@echo "  make e2e-m6                    run the exact M6 remaining-L3 shared contract gate"
	@echo "  make e2e-m7-list               verify/list the exact 25-file M7 shared inventory"
	@echo "  make e2e-m7                    verify then run the full M7 shared contract gate"
	@echo "  make e2e-m7-local              run exact M7 sidebar/IME/keyboard/a11y contracts"
	@echo "  make e2e-m7-auth               run exact M7 auth request/security contracts"
	@echo "  make e2e-m7-real-protocol      run real Gateway resume/gap/browser-cancel contract"
	@echo "  make e2e-m7-visual             compare seven deterministic product-state screenshots"
	@echo "  make asset-budget              build and enforce raw/gzip client asset budgets"
	@echo "  make e2e-external              G0-6/G0-7 gates needing a browser runtime and an IdP"
	@echo "  make e2e-list                  list shared React business contract inventory"
	@echo "  make e2e                       run full shared business contracts (M1+ delivery)"
	@echo "  make container-smoke           non-root /health / SIGTERM production image smoke"
	@echo "  make baseline-refresh          rebuild core provenance + test manifests (needs full clone)"
	@echo "  make baseline-check            fail if the checked-in manifests are stale"
	@echo "  make land-copied               copy the COPIED set into app/core byte-for-byte"
	@echo "  make land-retyped              apply the declared retypes into app/core"
	@echo "  make codemod-tests             regenerate tests/unit/core from rstest sources"
	@echo "  make collected-check           fail if vitest collects a different set than the manifest"
	@echo "  make migration-check           baseline-check + codemod-check (needs full clone)"
	@echo "  make typecheck-raw             unfiltered vue-tsc output"
	@echo "  make typecheck-core            standalone tsc for packages/agent-core"
	@echo "  make gen-api-types             regenerate app/core/api/types.gen.ts from the snapshot"
	@echo "  make consumer-check            clean-install packages/agent-core into a temp consumer"
	@echo "  make typecheck-refresh         rebuild the known-typecheck-error budget"
	@echo "  make i18n-check                dictionary health: locales in sync, no key lost"
	@echo "  make i18n-diff / i18n-unused   key drift against the baseline / unreferenced keys"

install:
	$(PNPM) install

dev:
	$(EXEC) nuxt dev --port $(DEV_PORT)

build:
	$(EXEC) nuxt build

preview:
	PORT=$(DEV_PORT) HOST=127.0.0.1 $(EXEC) nuxt preview

lint:
	$(EXEC) eslint .

format:
	$(EXEC) prettier --write .

format-check:
	$(EXEC) prettier --check .

# 预算门禁而不是裸 vue-tsc：M1 分窗口推进期间，COPIED 引用尚未落地的 RETYPED
# 必然报错。把 typecheck 移出 verify 会连带放过真正的类型错误，所以改成钉预算。
typecheck:
	node scripts/typecheck-budget.mjs

typecheck-raw:
	$(EXEC) vue-tsc --noEmit

# packages/agent-core 走**自己的** tsconfig，不走 vue-tsc。
#
# 这不是洁癖，是本窗口实测出来的洞：`.nuxt/tsconfig.app.json` 的 include 只有
# app/** 与 tests/nuxt/**，`packages/agent-core/src/**` 一行都不在里面——
# 也就是说 M2 的整个交付物在加这条之前从未被类型检查过（首次运行 6 条错误）。
# 顺带满足 08 §54：包要能在自己的 tsconfig 下独立 typecheck，
# 否则「整包搬给别的项目」这个卖点没有任何机器证据。
typecheck-core:
	$(EXEC) tsc --noEmit -p packages/agent-core
	$(EXEC) tsc --noEmit -p packages/agent-core/tsconfig.test.json

typecheck-refresh:
	node scripts/typecheck-budget.mjs --refresh

# REST 信封类型（02 §340 / 04 §267）。生成源是**签入的**快照，不是活着的 Gateway：
# 让 CI 去 curl 一个跑着的后端，门禁就会随部署状态变色。
# check 检的是幂等性——同一份快照生成两次必须一致。刷新快照的命令见
# baseline/openapi.snapshot.README.md。OpenAPI 不承担 SSE schema（06 原话）。
gen-api-types:
	node scripts/gen-api-types.mjs

gen-api-types-check:
	node scripts/gen-api-types.mjs --check

# 08 §54 的可移植性验收。打真包 → 临时目录 clean install → typecheck → 跑一次最小
# session。**不进 verify**：它要联网装 typescript/esbuild，而 verify 必须能离线跑。
# 里程碑收口与改动 packages/agent-core/package.json 时必须跑一次。
consumer-check:
	node scripts/consumer-check.mjs

test:
	$(EXEC) vitest run

# 词典体检（06 §M1 1d）。只读签入的词典与基线，不碰 git 历史，所以能进 verify。
# 基线必须趁词典还是上游原样时取——等 M4b 重写完再补，「这次漏了哪个 key」就无从判断。
i18n-check:
	node scripts/i18n-manager.mjs check

i18n-diff:
	node scripts/i18n-manager.mjs diff

i18n-unused:
	node scripts/i18n-manager.mjs unused

i18n-refresh:
	node scripts/i18n-manager.mjs --refresh

# collected-check 只读签入的台账与 vitest 的收集结果，不碰 git 历史，所以能进 verify。
# 它防的是「少收集几个测试换全绿」——vitest run 本身报告不了没被收集的东西。
verify: lint format-check typecheck typecheck-core test collected-check i18n-check gen-api-types-check build

# The build dependency makes the gate inspect the current checkout rather than stale .output.
asset-budget: build
	node scripts/asset-budget.mjs

e2e-install:
	$(EXEC) playwright install --with-deps chromium

e2e-list:
	test -f ../frontend/node_modules/@playwright/test/package.json
	$(E2E_EXEC) playwright test --list

e2e-m0: proxy-smoke auth-disabled-smoke visual-baseline-smoke splitpanes-smoke auth-cookie-smoke run-protocol-smoke

# M4a 的数据流 gate。与 e2e-m0 / verify **不能并发**：三者都会起 nuxt build。
e2e-m4a:
	test -f ../frontend/node_modules/@playwright/test/package.json
	PLAYWRIGHT_BASE_URL=http://localhost:3103 $(E2E_EXEC) playwright test -c playwright.m4a.config.ts

# 真流 gate：浏览器从 socket 上一片一片读，覆盖 route.fulfill 到不了的四件事
# （分帧边界、心跳、Last-Event-ID 续传、gap→A7）。同样不能与其他 build 并发。
e2e-m4a-stream:
	test -f ../frontend/node_modules/@playwright/test/package.json
	PLAYWRIGHT_BASE_URL=http://localhost:3104 $(E2E_EXEC) playwright test -c playwright.m4a-stream.config.ts

e2e-m4b-list:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M4B_PORT=$(E2E_M4B_PORT) node scripts/m4b-inventory.mjs --list

e2e-m4b:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M4B_PORT=$(E2E_M4B_PORT) node scripts/m4b-inventory.mjs
	E2E_M4B_PORT=$(E2E_M4B_PORT) PLAYWRIGHT_BASE_URL=http://localhost:$(E2E_M4B_PORT) $(E2E_EXEC) playwright test -c playwright.m4b.config.ts

e2e-m5-list:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M5_PORT=$(E2E_M5_PORT) node scripts/m5-inventory.mjs --list

e2e-m5:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M5_PORT=$(E2E_M5_PORT) node scripts/m5-inventory.mjs
	E2E_M5_PORT=$(E2E_M5_PORT) PLAYWRIGHT_BASE_URL=http://localhost:$(E2E_M5_PORT) $(E2E_EXEC) playwright test -c playwright.m5.config.ts

e2e-m5-real-backend:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_FRONTEND_PORT=$(E2E_PORT) $(E2E_EXEC) playwright test -c playwright.m5-real-backend.config.ts

e2e-m6-list:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M6_PORT=$(E2E_M6_PORT) node scripts/m6-inventory.mjs --list

e2e-m6:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M6_PORT=$(E2E_M6_PORT) node scripts/m6-inventory.mjs
	E2E_M6_PORT=$(E2E_M6_PORT) PLAYWRIGHT_BASE_URL=http://localhost:$(E2E_M6_PORT) $(E2E_EXEC) playwright test -c playwright.m6.config.ts

e2e-m6-real-backend:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_FRONTEND_PORT=$(E2E_PORT) $(E2E_EXEC) playwright test -c playwright.m6-real-backend.config.ts

e2e-m7-list:
	test -f ../frontend/node_modules/@playwright/test/package.json
	node scripts/m7-inventory.mjs --list

e2e-m7:
	test -f ../frontend/node_modules/@playwright/test/package.json
	node scripts/m7-inventory.mjs
	$(E2E_EXEC) playwright test

e2e-m7-local-list:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M7_LOCAL_PORT=$(E2E_M7_LOCAL_PORT) node scripts/m7-local-inventory.mjs --list

e2e-m7-local:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M7_LOCAL_PORT=$(E2E_M7_LOCAL_PORT) node scripts/m7-local-inventory.mjs
	E2E_M7_LOCAL_PORT=$(E2E_M7_LOCAL_PORT) PLAYWRIGHT_BASE_URL=http://localhost:$(E2E_M7_LOCAL_PORT) $(E2E_EXEC) playwright test -c playwright.m7-local.config.ts

e2e-m7-auth-list:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M7_AUTH_PORT=$(E2E_M7_AUTH_PORT) node scripts/m7-auth-inventory.mjs --list

e2e-m7-auth:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M7_AUTH_PORT=$(E2E_M7_AUTH_PORT) node scripts/m7-auth-inventory.mjs
	E2E_M7_AUTH_PORT=$(E2E_M7_AUTH_PORT) PLAYWRIGHT_BASE_URL=http://localhost:$(E2E_M7_AUTH_PORT) $(E2E_EXEC) playwright test -c playwright.m7-auth.config.ts

# M7 owns the browser evidence, while the stronger replay-Gateway state machine
# remains single-sourced in tests/m0-real-backend/run-protocol.spec.ts.
e2e-m7-real-protocol: run-protocol-smoke

e2e-m7-visual:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_M7_VISUAL_PORT=$(E2E_M7_VISUAL_PORT) PLAYWRIGHT_BASE_URL=http://localhost:$(E2E_M7_VISUAL_PORT) $(E2E_EXEC) playwright test -c playwright.m7-visual.config.ts

# G0-6 and G0-7. Separate from e2e-m0 only because they need the backend browser
# extra (uv sync --extra browser && playwright install chromium) and a Gateway
# whose toolset includes browser_navigate — enabling that changes the system
# prompt and would break the run-protocol replay fixture's hash. Both gates are
# otherwise hermetic: the IdP is tests/support/run_m0_idp.py, no external service.
e2e-external: ws-smoke oidc-smoke

e2e:
	test -f ../frontend/node_modules/@playwright/test/package.json
	$(E2E_EXEC) playwright test

e2e-auth:
	test -f ../frontend/node_modules/@playwright/test/package.json
	$(E2E_EXEC) playwright test -c playwright.auth.config.ts

e2e-real-backend:
	test -f ../frontend/node_modules/@playwright/test/package.json
	E2E_FRONTEND_PORT=$(E2E_PORT) $(E2E_EXEC) playwright test -c playwright.real-backend.config.ts

e2e-visual:
	$(E2E_EXEC) playwright test -c playwright.visual.config.ts

proxy-smoke:
	$(E2E_EXEC) playwright test -c playwright.m0.config.ts --grep @proxy
	$(E2E_EXEC) playwright test -c playwright.proxy-options.config.ts

auth-disabled-smoke:
	$(E2E_EXEC) playwright test -c playwright.m0.config.ts --grep @auth-disabled

auth-cookie-smoke:
	$(E2E_EXEC) playwright test -c playwright.m0-real-backend.config.ts --grep @auth-cookie

visual-baseline-smoke:
	$(E2E_EXEC) playwright test -c playwright.visual.config.ts

splitpanes-smoke:
	$(E2E_EXEC) playwright test -c playwright.m0.config.ts --grep @splitpanes

ws-smoke:
	$(E2E_EXEC) playwright test -c playwright.m0-external.config.ts --grep @ws

oidc-smoke:
	$(E2E_EXEC) playwright test -c playwright.m0-external.config.ts --grep @oidc

run-protocol-smoke:
	$(E2E_EXEC) playwright test -c playwright.m0-real-backend.config.ts --grep @run-protocol

proxy-security:
	$(EXEC) vitest run tests/unit/config/routes.test.ts

# 迁移台账维护命令。读 git 对象重建 baseline，因此必须在完整 clone 中运行，
# 且 diff 要交 review（06 §1e）。普通 CI 跑 make test 即可，不碰 git 历史。
#
# 锚必须是**固定 commit**，不能是 HEAD。两个理由：
#   1. 对标对象就是冻结基线 27a425b0（06 §冻结基线与上游同步策略，README 同）。
#      里程碑进行中完全不看上游，台账自然要锚在那一份树上。
#   2. HEAD 会自我作废：台账把 baselineCommit 写进产物，一提交 HEAD 就变，
#      baseline-check 逐字节比对必红。上一窗口正是这样——提交前绿、提交后红。
# 换基线是一次显式动作：改这里 + make baseline-refresh + diff 交 review。
BASELINE ?= 27a425b0f1078baf8b2a361103a2b136ee342ab5

baseline-refresh:
	node scripts/core-provenance.mjs --refresh --baseline=$(BASELINE)
	node scripts/core-test-manifest.mjs --refresh --baseline=$(BASELINE)

baseline-check:
	node scripts/core-provenance.mjs --baseline=$(BASELINE)
	node scripts/core-test-manifest.mjs --baseline=$(BASELINE)

# 已落地的分类。codemod 与对账脚本按这个值重算期望集。
# BLOCKED 档永远不进这里：那 8 个文件内容零改动但 import 指向 M4 才存在的 REWRITE 模块，
# 它们随被依赖方一起落地，不是靠这里放行。
LANDED ?= COPIED,RETYPED

land-copied:
	node scripts/land-copied.mjs --write

land-retyped:
	node scripts/land-retyped.mjs --write

land-retyped-check:
	node scripts/land-retyped.mjs

codemod-tests:
	node scripts/rstest-to-vitest.mjs --write --landed=$(LANDED)

codemod-check:
	node scripts/rstest-to-vitest.mjs --landed=$(LANDED)

collected-check:
	node scripts/collected-vs-manifest.mjs --landed=$(LANDED)

# 需要完整 clone（要读 baseline commit 的 git 对象），因此不进 verify。
migration-check: baseline-check codemod-check land-retyped-check

audit:
	$(PNPM) audit --audit-level moderate --registry https://registry.npmjs.org

docker-build:
	docker build --file Dockerfile --tag $(IMAGE) ..

container-smoke: docker-build
	./scripts/container-smoke.sh "$(IMAGE)"
