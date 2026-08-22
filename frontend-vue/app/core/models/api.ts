/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/models/api.ts retype 而来。
  【对应 frontend/】 frontend/src/core/models/api.ts
  【架构位置】     L3
  【主要导出】     loadModels
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：依赖不迁的模块（static-mode.ts），该 import 必须删除或改写。删掉 isStaticWebsiteOnly 早返回与随之无消费方的 STATIC_MODELS_RESPONSE。 WP-09 uses abortable authenticated fetch and throws the shared lossless Gateway error for non-2xx model discovery.
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

import { throwGatewayResponseError } from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";

import { getBackendBaseURL } from "../config";

import type { ModelsResponse } from "./types";

export async function loadModels(
  options: { signal?: AbortSignal } = {},
): Promise<ModelsResponse> {
  const res = await fetch(`${getBackendBaseURL()}/api/models`, {
    signal: options.signal,
  });
  if (!res.ok) {
    await throwGatewayResponseError(res, "Failed to load models.");
  }
  const data = (await res.json()) as Partial<ModelsResponse>;
  return {
    models: data.models ?? [],
    token_usage: data.token_usage ?? { enabled: false },
  };
}
