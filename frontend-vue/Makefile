.PHONY: install lint stylelint typecheck test test-e2e verify verify-full

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

test-e2e:
	pnpm test:e2e

verify:
	pnpm lint
	pnpm stylelint
	pnpm typecheck
	pnpm test

verify-full: verify
	pnpm test:e2e
