# DeerFlow Vue frontend

This Nuxt 4 workspace is the Vue frontend that coexists with `../frontend` and
shares the Gateway. **Current migration cursor: M8 reusable contracts are complete;
M7 is fully closed with a Vue-owned 120/120 gate.** The chat workspace, artifacts, workspace
changes, sidecar, settings, browser, agents, channels, scheduled tasks, goal/mode,
and mobile surfaces are connected to the existing Gateway/data flow and aligned
to the current React frontend. Production Compose now has a React-default and
Vue-secondary hostname. The two historical shared-test exceptions are closed without weakening
Vue product behavior; public deployment activation still requires target-environment resources.
M8 freezes the private
`@deerflow/agent-core` root API, the minimal L2 source boundary and an isolated custom-backend
consumer; it does not publish npm or change production routing. Read
[the current status and next-step record](../frontend-vue-build-docs/10-current-status-and-next.md)
before continuing migration work; milestone evidence is historical, not the
current status source.

Use the Makefile as the only developer entrypoint:

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
make e2e-m7      # exact Vue-owned 25-file/120-test gate
make e2e-m7-local-list
make e2e-m7-local  # exact 1-spec/8-test sidebar/IME/a11y/H7-H8 gate
make e2e-m7-auth-list
make e2e-m7-auth   # exact 1-spec/7-test auth request/security gate
make e2e-m7-real-protocol  # replay-Gateway resume/gap/cancel browser gate
make e2e-m7-visual  # seven deterministic product-state screenshots
make asset-budget  # build + raw/gzip client asset budgets
make e2e-list  # collects the shared M1+ business contract; does not claim it passes
```

For another project's workspace/tarball setup, custom `RunProtocol` + `EventReducer` + message
adapter example, L2 seams and the complete L3 replacement checklist, read
[REUSE.md](REUSE.md). The package is private and has not been published to npm.

`make e2e-external` holds the browser-runtime WebSocket (G0-6) and the
controlled fixture-IdP OIDC dual callback (G0-7). They are kept out of
`make e2e-m0` because they need the backend browser extra and a different Gateway
toolset, and CI drives them through the manual `external-gates` job in
[frontend-vue-verify.yml](../.github/workflows/frontend-vue-verify.yml).
If a VPN or system proxy is enabled, local fixture traffic must bypass it:

```bash
NO_PROXY=127.0.0.1,localhost make e2e-external
```

This is a current environment requirement, not yet a guarantee enforced by the
Makefile.

The React test host must be installed before this workspace because framework-neutral shared
specs and the Vue runner intentionally use the same physical `@playwright/test` instance.
Framework-specific Vue behavior is selected by full path from the Vue inventory; it is not
forced through React DOM or transition contracts:

```bash
python3 scripts/pnpm.py install --frozen-lockfile
python3 scripts/pnpm.py --dir frontend-vue install --frozen-lockfile
```

## Migration ledgers (M1)

`baseline/` holds machine-generated ledgers describing how `../frontend/src/core`
maps into `app/core/`. They are regenerated from git objects, never hand-edited:

```bash
make baseline-refresh   # rebuild; needs a full clone, submit the diff for review
make baseline-check     # fail if the checked-in ledgers are stale
make land-copied        # copy the COPIED set into app/core byte for byte
make land-retyped       # apply the declared retypes into app/core
make codemod-tests      # regenerate tests/unit/core from the rstest sources
make migration-check    # baseline-check + codemod-check + land-retyped-check
make i18n-check         # dictionary health; also runs inside `make verify`
make i18n-diff          # key drift against baseline/i18n-keys.json
make i18n-unused        # keys no code references (report only until M4b)
```

The i18n baseline is deliberately taken while the dictionaries are still
byte-faithful to upstream: once component rewrites start, "which key did this
rewrite drop?" is unanswerable without it. Deleting a key from _both_ locales
stays type-correct — only the baseline notices.

`COPIED` files are byte-identical to upstream and guarded by SHA-256; `RETYPED`
files are ours — they carry the six-part header, get formatted and linted, and
their every difference from upstream is declared in `scripts/land-retyped.mjs`.
`make land-retyped-check` fails if a landed `RETYPED` file was hand-edited, the
same contract `codemod-check` enforces for generated tests.

The ledgers are anchored to the **frozen baseline commit**, pinned as `BASELINE` in
the Makefile — never `HEAD`. `HEAD` self-invalidates: the ledgers record the commit
they were built from, so committing them moves `HEAD` and makes `baseline-check`
stale on the spot. Changing baselines is an explicit edit plus a reviewed diff.

`make verify` deliberately does **not** run `baseline-check` or `codemod-check`:
ordinary CI must not depend on whether history objects are present. What CI does
enforce is:

- `tests/guards/core-provenance.test.ts` — every file under `app/core/` must appear
  in [app/core/PROVENANCE.md](app/core/PROVENANCE.md), and anything classified
  `COPIED` must match `baseline/core-sha256.json` byte for byte. If a `COPIED` file
  needs an edit, downgrade it to `RETYPED`/`ADAPTED` with a reason; do not refresh
  the baseline to make the guard green.
- `make collected-check` — vitest only reports the tests it collected, so a suite
  that quietly stops collecting a file still passes. This compares the collected
  set against `baseline/core-test-manifest.json`, including which project each test
  ran in, and fails if they differ in either direction.
- `make typecheck` — a budget over `baseline/typecheck-known.json` rather than raw
  `vue-tsc`. Landing `COPIED` before `RETYPED` necessarily leaves known
  missing-module errors; the budget fails on **one more or one fewer**, so the list
  must shrink explicitly as each batch lands. It must reach zero by the end of M1.
  `make typecheck-raw` shows the unfiltered output.

`COPIED` files are excluded from prettier and eslint — measured, not assumed:
prettier 3.9.6 wants to reformat 7 of them (upstream runs 3.8.1) and eslint reports
5 problems across 4. One `make format` would breach the byte-identity guard. Only
that class is excluded; files we write under `app/core/` stay fully checked, and a
file downgraded out of `COPIED` is re-checked automatically.

`NUXT_PUBLIC_AUTH_DISABLED=1` is limited to mock tests.
`NUXT_PUBLIC_M0_TEST_PAGES=1` exposes the isolated `/__m0/*` visual and
splitpanes fixtures; they return 404 in normal production configuration.

## Current verification boundary

The current checkout passes `make verify` with 108 Vitest files / 1095 tests,
`make migration-check`, M4a 4/4, chunked SSE 3/3, M4b 66/66, M5 27/27,
real-Gateway artifact 1/1, replay-Gateway resume/heartbeat/cancel/gap 1/1,
real-backend 3/3 and the asset hard budgets. The exact Vue M7 inventory is
25 files / 120 tests and passed **120/120 in three consecutive full runs**.

The historical 118/120 exceptions are closed structurally. Vue owns the protocol-complete
batched-stream and native splitpanes panel specs; framework-neutral React specs remain shared.
The product no longer delays artifact auto-open for a listener, injects React separator DOM,
duplicates splitpanes keyboard/ARIA, or maps wire chunks again inside UI components. Production
still requires `Content-Location` plus terminal `end` and therefore remains fail closed.

Public DNS/TLS/outer-proxy/real-IdP behavior is **BLOCKED/UNRUN** because this checkout and
machine contain no real Vue public hostname or target endpoint. A local real MiniMax Gateway
create/stream completed successfully, but it does not prove a public target. React remains the
default production frontend; Vue remains secondary-hostname only.

For exact commands, failure causes, the M4b/M5/M6 exit gates, and the ordered
task plan, use
[10-current-status-and-next.md](../frontend-vue-build-docs/10-current-status-and-next.md) and
[the final M7 evidence](../frontend-vue-build-docs/evidence/m7-vue-gate-final-closure.md).
Dual-frontend operations and rollback are documented in
[dual-frontend-production.md](../docs/dual-frontend-production.md); DNS/TLS and
target-environment validation remains mandatory before publicly activating Vue. The
[M0 verification record](../frontend-vue-build-docs/evidence/m0-verification.md)
is retained as historical milestone evidence only.
