/*
  【文件职责】     在认证主体边界清空所有浏览器内用户态。
  【架构位置】     L3 authentication/client state boundary
  【主要导出】     clearAuthenticatedClientState
  【依赖关系】     TanStack Query · composer draft lifecycle
  【边界与注意】   Query key 并非全部携带 user id；登录、注册、SSO 与退出成功后必须整树清理，
                   不能只 invalidate 当前线程，否则旧用户数据会在新请求完成前跨账号显示。
*/

import type { QueryClient } from "@tanstack/vue-query";

import { getSessionComposerDraftStorage } from "@/core/threads/composer-draft";
import { clearComposerDrafts } from "@/core/threads/composer-draft-lifecycle";

export function clearAuthenticatedClientState(queryClient: QueryClient) {
  clearComposerDrafts(getSessionComposerDraftStorage() as Storage | null);
  queryClient.clear();
}
