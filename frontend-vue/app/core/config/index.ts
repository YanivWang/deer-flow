/*
  【文件职责】     见下方导出与 JSDoc。
  【架构位置】     L3
  【主要导出】     getBackendBaseURL / getLangGraphBaseURL / getAppVersion
  【依赖关系】     见下方 import。
  【边界与注意】   本文件由本仓维护；行为由 tests/ 下的用例约束。
*/

/**
 * Nuxt plugin 在应用启动时读 runtime config，构造这个纯对象后注入。
 * core 自己不认识 Nuxt，也不读 cookie / process.env。
 */
export interface DeerFlowRuntimeOptions {
  langgraphBaseUrl: string;
  backendBaseUrl: string;
  authDisabled: boolean;
  /** 关于页显示的产品版本；见 nuxt.config.ts 的 `appVersion`。 */
  appVersion: string;
}

const DEFAULT_RUNTIME_OPTIONS: DeerFlowRuntimeOptions = {
  langgraphBaseUrl: "",
  backendBaseUrl: "",
  authDisabled: false,
  appVersion: "",
};

let runtimeOptions: DeerFlowRuntimeOptions = DEFAULT_RUNTIME_OPTIONS;

export function setDeerFlowRuntimeOptions(options: DeerFlowRuntimeOptions) {
  runtimeOptions = options;
}

export function getDeerFlowRuntimeOptions(): DeerFlowRuntimeOptions {
  return runtimeOptions;
}

/** 关于页显示的产品版本。没注入时给一个空串，调用方自己决定要不要渲染。 */
export function getAppVersion() {
  return runtimeOptions.appVersion;
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
