# DeerFlow Vue frontend

This Nuxt 4 workspace is the Vue frontend that coexists with `../frontend` and
shares the Gateway. **Current migration cursor: M-1 through M5 are complete;
M6 is next but has not started.** The chat workspace, artifacts, workspace
changes, and sidecar child conversations are connected to the Gateway and aligned
to the current React frontend. Remaining M6+ product surfaces and production
cutover remain milestone-gated. Read
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
make e2e-m0
make e2e-m4a
make e2e-m4a-stream
make e2e-m4b
make e2e-m5-list
make e2e-m5
make e2e-m5-real-backend
make e2e-list  # collects the shared M1+ business contract; does not claim it passes
```

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

The React test host must be installed before this workspace because the shared specs and this runner intentionally use the same physical `@playwright/test` instance:

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

The 2026-08-13 checkout passed `make verify` (102 files / 1064 tests),
`make migration-check`, `make consumer-check`, `make e2e-m0` (14/14),
`make e2e-m4a` (4/4), and `make e2e-m4a-stream` (3/3). The latest M4b-checkout
external evidence is WebSocket 1/1 and OIDC 1/1; it was not rerun after M5. The exact M4b suite passed 66/66,
the exact M5 suite passed 27/27, the M5 replay-Gateway artifact gate passed 1/1,
and the corrected real-backend suite passed 3/3.

Those results do **not** mean every later-milestone shared business contract passes.
`make e2e-list` collects 25 files / 120 tests but does not execute them; M6 through
M8 and default production ingress remain outside this evidence. M5's
`artifact-batched-stream` gate uses a local protocol-correct equivalent because
the shared React fixture omits the real Gateway's required `Content-Location`
and terminal `end`; production remains fail closed.

For exact commands, failure causes, the M4b/M5 exit gates, and the ordered
task plan, use
[10-current-status-and-next.md](../frontend-vue-build-docs/10-current-status-and-next.md).
Dual-frontend production readiness — two hostnames, DNS/TLS, trusted-proxy
scrubbing — remains M7. The
[M0 verification record](../frontend-vue-build-docs/evidence/m0-verification.md)
is retained as historical milestone evidence only.
