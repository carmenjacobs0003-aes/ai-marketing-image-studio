export const AUTH_ROUTES = ["/login", "/signup"] as const;

export const PROTECTED_ROUTES = [
  "/admin",
  "/brand",
  "/dashboard",
  "/images",
  "/marketing",
  "/projects",
  "/studio",
  "/templates"
] as const;

export const DEFAULT_AUTHENTICATED_ROUTE = "/dashboard";
export const DEFAULT_UNAUTHENTICATED_ROUTE = "/login";

export function isRouteMatch(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedRoute(pathname: string) {
  return isRouteMatch(pathname, PROTECTED_ROUTES);
}

export function isAuthRoute(pathname: string) {
  return isRouteMatch(pathname, AUTH_ROUTES);
}

export function getSafeRedirectPath(redirectTo?: string | null) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }

  return redirectTo;
}
