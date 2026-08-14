# DeerFlow Vue frontend

English | [简体中文](README_zh.md)

`frontend-vue` is the complete Nuxt 4 implementation of the DeerFlow web
application. It uses the same Gateway contracts as `../frontend` and covers the
chat workspace, artifacts, sidecar, browser control, agents, channels,
integrations, scheduled tasks, settings, goal/mode, authentication, Showcase,
mobile layouts and production container.

React remains the default production hostname; Vue is selected only by
`DEER_FLOW_VUE_HOSTNAME`. This is a deployment choice, not a missing Vue feature.
Public DNS, TLS, outer-proxy trust and real IdP callback registration must still
be configured in the target environment.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): current layers, runtime flow, state
  ownership, proxy and authentication boundaries.
- [BEHAVIOR_CONTRACTS.md](BEHAVIOR_CONTRACTS.md): product, streaming, ordering,
  cache, panel and Vue semantics that changes must preserve.
- [REUSE.md](REUSE.md): private `@deerflow/agent-core` and reusable UI seams.
- [Production dual-frontend guide](../docs/dual-frontend-production.md): hostname,
  OIDC, validation and rollback.
- [app/core/PROVENANCE.md](app/core/PROVENANCE.md): maintained source-origin
  ledger for files under `app/core/`.

## Run locally

From the repository root:

```bash
make dev-vue   # Gateway :8001 + Vue :3100
make dev-dual  # Gateway :8001 + React :3000 + Vue :3100
make stop
```

For the Vue workspace only:

```bash
cd frontend-vue
make install
make dev       # http://localhost:3100
```

`make -C frontend-vue dev` is equivalent when the shell should remain at the
repository root.

## Verify changes

Start with the smallest relevant gate and finish with `make verify` for normal
module changes:

```bash
make verify
make consumer-check     # changes to packages/agent-core
make e2e-list           # inspect the shared browser-contract inventory
make e2e-m7             # full Vue browser contract
make e2e-m7-auth        # authentication requests and security
make e2e-m7-real-protocol
make e2e-m7-visual
make asset-budget
make container-smoke
```

Run `make help` for every specialized proxy, protocol, real-Gateway, visual,
inventory and maintenance command. Some command names retain historical `m0`–`m7`
suite identifiers; they are stable test entrypoints and do not indicate an
unfinished migration.

## Runtime configuration

The browser defaults to same-origin requests. Nuxt proxies them to
`DEER_FLOW_INTERNAL_GATEWAY_BASE_URL` (default `http://127.0.0.1:8001`). Optional
public base URLs bypass the corresponding same-origin proxy:

```bash
NUXT_PUBLIC_LANGGRAPH_BASE_URL=http://localhost:8001/api
NUXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8001/api
```

`DEER_FLOW_AUTH_DISABLED=1` is for isolated contract-test environments. Real
authentication must be exercised through the same-origin Nuxt/Gateway path.
`NUXT_PUBLIC_M0_TEST_PAGES=1` exposes internal visual fixtures only for tests;
the variable name is retained for compatibility with existing test configs.

Production routing, OIDC callback rules and rollback commands are maintained in
the [dual-frontend production guide](../docs/dual-frontend-production.md).
