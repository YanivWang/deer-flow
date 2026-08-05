/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/config/index.ts retype 而来。
  【对应 frontend/】 frontend/src/core/config/index.ts
  【架构位置】     L3
  【主要导出】     getBackendBaseURL / getLangGraphBaseURL
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：改为接收普通 runtime options，纯 core 不调用 useRuntimeConfig()。（@/env → runtime options）
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

/**
 * Nuxt plugin 在应用启动时读 runtime config，构造这个纯对象后注入。
 * core 自己不认识 Nuxt，也不读 cookie / process.env。
 */
export interface DeerFlowRuntimeOptions {
  langgraphBaseUrl: string;
  backendBaseUrl: string;
  authDisabled: boolean;
}

const DEFAULT_RUNTIME_OPTIONS: DeerFlowRuntimeOptions = {
  langgraphBaseUrl: "",
  backendBaseUrl: "",
  authDisabled: false,
};

let runtimeOptions: DeerFlowRuntimeOptions = DEFAULT_RUNTIME_OPTIONS;

export function setDeerFlowRuntimeOptions(options: DeerFlowRuntimeOptions) {
  runtimeOptions = options;
}

export function getDeerFlowRuntimeOptions(): DeerFlowRuntimeOptions {
  return runtimeOptions;
}

/** 测试与 HMR 用：回到「什么都没注入」的初始态。 */
export function resetDeerFlowRuntimeOptions() {
  runtimeOptions = DEFAULT_RUNTIME_OPTIONS;
}

function getBaseOrigin() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // Fallback for SSR
  return "http://localhost:2026";
}

export function getBackendBaseURL() {
  if (runtimeOptions.backendBaseUrl) {
    return new URL(runtimeOptions.backendBaseUrl, getBaseOrigin())
      .toString()
      .replace(/\/+$/, "");
  } else {
    return "";
  }
}

export function getLangGraphBaseURL(isMock?: boolean) {
  if (runtimeOptions.langgraphBaseUrl) {
    return new URL(runtimeOptions.langgraphBaseUrl, getBaseOrigin()).toString();
  } else if (isMock) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/mock/api`;
    }
    return "http://localhost:3000/mock/api";
  } else {
    // LangGraph SDK requires a full URL, construct it from current origin
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/langgraph`;
    }
    // Fallback for SSR
    return "http://localhost:2026/api/langgraph";
  }
}
