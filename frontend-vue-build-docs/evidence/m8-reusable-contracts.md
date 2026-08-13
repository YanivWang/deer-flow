# M8 reusable contracts closure evidence

> Historical snapshot: 2026-08-13. This file records the checkout and commands used to close M8.
> Future runs must use current code and `make handoff-check`; they must not treat these results as
> permanently current.

## Conclusion

M8 is **GO** for the repository-owned L1/L2 reuse contract. The scope is deliberately narrower than
a product extraction:

- `@deerflow/agent-core` has one frozen root API, contract version `m8`, a guarded tarball surface and
  a runnable isolated consumer;
- the final L2 source boundary is Markdown, Button and Button's `app/lib/utils.ts` dependency;
- chat/reasoning/tool/composer/human-input remain DeerFlow host adapters, while artifacts and sidecar
  document the one-way L3 extension direction;
- the complete DeerFlow-specific replacement list is recorded in `frontend-vue/REUSE.md`;
- no npm publish, default production cutover, public deployment, new feature, upstream sync, push or
  pull request is part of this conclusion. React remains the default production frontend.

The last recorded full M7 shared run remains 118/120 with its two governed exceptions. M8 did not
modify those shared fixtures/specs or weaken product behavior. The focused M5 run in this window was
27/27, but that does not retroactively rewrite the M7 historical result.

## Cold-start baseline

From repository root:

```text
make handoff-check
git status --short
git log -5 --oneline
```

The worktree was clean and HEAD was `b2c78cf7 feat(frontend-vue): complete M7 readiness`. The handoff
reported the last full shared result as 118/120 and the last M5 result as 26/27. The implementation
was then derived from the current checkout, module guides and current source/import graph.

The source audit found:

- L1 already separated under `packages/agent-core/`, with no Vue/Nuxt/DeerFlow product imports;
- the independently reusable L2 dependency closure consists of 17 files: Markdown core/components,
  Button and `app/lib/utils.ts`;
- the current chat components import DeerFlow message types, stores, endpoints and artifact/sidecar/
  skill/upload/model/config modules. Packaging them as a generic UI kit would preserve hidden product
  coupling, so M8 did not create `packages/agent-ui-kit`;
- 52 maintained source files lacked a complete six-part header. M8 added headers and a guard without
  changing their runtime logic; 84 provenance-owned `COPIED` files remain hash-governed and are skipped.

## Frozen L1 public API

The package is private, exposes only `.` and packs only `src`. The exact export snapshot is enforced by
`packages/agent-core/tests/architecture.test.ts`.

- Contract/errors: `AGENT_CORE_CONTRACT_VERSION`, `AgentErrorKind`, `AgentStreamError`,
  `isRetryableKind`, `toAgentStreamError`.
- Messages: `AgentContentPart`, `AgentMessage`, `AgentMessageContent`, `AgentMessageRole`,
  `AgentToolCall`, `createAgentMessage`.
- SSE: `SseEvent`, `SseFrame`, `FrameReaderOptions`, `readSseFrames`, `flushSseRemainder`,
  `readNextSseFrame`, `parseSseFrame`.
- Session/protocol: `BackoffOptions`, `computeBackoffDelay`, `DEFAULT_BACKOFF`, `CancelResult`,
  `ClassifyEvent`, `InspectedRun`, `OpenedStream`, `RunOutcome`, `RunProtocol`, `StreamRequest`,
  `StreamSignal`, `RunSessionState`, `SessionOutput`, `RunSession`, `RunSessionOptions`,
  `createRunSession`.
- Reducer/store: `AgentSnapshot`, `EventReducer`, `ReduceAction`, `AgentExternalStore`,
  `applyReduceActions`, `createAgentExternalStore`.
- Watchdog: `WatchdogInput`, `WatchdogOptions`, `WatchdogVerdict`, `DEFAULT_WATCHDOG`,
  `evaluateWatchdog`.

Adding, removing or deep-importing a symbol is a contract change. The package ships TypeScript source
for bundler-based consumers; it has no runtime framework dependency and has not been published.

## Runnable consumer

`frontend-vue/examples/agent-core-consumer/` is checked in rather than generated inside the verifier.
It models a non-LangGraph backend with:

- a custom wire-message adapter that preserves unknown metadata;
- a `/sessions` `RunProtocol` implementing create/resume/cancel/inspect;
- an event classifier and pure reducer;
- a fake fetch runtime that exercises create, heartbeat, event reduction and final store snapshot.

`scripts/consumer-check.mjs` packs the real package, copies the example to a system temporary directory,
performs a clean install, typechecks, bundles with esbuild and runs the result. This prevents accidental
resolution through the monorepo's parent `node_modules`.

