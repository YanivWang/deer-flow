export const productRoutePatterns = [
  "/workspace/**",
  "/login",
  "/setup",
  "/auth/callback",
] as const;

export const csrRouteRules = [...productRoutePatterns];

export const prerenderRoutes = [] as const;

export const swrRouteRules = [] as const;

export function isProductPath(path: string): boolean {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return (
    normalized === "/login" ||
    normalized === "/setup" ||
    normalized === "/auth/callback" ||
    normalized === "/workspace" ||
    normalized.startsWith("/workspace/")
  );
}
