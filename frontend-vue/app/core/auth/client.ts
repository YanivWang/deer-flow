import { appendCsrfHeader } from "../api/csrf";

export const DEFAULT_AUTH_NEXT_PATH = "/workspace";

export type SetupStatusResponse = {
  needs_setup?: boolean;
  registration_enabled?: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  system_role: string;
  oauth_provider?: string | null;
};

export type AuthProviderSummary = {
  id: string;
  display_name: string;
  type: string;
};

export function validateAuthNextPath(nextPath: string | null | undefined): string | null {
  if (!nextPath) {
    return null;
  }
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return null;
  }
  if (nextPath.includes("\\") || nextPath.includes(":")) {
    return null;
  }
  return nextPath;
}

export function resolveAuthNextPath(
  nextPath: string | null | undefined,
  fallback = DEFAULT_AUTH_NEXT_PATH,
): string {
  return validateAuthNextPath(nextPath) ?? fallback;
}

export function buildLoginRedirectPath(currentPath: string | null | undefined): string {
  return `/login?next=${encodeURIComponent(resolveAuthNextPath(currentPath))}`;
}

export type LogoutRedirectOptions = {
  applyUser?: (user: AuthUser | null) => void;
  hardRedirect?: (path: string) => void;
  push: (path: string) => Promise<unknown>;
};

export async function logoutAndRedirect(options: LogoutRedirectOptions): Promise<void> {
  options.applyUser?.(null);
  const logoutSucceeded = await logoutCurrentUser();
  if (!logoutSucceeded) {
    const hardRedirect =
      options.hardRedirect ??
      ((path: string) => {
        window.location.href = path;
      });
    hardRedirect("/");
    return;
  }
  await options.push("/");
}

export async function fetchSetupStatus(): Promise<SetupStatusResponse> {
  const response = await fetch("/api/v1/auth/setup-status", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`初始化状态请求失败：${response.status}`);
  }
  return parseJsonObject<SetupStatusResponse>(response);
}

export async function listAuthProviders(): Promise<AuthProviderSummary[]> {
  const response = await fetch("/api/v1/auth/providers", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return [];
  }
  const data = await parseJsonObject<{ providers?: AuthProviderSummary[] }>(response);
  return Array.isArray(data.providers) ? data.providers : [];
}

export async function loginLocal(options: {
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<void> {
  const body = new URLSearchParams({
    password: options.password,
    remember_me: String(options.rememberMe),
    username: options.email,
  });
  const response = await fetch("/api/v1/auth/login/local", {
    body,
    credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  await throwIfAuthError(response);
}

export async function initializeAdmin(options: {
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<void> {
  const response = await fetch("/api/v1/auth/initialize", {
    body: JSON.stringify({
      email: options.email,
      password: options.password,
      remember_me: options.rememberMe,
    }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  await throwIfAuthError(response);
}

export async function verifyAuthenticatedSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/auth/me", { credentials: "include" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/v1/auth/me", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`账户信息请求失败：${response.status}`);
  }
  return parseJsonObject<AuthUser>(response);
}

export async function changePassword(options: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const headers = appendCsrfHeader(
    new Headers({ "Content-Type": "application/json" }),
    "POST",
  );
  const response = await fetch("/api/v1/auth/change-password", {
    body: JSON.stringify({
      current_password: options.currentPassword,
      new_password: options.newPassword,
    }),
    credentials: "include",
    headers,
    method: "POST",
  });
  await throwIfAuthError(response);
}

export async function logoutCurrentUser(): Promise<boolean> {
  const headers = appendCsrfHeader(new Headers(), "POST");
  try {
    const response = await fetch("/api/v1/auth/logout", {
      credentials: "include",
      headers,
      method: "POST",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function parseAuthErrorPayload(payload: unknown): string {
  if (isRecord(payload)) {
    const detail = payload.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }
    if (isRecord(detail) && typeof detail.message === "string" && detail.message.trim()) {
      return detail.message.trim();
    }
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
  }
  return "认证失败。";
}

async function throwIfAuthError(response: Response) {
  if (response.ok) {
    return;
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  throw new Error(parseAuthErrorPayload(payload));
}

async function parseJsonObject<T extends Record<string, unknown>>(response: Response): Promise<T> {
  const payload = await response.json();
  return isRecord(payload) ? (payload as T) : ({} as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