## Frozen L2 and extension direction

The exact L2 files are guarded in `tests/architecture.test.ts`:

```text
app/core/markdown/**
app/components/markdown/**
app/components/ui/button/**
app/lib/utils.ts
```

They carry final `L2` headers and cannot import DeerFlow protocol/API/artifact/auth/channel/config/model/
settings/sidecar/skill/task/thread/upload/store/workspace modules. Existing Markdown DOM, streaming,
error fallback, Shiki and Mermaid tests plus the Button unit contract own their behavior.

The extension direction is one way:

```text
ArtifactPanel (L3) -> StreamMarkdown (L2)
MessageList (L3 host adapter) -> AgentChat -> artifact/sidecar product state
```

No L2 file imports artifacts or sidecar. No second message/run/stream state machine was introduced.

## L3 replacement list

A consumer using another backend/product must replace all applicable groups, not just transport:

1. `app/core/agent-deerflow/**`, DeerFlow message wire types and stream-mode requests;
2. Gateway REST, auth, runtime config, Nitro proxy/guard and login/setup/callback routes;
3. `useThreadStream`, history/context/coalescing, thread core/store/routes;
4. artifacts, sidecar, workspace changes, browser, settings, agents, skills, models, integrations/MCP,
   memory, channels, scheduled tasks, goal/mode, notifications, uploads and voice input;
5. chat host adapters, workspace panel/sidebar/layout/pages and product feature stores/composables;
6. Nuxt URLs, Nitro/nginx/Compose hostname routing, OIDC, cookies/CSRF, WebSocket and SSE deployment
   wiring.

The precise paths, current component seams and upgrade guidance live in `frontend-vue/REUSE.md`.

## Verification results

All commands below were run serially from the current checkout:

| Command | Result | Evidence boundary |
| --- | --- | --- |
| `make verify` | passed: 108 files / 1092 tests; 59 migrated files / 560 tests; lint 0 errors/35 existing warnings; format, types, unit, provenance, i18n, OpenAPI, headers and Nuxt build passed | Default large-chunk, Tailwind sourcemap and H3 unused-import warnings remain |
| `make migration-check` | passed: provenance/test manifest; 58 codemod tests; 24 `RETYPED` | Ledger consistency only |
| agent-core focused Vitest | 7 files / 93 tests passed | L1 package behavior and architecture |
| focused architecture Vitest | 2 files / 12 tests passed | Exact L1 exports/manifest and exact L2 imports/extension direction |
| `make consumer-check` | passed: real pack, isolated clean install, typecheck, esbuild and `consumer session OK` | Non-LangGraph custom backend example; no npm registry publication |
| `make e2e-m4a` | 4/4 passed | send/stream/stop/reload ordering |
| `make e2e-m4a-stream` | 3/3 passed | chunked SSE, heartbeat, resume cursor/gap |
| `make e2e-m4b` | 11 files / 66 tests passed | General Agent UI contract |
| `make e2e-m5` | 6 files / 27 tests passed | Artifact/changes/sidecar; current focused result only |
| `make e2e-m5-real-backend` | 1/1 passed | replay Gateway `write_file` to artifact panel |
| `make e2e-m7-real-protocol` | 1/1 passed | create/resume/cancel/gap/heartbeat through replay Gateway |
| `make e2e-real-backend` | 3/3 passed | auth-disabled, multi-run history and replay render |

The first sandboxed `make verify` attempt could not bind its local fake-upstream sockets (`EPERM`):
107 files / 1076 tests passed and the 12 socket-dependent tests timed out. Re-running the exact command
with loopback permission passed completely, so this was an execution-environment block, not a product
failure. The first isolated consumer attempt hit sandbox DNS, and the first permitted clean-install run
then exposed strict TypeScript issues in the example. Those annotations/header normalizations were fixed;
the final clean install, typecheck, bundle and runtime passed.

## Deliberately unrun or unchanged

- `make e2e-m7` was not rerun: M8 changed contract metadata, docs, test guards, examples and file headers,
  not product runtime logic. Its most recent full result remains 118/120 and both governed exceptions
  remain visible.
- `make e2e-m7-local`, `make e2e-m7-auth`, `make e2e-auth`, `make e2e-external`,
  `make e2e-m7-visual`, `make asset-budget`, container smoke and dual-production structural checks were
  not rerun because M8 did not change their interaction/auth/visual/dependency/deployment surfaces.
- public DNS/TLS/outer proxy, real IdP/provider credentials, default Vue cutover and real public deployment
  remain unrun target-environment work. They are outside M8 and cannot be inferred from repository gates.
