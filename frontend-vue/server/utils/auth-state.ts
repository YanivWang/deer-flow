export type ServerAuthState =
  | { status: "authenticated"; accessToken: string }
  | { status: "missing" };

export function resolveServerAuthState(accessToken: string | undefined): ServerAuthState {
  if (accessToken && accessToken.trim()) {
    return { status: "authenticated", accessToken };
  }
  return { status: "missing" };
}

export function shouldProtectHtmlPath(path: string): boolean {
  return (
    path === "/workspace" ||
    path.startsWith("/workspace/") ||
    path === "/auth/callback"
  );
}
