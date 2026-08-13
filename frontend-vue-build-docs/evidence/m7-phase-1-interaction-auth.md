# M7 phase 1 evidence: interaction, auth, and exact inventory

> Snapshot: 2026-08-13, starting from checkout `d22fb5a3` and covering the M7 phase-1 change set recorded here.
> This is an **in-progress M7 record**, not an M7 completion claim. M8 was not entered.

## Cold-start facts

- `make handoff-check`, `git status --short`, both diffs, and `git log -3 --oneline` confirmed a clean starting tree at `d22fb5a3` (`feat(frontend-vue): complete M6 remaining L3 surfaces`).
- The old `test-results/contracts/.last-run.json` was written at 17:57 before M6 implementation. Its M6-area failures are historical; it is neither the final M6 gate nor proof that the current 120-test suite failed.
- `make e2e-list` and the new exact `make e2e-m7-list` both collect **25 files / 120 tests**. Collection is not a pass result.

## Exact source and target inventory

| Capability                | React source of truth                                                                     | Vue target / evidence                                                        | Phase result                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| H1-H6 panel orchestration | `frontend/src/components/workspace/chats/chat-box.tsx`, artifact resize and sidecar specs | `frontend-vue/app/components/workspace/WorkspacePanels.vue`, `AgentChat.vue` | Implemented with one `splitpanes` group and frozen 5-test resize contract                                                                  |
| Sidebar / mobile          | `frontend/src/components/ui/sidebar.tsx`, `workspace-sidebar.tsx`                         | `frontend-vue/app/components/workspace/ThreadSidebar.vue`                    | Cookie, Cmd/Ctrl+B, mobile dialog/focus loop and focus restore implemented; dedicated M7 E2E still missing                                 |
| Composer IME              | `frontend/src/lib/ime.ts`, `input-box.tsx`                                                | `app/core/input/ime.ts`, `ChatComposer.vue`                                  | Three IME signals implemented and unit-tested                                                                                              |
| Login / setup / SSO       | `frontend/src/app/(auth)/login/page.tsx`, `setup/page.tsx`; Gateway auth routes/types     | Vue `login.vue`, `setup.vue`, auth middleware/session helper                 | Real forms, setup recovery, remember-email-only, safe next path, SSO entry, CSRF change-password and fail-closed session probe implemented |
| Shared contracts          | `frontend/tests/e2e/*.spec.ts` excluding EX-01/EX-02                                      | `tests/m7-inventory.json`, `scripts/m7-inventory.mjs`                        | Exact list frozen; current run 119/120                                                                                                     |
| Auth contracts            | `frontend/tests/e2e-auth/auth-setup-recovery.spec.ts`                                     | `playwright.auth.config.ts`                                                  | 2/2 passed                                                                                                                                 |
| Real Gateway              | `frontend/tests/e2e-real-backend/*.spec.ts`                                               | `playwright.real-backend.config.ts`                                          | 3/3 passed; new real resume/gap/cancel browser cases not added                                                                             |
| WS / OIDC                 | Gateway WS/auth routes and M0 external fixtures                                           | `playwright.m0-external.config.ts`                                           | WS 1/1 and single-entry OIDC 1/1 passed; dual-host concurrent OIDC remains open                                                            |
| Production ingress        | `docker/nginx/*.conf`, compose, Gateway trusted-proxy/cookie code                         | no Vue dual-host production profile yet                                      | Blocking M7 completion                                                                                                                     |
| Visual / assets           | React aurora/flicker/shine/confetti components and visual plan                            | auth grid only in this phase                                                 | Incomplete; seven-state screenshot gate and three effects remain                                                                           |
| Performance               | M7 manual-chunk table                                                                     | current Nuxt build                                                           | Incomplete; build still warns about chunks over 500 kB and no stable asset-stat script exists                                              |

## H-group status

- **H1:** one shared main/right `splitpanes` group; artifacts, sidecar, and browser still select content through `AgentChat`'s existing single business state path.
- **H2:** panes remain mounted; open/close drives `:size` between zero and the last positive size.
- **H3/H4:** width/flex transition is on `.splitpanes__pane`; mousedown/resize disables it. The shared test proves `flex-grow` starts on open and is absent during drag.
- **H5:** panel content is pinned to the final `cqw` width and clipped during the 280 ms switch; the sidecar no-animated-scroll contract remains green.
- **H6:** `resize` only remembers a positive value; only pointer-backed `resized` mirrors collapse to the owning artifacts/sidecar/browser state. Reverse-before-release remains open.
- **H7/H8:** no code was changed in the existing token-usage path in this phase; full A-N re-audit is still required before M7 closure.

## Shared 25-file color

