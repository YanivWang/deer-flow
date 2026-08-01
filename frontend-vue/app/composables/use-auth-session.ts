import { computed, getCurrentScope, onScopeDispose, ref } from "vue";

import {
  buildLoginRedirectPath,
  fetchCurrentUser,
  type AuthUser,
} from "../core/auth/client";

type VisibilityDocument = Pick<
  Document,
  "addEventListener" | "removeEventListener" | "visibilityState"
>;

export type AuthSessionOptions = {
  currentPath?: () => string;
  fetchUser?: () => Promise<AuthUser | null>;
  initialUser?: AuthUser | null;
  now?: () => number;
  redirectToLogin?: (path: string) => void | Promise<void>;
  refreshIntervalMs?: number;
  visibilityDocument?: VisibilityDocument | null;
};

export function useAuthSession(options: AuthSessionOptions = {}) {
  const user = ref<AuthUser | null>(options.initialUser ?? null);
  const isLoading = ref(false);
  const lastVisibilityRefreshAt = ref(0);
  const fetchUser = options.fetchUser ?? fetchCurrentUser;
  const refreshIntervalMs = options.refreshIntervalMs ?? 60_000;

  const isAuthenticated = computed(() => user.value !== null);

  function applyUser(nextUser: AuthUser | null) {
    user.value = nextUser;
  }

  async function refreshUser() {
    isLoading.value = true;
    try {
      const nextUser = await fetchUser();
      user.value = nextUser;
      if (nextUser === null) {
        await redirectIfProtected(options);
      }
    } finally {
      isLoading.value = false;
    }
  }

  const visibilityDocument =
    options.visibilityDocument === undefined
      ? resolveVisibilityDocument()
      : options.visibilityDocument;

  const stopVisibilityRefresh = visibilityDocument
    ? installVisibilityRefresh({
        documentRef: visibilityDocument,
        isAuthenticated: () => isAuthenticated.value,
        lastRefreshAt: lastVisibilityRefreshAt,
        now: options.now ?? Date.now,
        refreshIntervalMs,
        refreshUser,
      })
    : () => undefined;

  if (getCurrentScope()) {
    onScopeDispose(stopVisibilityRefresh);
  }

  return {
    applyUser,
    isAuthenticated,
    isLoading,
    refreshUser,
    stopVisibilityRefresh,
    user,
  };
}

async function redirectIfProtected(options: AuthSessionOptions) {
  const path = options.currentPath?.() ?? currentBrowserPath();
  if (!path.startsWith("/workspace")) {
    return;
  }
  const redirectToLogin =
    options.redirectToLogin ??
    ((loginPath: string) => {
      window.location.href = loginPath;
    });
  await redirectToLogin(buildLoginRedirectPath(path));
}

function installVisibilityRefresh(options: {
  documentRef: VisibilityDocument;
  isAuthenticated: () => boolean;
  lastRefreshAt: { value: number };
  now: () => number;
  refreshIntervalMs: number;
  refreshUser: () => Promise<void>;
}) {
  const onVisibilityChange = () => {
    if (options.documentRef.visibilityState !== "visible" || !options.isAuthenticated()) {
      return;
    }
    const now = options.now();
    if (now - options.lastRefreshAt.value < options.refreshIntervalMs) {
      return;
    }
    options.lastRefreshAt.value = now;
    void options.refreshUser();
  };
  options.documentRef.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    options.documentRef.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

function currentBrowserPath() {
  if (typeof window === "undefined") {
    return "/workspace";
  }
  return `${window.location.pathname}${window.location.search}`;
}

function resolveVisibilityDocument(): VisibilityDocument | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document;
}
