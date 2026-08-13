# M7 phase 2 evidence: input, auth, protocol, and invariant review

> Snapshot: 2026-08-13, starting from clean checkout `ec2c1b11`. This records a
> coherent **in-progress M7** phase. It is not an M7 completion claim, and M8 was
> not entered.

## Delivered in this phase

- Added exact Vue-owned browser inventories instead of changing the shared React
  suite: `m7-local` is 1 spec / 8 tests and `m7-auth` is 1 spec / 5 tests.
- Closed the sidebar/mobile/keyboard contract: desktop cookie persistence,
  Cmd/Ctrl+B ownership, mobile modal focus trap/Escape/backdrop/focus restore,
  route-close behavior, global focus-visible and explicit ARIA state.
- Applied IME protection to the main composer, sidecar and both HumanInputCard
  text entry paths. Composition state, `event.isComposing` and Safari keyCode 229
  all fail closed; Shift+Enter, skill arrows and prompt history remain owned by
  their inputs.
- Restored H7/H8 at the product page: the context-window gauge remains mounted
  when usage is unavailable, retains a value only for the same thread, rejects a
  response whose `thread_id` differs, and refreshes after a run through the
  existing thread token-usage API.
- Added request-level auth evidence for local login/register/setup/change-password,
  remember-email-only storage, safe redirect and 401-versus-unavailable handling.
- Reused the existing replay-Gateway browser state machine for create POST,
  `Content-Location`, heartbeat, GET resume with `Last-Event-ID`, gap, browser
  Cookie/CSRF cancel and durable terminal status. No second run/stream state
  machine or product mock path was added.

## Exact inventories and current colors

| Gate | Exact inventory | Result |
| --- | ---: | ---: |
| shared M7 | 25 specs / 120 tests | **119 passed / 1 failed** |
| Vue sidebar/IME/a11y/H7-H8 | 1 spec / 8 tests | **8/8 passed** |
| Vue auth request/security | 1 spec / 7 tests | **7/7 passed** |
| replay-Gateway resume/gap/cancel | 1 spec / 1 test | **1/1 passed** |
| shared auth recovery | 1 spec / 2 tests | **2/2 passed** |
| real-backend replay | 3 specs / 3 tests | **3/3 passed** |
| external browser runtime | WS 1 + OIDC 1 | **1/1 + 1/1 passed** |

The shared red item remains
`frontend/tests/e2e/artifact-batched-stream.spec.ts` (“assembles streamed
write-file argument deltas in the artifact preview”). Its fixture omits both the
Gateway-required `Content-Location` and terminal `end`. Production stays
fail-closed; the shared spec was not edited, excluded or weakened. The protocol-
correct Vue M5 equivalent remains green. The EX table is still exactly EX-01
landing and EX-02 docs, with no selector exemption.

## Auth evidence boundary

The 7-test local auth inventory proves request shape and browser storage behavior:
login is form-urlencoded; register/initialize are JSON; change-password uses the
actual field names and echoes the readable CSRF cookie; secrets/tokens are not
stored; an absolute hostile redirect falls back to `/workspace`; and 401 differs
from Gateway unavailability. The shared setup-recovery suite remains 2/2.

The current Gateway has no refresh endpoint, so no frontend refresh field or
state was invented. Logout/session helpers are source- and unit-covered but do
not have a new real-cookie browser case in this phase. `Secure`, `HttpOnly`,
`SameSite`, public TLS and trusted-proxy behavior cannot be promoted from a
hermetic localhost fixture to deployed production proof.

## A-N current-checkout review

This is a group-level re-audit linked to executable evidence, not a replacement
for the individual rows in `05-invariants.md`.

| Group | Current evidence and conclusion |
| --- | --- |
| A streaming/reconnect | Current unit/verify coverage plus real replay-Gateway resume/gap/cancel 1/1 preserve A1-A8. |
| B message rendering | All shared message/reasoning/citation cases in the 119 green tests remain green. |
| C history/order | Shared history, pagination, pin and init-order cases are green; real-backend multi-run ordering is green. |
| D artifacts | M5 protocol-correct coverage and shared artifact cases are green except the one malformed shared fixture. D8 still has no CodeMirror dependency/runtime mount; the pre-full-content prohibition holds, but editor parity/performance remains incomplete. |
| E composer | Shared chat plus the 8-test local keyboard inventory cover draft/send, slash ownership, Shift+Enter and prompt history. |
| F human input | Core/DOM tests and component-level IME coverage are green; hidden-response routing continues through the single stream path. |
| G subtask | Shared subtask and unit lifecycle/usage/replay coverage remain green. |
| H layout | H1-H6 remain green in shared resize/sidecar cases. H7/H8 now have page wiring and a browser route-switch contract; the unavailable placeholder is never unmounted. |
| I browser view | External real-browser WS binary-frame 1/1 is green; existing M6 REST/WS implementation was unchanged. Public dual-host Origin/Upgrade is not proven. |
| J auth/storage | Local 7/7, shared recovery 2/2 and fixture OIDC 1/1 are green. J5/J6 dual-host concurrent OIDC and deployed HTTPS-cookie semantics remain blocking. |
| K routes/other | Frontend-owned K1-K5 stay covered by unit/shared gates. K6 is explicitly backend-only and no fake frontend assertion was added. |
| L SSE hardening | The existing protocol state machine plus real replay-Gateway 1/1 cover resume/gap/cancel and L10-L16. The malformed shared fixture and missing production Vue ingress keep the group from an unconditional release conclusion. |
| M Vue traps | `verify`, DOM tests and the new reactive route/context usage path cover the currently consumed Vue semantics; no non-reactive provide or post-await inject path was introduced. |
| N upload/notification/voice/i18n | Upload/shared notification cases, voice unit fallback and verify's two 751-key dictionaries are green. Real browser permission prompts and SSR first-frame locale behavior remain runtime/visual unknowns. |

