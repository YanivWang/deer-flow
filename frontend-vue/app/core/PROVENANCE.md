# Vue core provenance

This file is the source-of-truth ledger for `frontend-vue/app/core`.

## Current status

- React reference baseline: `b71a892b` (`frontend/src/core`).
- This checkout does **not** claim byte-identical or 100% React core parity.
- Every current Vue core file must be classified below. Adding a new core file
  requires adding its classification in the same change.
- The classification guard is
  `frontend-vue/tests/guards/core-provenance.test.ts`.

## Classification

`ADAPTED` means the Vue/Nuxt implementation preserves the product contract but
uses a framework-specific boundary. `DEMOCKED` means a mock/demo path was
removed or replaced with the real Gateway/artifact behavior. `DETYPED` means a
dependency-owned type surface was replaced with local types. `REWRITTEN` means
the current implementation is a Vue-owned rewrite and is not byte-identical
to the React reference. `ADDED` means the implementation has no direct React
core file equivalent.

| Vue core file | Classification | Current reason |
| --- | --- | --- |
| `about/content.ts` | REWRITTEN | Vue-owned About content and fallback handling |
| `api/agents/client.ts` | REWRITTEN | Gateway client used by Vue composables |
| `api/agents/types.ts` | DETYPED | Local agent contract types |
| `api/channels/client.ts` | REWRITTEN | Gateway channel client |
| `api/csrf.ts` | ADAPTED | Nuxt/browser CSRF boundary |
| `api/integrations/lark.ts` | REWRITTEN | Gateway-shaped Lark integration client |
| `api/mcp/client.ts` | REWRITTEN | Gateway MCP client |
| `api/memory/client.ts` | REWRITTEN | Gateway memory client |
| `api/scheduled-tasks/client.ts` | REWRITTEN | Gateway scheduler client |
| `api/skills/client.ts` | REWRITTEN | Gateway skills client |
| `api/stream/adapters/deerflow-gateway.ts` | ADDED | Gateway event adapter |
| `api/stream/canonical.ts` | ADDED | Vue stream canonical event model |
| `api/stream/client.ts` | ADDED | Handwritten fetch/SSE client |
| `api/stream/codec/deerflow-wire.ts` | ADDED | Gateway wire codec |
| `api/stream/engine.ts` | ADDED | Framework-neutral ThreadStreamEngine |
| `api/stream/gap-recovery.ts` | ADDED | Replay-gap recovery policy |
| `api/stream/reducer.ts` | ADDED | Vue stream state reducer |
| `api/stream/transport/fetch-sse.ts` | ADDED | Fetch-based SSE transport |
| `api/stream/transport/parse-sse-event.ts` | ADDED | SSE event parser |
| `api/stream/transport/sse-buffer.ts` | ADDED | Incremental SSE buffer |
| `api/stream/transport/sse-event.ts` | ADDED | SSE event contract |
| `api/stream/transport/stream-error.ts` | ADDED | Stream transport errors |
| `api/stream/view-model.ts` | ADDED | Vue stream view-model projection |
| `api/thread/client.ts` | REWRITTEN | Gateway thread client |
| `api/thread/types.ts` | DETYPED | Local thread contract types |
| `api/thread/utils.ts` | REWRITTEN | Vue thread utilities |
| `artifacts/loader.ts` | DEMOCKED | Real artifact loading and fallback behavior |
| `artifacts/preview.ts` | REWRITTEN | Vue artifact preview paths |
| `artifacts/utils.ts` | DEMOCKED | Real artifact path and resource handling |
| `auth/client.ts` | ADAPTED | Browser auth/session boundary |
| `auth/proxy-policy.ts` | ADDED | Explicit LangGraph proxy header/path/CSRF policy |
| `i18n/index.ts` | ADAPTED | Nuxt i18n plugin state boundary |
| `i18n/locales/en-US.ts` | DETYPED | Full React locale data adapted to Vue icon components |
| `i18n/locales/types.ts` | DETYPED | Locale contract adapted from Lucide React to Vue components |
| `i18n/locales/zh-CN.ts` | DETYPED | Full React locale data adapted to Vue icon components |
| `i18n/messages.ts` | REWRITTEN | Current Vue-owned message scaffold |
| `messages/human-input.ts` | DETYPED | Local human-input contract |
| `messages/rich-content.ts` | REWRITTEN | Vue rich-content renderer |
| `messages/tool-cards.ts` | REWRITTEN | Vue tool-card view model |
| `settings/local.ts` | REWRITTEN | Browser-local settings state |
| `settings/preferences.ts` | REWRITTEN | Vue preference persistence |
| `threads/coalesce.ts` | ADDED | Framework-neutral render coalescing policy |
| `threads/composer-draft.ts` | ADAPTED | Session-scoped composer draft contract |
| `utils/id.ts` | DETYPED | Local UUID/secure-context fallback |

## Explicit outstanding parity work

These are intentionally recorded as gaps, not silently treated as completed:

- `threads/history.ts`, `threads/coalesce.ts`, `threads/cache.ts`, and
  `threads/types.ts` are not yet present as the planned split surface.
- The full React core copy/provenance comparison is not yet implemented.
- The canonical stream event surface and render-coalescing behavior still need
  to be reconciled with the parity plan before claiming strict stream parity.
- Full Streamdown/ai-elements/right-panel parity remains outside this ledger's
  current source-backed implementation.
