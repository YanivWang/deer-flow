/*
  【文件职责】     定义 Gateway session 的唯一 Vue Query key、queryFn 与缓存策略。
  【架构位置】     L3 authentication/server state
  【主要导出】     AUTH_SESSION_QUERY_KEY · authSessionQueryOptions
  【依赖关系】     @tanstack/vue-query · ./session
  【边界与注意】   middleware、callback 与 workspace UI 必须复用此查询，不能各存一份 session。
*/

import { queryOptions } from "@tanstack/vue-query";

import { probeSession } from "./session";

export const AUTH_SESSION_QUERY_KEY = ["auth", "session"] as const;

export function authSessionQueryOptions(
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
) {
  return queryOptions({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: () => probeSession(fetchImpl),
    retry: false,
    staleTime: 0,
  });
}