## Production readiness status

| Requirement | Status at this snapshot |
| --- | --- |
| two independent React/Vue hostnames | **missing** |
| same-origin API/SSE/WS to one Gateway | existing React ingress only; Vue production ingress **missing** |
| explicit loopback published bind / Gateway 8001 not published | existing compose tests and topology retain this, but no new Vue port/profile exists |
| Host / forwarded Host+Proto / trusted proxy | existing single ingress code only; dual-host acceptance **missing** |
| OIDC return-to-entry | hermetic single Vue flow 1/1; two-host concurrent same-provider state **missing** |
| WS Upgrade / Origin / Cookie | real browser Vue fixture 1/1; dual-host production path **missing** |
| SSE buffering/timeout/compression and langgraph rewrite | existing React nginx path only; Vue dual-host path **missing** |
| 20 MiB / 100 MiB body-limit layering | existing ingress/backend tests only; Vue dual-host path **missing** |
| HTTPS Cookie / CSRF | CSRF browser request proven locally; deployed TLS/cookie attributes **unverified** |
| non-root image, `/health`, SIGTERM | `make container-smoke` **passed** |
| production start/stop/rollback and default switch | development modes exist; production rollout/rollback **missing** |

No Docker/nginx/compose or `.env` file was changed in this phase.

## Rejected performance experiment

The current Nuxt 4.5.1 / Vite 8.2.0 build uses Rolldown 1.2.2. A client-only
`rolldownOptions.output.codeSplitting` experiment produced stable groups and an
asset script. Measured examples were `vendor-vue` 151,387 raw / 51,596 gzip,
`vendor-ui` 128,449 / 46,375, and the Markdown group 12,170,242 / 2,400,539
across 46 chunks; CodeMirror is not installed. The split build then failed the
full browser suite systemically with HTTP 500 and `n is not a function`,
consistent with circular execution across the generated groups. The entire
experiment and its gate were removed rather than shipping a flaky split or
raising the warning limit. The default build remains functional but reports
four chunks above 500 kB (about 508, 622, 626 and 780 kB raw). Performance is an
open M7 exit item.

## Commands and measured results

- `make handoff-check`: clean start at `ec2c1b11`; prior evidence treated as a claim.
- `make verify`: **107 files / 1083 tests**, 59 migrated files / 560 tests;
  lint has zero errors, format/type/unit/collection/i18n/OpenAPI/build passed.
- `make migration-check`: passed; 58 generated tests and 24 `RETYPED` rewrites consistent.
- `make e2e-m7-list`: exact **25 files / 120 tests**.
- first experimental split `make e2e-m7`: stopped after 19 systemic HTTP-500 failures;
  root cause was unsafe circular chunk execution, and the split was fully reverted.
- final default-build `make e2e-m7`: **119/120**, only the known protocol-incomplete fixture red.
- `make e2e-m7-local`: **8/8**; `make e2e-m7-auth`: **7/7**.
- `make e2e-m7-real-protocol`: **1/1**.
- `make e2e-auth`: **2/2**; `make e2e-real-backend`: **3/3**.
- `make e2e-external`: WebSocket **1/1**, OIDC **1/1**.
- `make container-smoke`: passed; build still emitted the open chunk-size warning.

## Remaining M7 blockers

1. Resolve or formally govern the one protocol-incomplete shared fixture without
   weakening the production protocol or shrinking 25/120.
2. Build and test the dual-host nginx/compose production profile, concurrent
   OIDC state isolation, deployed HTTPS/cookie behavior and rollout/rollback.
3. Implement the four named effect components and the seven-state screenshot gate.
4. Establish a runtime-safe stable client split and raw/gzip asset budget.

M8 remains out of scope: no public L2 package contract, external-consumer guide,
or final reuse consolidation was created.
