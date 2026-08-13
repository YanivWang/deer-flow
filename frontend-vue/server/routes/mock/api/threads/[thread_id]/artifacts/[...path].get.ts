/*
  【文件职责】     将 allowlisted demo artifact 请求重定向到构建内静态资源。
  【对应 frontend/】 static-mode artifact URL branch
  【架构位置】     Nitro server route
  【主要导出】     GET /mock/api/threads/:thread_id/artifacts/**
  【依赖关系】     shared/showcase · h3
  【边界与注意】   仅 307 到 allowlist 目标；路径异常和未登记资源统一 404。
*/
import { createError, getRouterParam, sendRedirect } from "h3";
import { resolveStaticDemoArtifact } from "#shared/showcase";

export default defineEventHandler((event) => {
  const threadId = getRouterParam(event, "thread_id") ?? "";
  const rawPath = getRouterParam(event, "path") ?? "";
  const target = resolveStaticDemoArtifact(threadId, rawPath.split("/"));
  if (!target)
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  return sendRedirect(event, target, 307);
});
