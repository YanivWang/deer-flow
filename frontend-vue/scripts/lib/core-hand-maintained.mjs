/*
  【文件职责】     单一登记从机器落地档转为 Vue 手工维护的 app/core 文件。
  【对应 frontend/】 无；Vue provenance/build tooling owner
  【架构位置】     构建脚本共享清单
  【主要导出】     HAND_MAINTAINED_COPIED
  【依赖关系】     land-copied.mjs · eslint.config.mjs
  【边界与注意】   登记项必须在 PROVENANCE.md 降级出 COPIED；landing、format 与 lint 使用同一清单。
*/

export const HAND_MAINTAINED_COPIED = {
  "agents/api.ts":
    "WP-09 adds abortable Vue Query ownership and the shared authenticated Gateway error contract.",
  "api/errors.ts":
    "WP-02 unifies Gateway response parsing while preserving the legacy export.",
  "api/stream-mode.ts":
    "Local Docker acceptance removes silent run-option rewriting while retaining the shared supported stream-mode validator.",
  "i18n/cookies.ts":
    "Existing Vue SSR-free locale cookie adapter is maintained in place.",
  "mcp/api.ts":
    "WP-10 adds abortable settings ownership and typed admin-required Gateway errors.",
  "memory/api.ts":
    "WP-10 adds abortable Memory CRUD/import/export and shared lossless Gateway errors.",
  "memory/types.ts":
    "WP-10 preserves generated Gateway fact metadata plus forward-compatible import fields.",
  "threads/api.ts":
    "WP-02 preserves Gateway HTTP status/body through the shared Vue error parser.",
  "workspace-changes/api.ts":
    "WP-11 forwards TanStack Query AbortSignal and preserves the shared lossless Gateway error contract.",
  "scheduled-tasks/api.ts":
    "WP-07 adds abortable detail and limit/offset runs queries while narrowing create/update payloads to the Gateway contract.",
  "channels/api.ts":
    "WP-08 threads AbortSignal through scoped channel queries and all lifecycle mutations.",
  "channels/connect-poll.ts":
    "WP-08 adds abortable polling, explicit expiry, finite bounds, and multi-account baseline isolation.",
  "channels/provider-state.ts":
    "WP-08 keeps connectability capability-only because scoped connection instances, not provider summaries, own user status and multi-account eligibility.",
  "skills/api.ts":
    "WP-10 adds abortable catalog/toggle requests and typed admin-required errors.",
  "skills/type.ts":
    "WP-10 aligns nullable license with the real Gateway SkillResponse contract.",
};
