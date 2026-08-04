# frontend-vue M0 developer entrypoint. package.json intentionally contains only postinstall.

.PHONY: help install dev build preview lint format format-check typecheck test verify \
	e2e-install e2e-list e2e-m0 e2e-external e2e e2e-auth e2e-real-backend e2e-visual \
	proxy-smoke auth-disabled-smoke auth-cookie-smoke visual-baseline-smoke splitpanes-smoke \
	ws-smoke oidc-smoke run-protocol-smoke proxy-security audit docker-build container-smoke \
	baseline-refresh baseline-check

PYTHON ?= python3
PNPM = $(PYTHON) ../scripts/pnpm.py --dir frontend-vue
EXEC = $(PNPM) exec
DEV_PORT ?= 3100
E2E_PORT ?= 3101
IMAGE ?= deer-flow-frontend-vue:ci

help:
	@echo "frontend-vue M0 commands:"
	@echo "  make dev / build / preview     Nuxt lifecycle (dev port $(DEV_PORT))"
	@echo "  make verify                    lint + format-check + typecheck + unit + build"
	@echo "  make e2e-m0                    runnable M0 proxy/auth/visual/replay suite"
	@echo "  make e2e-external              G0-6/G0-7 gates needing a browser runtime and an IdP"
	@echo "  make e2e-list                  list shared React business contract inventory"
	@echo "  make e2e                       run full shared business contracts (M1+ delivery)"
	@echo "  make container-smoke           non-root /health / SIGTERM production image smoke"
	@echo "  make baseline-refresh          rebuild core provenance + test manifests (needs full clone)"
	@echo "  make baseline-check            fail if the checked-in manifests are stale"

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

typecheck:
	$(EXEC) vue-tsc --noEmit

test:
	$(EXEC) vitest run

verify: lint format-check typecheck test build

e2e-install:
	$(EXEC) playwright install --with-deps chromium

e2e-list:
	test -f ../frontend/node_modules/@playwright/test/package.json
	$(EXEC) playwright test --list

e2e-m0: proxy-smoke auth-disabled-smoke visual-baseline-smoke splitpanes-smoke auth-cookie-smoke run-protocol-smoke

# G0-6 and G0-7. Separate from e2e-m0 only because they need the backend browser
# extra (uv sync --extra browser && playwright install chromium) and a Gateway
# whose toolset includes browser_navigate — enabling that changes the system
# prompt and would break the run-protocol replay fixture's hash. Both gates are
# otherwise hermetic: the IdP is tests/support/run_m0_idp.py, no external service.
e2e-external: ws-smoke oidc-smoke

e2e:
	test -f ../frontend/node_modules/@playwright/test/package.json
	$(EXEC) playwright test

e2e-auth:
	test -f ../frontend/node_modules/@playwright/test/package.json
	$(EXEC) playwright test -c playwright.auth.config.ts

e2e-real-backend:
	test -f ../frontend/node_modules/@playwright/test/package.json
	$(EXEC) playwright test -c playwright.real-backend.config.ts

e2e-visual:
	$(EXEC) playwright test -c playwright.visual.config.ts

proxy-smoke:
	$(EXEC) playwright test -c playwright.m0.config.ts --grep @proxy
	$(EXEC) playwright test -c playwright.proxy-options.config.ts

auth-disabled-smoke:
	$(EXEC) playwright test -c playwright.m0.config.ts --grep @auth-disabled

auth-cookie-smoke:
	$(EXEC) playwright test -c playwright.m0-real-backend.config.ts --grep @auth-cookie

visual-baseline-smoke:
	$(EXEC) playwright test -c playwright.visual.config.ts

splitpanes-smoke:
	$(EXEC) playwright test -c playwright.m0.config.ts --grep @splitpanes

ws-smoke:
	$(EXEC) playwright test -c playwright.m0-external.config.ts --grep @ws

oidc-smoke:
	$(EXEC) playwright test -c playwright.m0-external.config.ts --grep @oidc

run-protocol-smoke:
	$(EXEC) playwright test -c playwright.m0-real-backend.config.ts --grep @run-protocol

proxy-security:
	$(EXEC) vitest run tests/unit/config/routes.test.ts

# 迁移台账维护命令。读 git 对象重建 baseline，因此必须在完整 clone 中运行，
# 且 diff 要交 review（06 §1e）。普通 CI 跑 make test 即可，不碰 git 历史。
BASELINE ?= HEAD

baseline-refresh:
	node scripts/core-provenance.mjs --refresh --baseline=$(BASELINE)
	node scripts/core-test-manifest.mjs --refresh --baseline=$(BASELINE)

baseline-check:
	node scripts/core-provenance.mjs --baseline=$(BASELINE)
	node scripts/core-test-manifest.mjs --baseline=$(BASELINE)

audit:
	$(PNPM) audit --audit-level moderate --registry https://registry.npmjs.org

docker-build:
	docker build --file Dockerfile --tag $(IMAGE) ..

container-smoke: docker-build
	./scripts/container-smoke.sh "$(IMAGE)"
