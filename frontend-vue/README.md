# DeerFlow Vue frontend (M0)

This Nuxt 4 workspace is the Vue frontend that coexists with `../frontend` and shares the Gateway. M0 deliberately contains only the engineering foundation: marketing placeholders, an auth-gated workspace shell, a real `@deerflow/agent-core` workspace package boundary, production proxy/security behavior, and test infrastructure.

Use the Makefile as the only developer entrypoint:

```bash
make install
make dev       # http://localhost:3100
make verify
make e2e-m0
make e2e-list  # collects the shared M1+ business contract; does not claim it passes
```

`make e2e-external` holds the two gates the repository cannot run on its own — the
browser-runtime WebSocket (G0-6) and the controlled-IdP OIDC dual callback (G0-7).
They are kept out of `make e2e-m0` so the runnable suite stays honest, and CI drives
them through the manual `external-gates` job in
[frontend-vue-verify.yml](../.github/workflows/frontend-vue-verify.yml).

The React test host must be installed before this workspace because the shared specs and this runner intentionally use the same physical `@playwright/test` instance:

```bash
python3 scripts/pnpm.py install --frozen-lockfile
python3 scripts/pnpm.py --dir frontend-vue install --frozen-lockfile
```

`NUXT_PUBLIC_AUTH_DISABLED=1` is limited to M0/mock tests. `NUXT_PUBLIC_M0_TEST_PAGES=1` exposes the isolated `/__m0/*` visual and splitpanes fixtures; they return 404 in normal production configuration.

All ten M0 gates pass and every one is reproducible from this repository:
`make e2e-m0` covers the infrastructure suite, `make e2e-external` covers the
browser WebSocket (G0-6) and the OIDC round trip (G0-7) against the in-repo
fixture IdP. Dual-frontend production readiness — two hostnames, DNS/TLS,
trusted-proxy scrubbing — remains M7. See the
[M0 verification record](../frontend-vue-build-docs/evidence/m0-verification.md).