| Spec                                  | Tests | Current color / ownership                         |
| ------------------------------------- | ----: | ------------------------------------------------- |
| `agent-chat.spec.ts`                  |     6 | 6 green, M4b/M6                                   |
| `agents-feature-disabled.spec.ts`     |     2 | 2 green, M6                                       |
| `artifact-batched-stream.spec.ts`     |     2 | **1 green / 1 red**, M5 protocol-fixture mismatch |
| `artifact-panel-resize.spec.ts`       |     5 | 5 green, M7 H1-H6                                 |
| `artifact-preview.spec.ts`            |    10 | 10 green, M5                                      |
| `artifact-stream-state.spec.ts`       |     1 | green, M5                                         |
| `branch-thread.spec.ts`               |     1 | green, M4b                                        |
| `browser-feature.spec.ts`             |     2 | 2 green, M6                                       |
| `channels.spec.ts`                    |     5 | 5 green, M6                                       |
| `chat-thread-init-ordering.spec.ts`   |     1 | green, M4a                                        |
| `chat.spec.ts`                        |    28 | 28 green, M4b/M6                                  |
| `integrations.spec.ts`                |     3 | 3 green, M6                                       |
| `scheduled-tasks.spec.ts`             |     6 | 6 green, M6                                       |
| `settings-notification.spec.ts`       |     2 | 2 green, M6                                       |
| `sidebar.spec.ts`                     |     4 | 4 green, M4b/M6/M7 review                         |
| `sidecar-chat.spec.ts`                |     7 | 7 green, M5/M7 H5                                 |
| `streaming-reasoning-order.spec.ts`   |     2 | 2 green, M4b                                      |
| `subtask-card.spec.ts`                |     1 | green, M4b                                        |
| `thread-history-mermaid.spec.ts`      |     1 | green, M3/M4b                                     |
| `thread-history.spec.ts`              |    16 | 16 green, M4a/M4b                                 |
| `thread-list-infinite-scroll.spec.ts` |     3 | 3 green, M4b                                      |
| `thread-list-pin.spec.ts`             |     2 | 2 green, M4b                                      |
| `ui-polish-mobile.spec.ts`            |     3 | 3 green, M6/M7 review                             |
| `user-message-plain-text.spec.ts`     |     5 | 5 green, M3/M4b                                   |
| `workspace-changes.spec.ts`           |     2 | 2 green, M5                                       |

The one red test uses the shared React mock response without the Gateway-required `Content-Location` header and without a terminal `end`. Vue deliberately keeps the production run protocol fail-closed. The protocol-correct local equivalent in `tests/m5/artifact-batched-stream.spec.ts` passed 2/2, and the complete M5 gate passed 27/27. No shared spec was edited, deleted, or silently excluded.

The exemption registry remains exactly two entries: EX-01 `landing.spec.ts` and EX-02 `docs-localized-links.spec.ts`, both outside the workspace migration. There is no selector exemption.

## Production readiness inventory

| Gate                                                                  | Current status                                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Two independent public hostnames / symmetric same-origin API, SSE, WS | **missing**; compose/nginx still serves React only                                                     |
| SSE buffering / 600s timeout / body limits                            | present and backend-tested in existing nginx, but not exercised through a Vue dual-host ingress        |
| WS Upgrade / Origin / Cookie                                          | single Vue entry 1/1 passed; dual-host production ingress absent                                       |
| HTTPS cookie / trusted Host+Proto                                     | Gateway code/tests exist; no two-host deployed acceptance in this phase                                |
| OIDC return-to-entry                                                  | single Vue fixture flow 1/1 passed; concurrent same-provider state across two hostnames not run        |
| Non-root image / `/health` / SIGTERM                                  | Vue Dockerfile and container-smoke pre-exist; not rerun in this phase and not wired to default compose |
| Start / stop / rollback                                               | development `dev-vue`/`dev-dual` exists; production rollout and rollback instructions absent           |
| Stable performance chunks and asset statistics                        | missing; build warning over 500 kB remains                                                             |
| Seven visual states, mobile and dark mode                             | not run; M7 screenshot inventory absent                                                                |

## Commands and measured results

- `make e2e-list`: collected 25 files / 120 tests.
- First `make e2e`: sandbox `listen EPERM`; identical escalated run: **119 passed / 1 failed**.
- First post-splitpanes `make e2e-m5`: 21/27; five resize-selector/state regressions plus one duplicate `#artifacts`. After fixing library-element attributes/state and the duplicate ID, the isolated resize contract passed 5/5. A separate video-request wait timed out once; complete rerun passed **27/27**.
- First `make e2e-auth`: **0/2** because login/setup were placeholders. After the real auth surfaces and recovery path: **2/2**.
- First sandbox `make test`: provenance found two unregistered helpers; 12 fake-upstream cases hit loopback `EPERM`. After provenance registration and identical escalated rerun: **106 files / 1077 tests passed**.
- `make e2e-m7-list`: exact **25 files / 120 tests**.
- Final `make e2e-m7`: **119/120**, only the known protocol-incomplete shared fixture red.
- `make e2e-real-backend`: **3/3**.
- `make e2e-external`: WebSocket **1/1**, OIDC **1/1**.
- `make typecheck`: passed with empty budget. `make lint`: zero errors; existing plus new void-element warnings remain non-blocking.
- `make verify`: **106 files / 1077 tests**, migrated ledger **59 files / 560 tests**; lint (zero errors), format, types, unit, collection, i18n, OpenAPI and production build passed. The build still reports chunks over 500 kB, which is an open M7 performance gate.
- `make migration-check`: passed; frozen provenance/test manifest, 58 generated tests and 24 RETYPED rewrites are consistent.

## Explicit boundary

M7 remains in progress. Before it can close: resolve the shared fixture contract without weakening production, add dedicated sidebar/keyboard/focus E2E, finish visual effects and seven-state screenshots, add the planned real-backend resume/gap/cancel cases, build and test dual-host nginx/compose including concurrent OIDC, establish stable manual chunks and asset budgets, rerun container smoke and the complete A-N review. Real third-party IdPs/channels, public TLS/DNS, and long-running production behavior are not proven by hermetic fixtures.

M8 remains excluded: no L2 public package contract, external-consumer documentation, or final reuse consolidation was created.
