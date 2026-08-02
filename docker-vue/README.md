# DeerFlow Vue Frontend

`docker-vue/` is a parallel Vue/Nuxt preview stack. It does not replace the
existing `docker/` stack or its nginx entrypoint; it attaches one Nuxt/Nitro
container to the already-running DeerFlow Docker network and lets Nitro proxy
same-origin API calls to the existing Gateway.

Start the existing DeerFlow stack first, then run:

```bash
docker compose -f docker-vue/docker-compose.yaml up -d --build
```

Use `DEER_FLOW_NETWORK=deer-flow-dev_deer-flow-dev` when attaching to the dev Docker stack.
The Vue frontend is exposed on `http://localhost:2027` by default and proxies API requests to the existing Gateway.

For Vue development with hot reload, use the dev compose file instead:

```bash
DEER_FLOW_NETWORK=deer-flow-dev_deer-flow-dev docker compose -f docker-vue/docker-compose.dev.yaml up -d --build
```

The dev container is exposed on `http://localhost:${VUE_DEV_PORT:-2028}` and runs
`nuxt dev` against bind-mounted Vue source files. The production compose file
continues to validate the built Nitro output used for Docker runtime signoff.

## Proxy parity

- Browser entry: `http://localhost:${VUE_PORT:-2027}`.
- Container service: `frontend-vue` runs Nuxt/Nitro on port `3000`.
- Nitro runtime: `NITRO_HOST=0.0.0.0`, `NITRO_PORT=3000`.
- Runtime healthcheck: `frontend-vue/Dockerfile` checks `http://127.0.0.1:${NITRO_PORT}/login`
  inside the container, proving Nitro is listening without requiring Gateway auth or a live
  backend response.
- Gateway target: `NUXT_GATEWAY_URL=${VUE_GATEWAY_URL:-http://gateway:8001}` is passed both
  as a Docker build argument and as a runtime environment variable, because Nuxt/Nitro
  route rules bake the proxy target into the production server bundle.
- `/api/langgraph/**` is rewritten by Nuxt route rules to `${NUXT_GATEWAY_URL}/api/**`, matching the existing nginx rewrite from `/api/langgraph/*` to Gateway `/api/*`.
- `/api/**` is proxied to `${NUXT_GATEWAY_URL}/api/**` so auth, memory, MCP, skills, agents, scheduled tasks, uploads, artifacts, and Gateway custom routes stay same-origin from the browser.
- Browser auth POSTs from `localhost:2027` or `localhost:2028` are split-origin
  from the main `localhost:2026` stack. Set `GATEWAY_CORS_ORIGINS` on Gateway to
  include the Vue origin when doing live browser login against the standalone Vue
  port.

The contract is covered by `frontend-vue/tests/contract/docker-vue-parity.test.ts`.
