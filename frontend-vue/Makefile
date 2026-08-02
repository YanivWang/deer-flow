VUE_DOCKER_NETWORK ?= deer-flow-dev_deer-flow-dev
VUE_DOCKER_COMPOSE = DEER_FLOW_NETWORK=$(VUE_DOCKER_NETWORK) docker compose -f ../docker-vue/docker-compose.yaml
VUE_DOCKER_DEV_COMPOSE = DEER_FLOW_NETWORK=$(VUE_DOCKER_NETWORK) docker compose -f ../docker-vue/docker-compose.dev.yaml

.PHONY: install lint stylelint typecheck test test-p0 test-e2e verify verify-full \
	docker-up docker-down docker-dev-up docker-dev-down

install:
	pnpm install --strict-peer-dependencies

lint:
	pnpm lint

stylelint:
	pnpm stylelint

typecheck:
	pnpm typecheck

test:
	pnpm test

test-p0:
	pnpm test:p0

test-e2e:
	pnpm test:e2e

verify:
	pnpm lint
	pnpm stylelint
	pnpm typecheck
	pnpm test

verify-full: verify
	pnpm exec playwright test -c playwright.vue.config.ts
	pnpm exec playwright test -c playwright.real-backend.config.ts

docker-up:
	$(VUE_DOCKER_COMPOSE) up -d --build

docker-down:
	$(VUE_DOCKER_COMPOSE) down

docker-dev-up:
	$(VUE_DOCKER_DEV_COMPOSE) up -d --build

docker-dev-down:
	$(VUE_DOCKER_DEV_COMPOSE) down
