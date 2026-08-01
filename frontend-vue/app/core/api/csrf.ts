export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

const CSRF_PROTECTED_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

export function isCsrfProtectedMethod(method: string): boolean {
  return CSRF_PROTECTED_METHODS.has(method.toUpperCase());
}

export function readCookieValue(cookieHeader: string, name: string): string | undefined {
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const cookie = part.trim();
    if (cookie.startsWith(prefix)) {
      const rawValue = cookie.slice(prefix.length);
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }
  return undefined;
}

export function readBrowserCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  return readCookieValue(document.cookie, name);
}

export function appendCsrfHeader(
  headers: Headers,
  method: string,
  cookieHeader?: string,
): Headers {
  if (!isCsrfProtectedMethod(method) || headers.has(CSRF_HEADER_NAME)) {
    return headers;
  }

  const token =
    cookieHeader === undefined
      ? readBrowserCookie(CSRF_COOKIE_NAME)
      : readCookieValue(cookieHeader, CSRF_COOKIE_NAME);
  if (token) {
    headers.set(CSRF_HEADER_NAME, token);
  }
  return headers;
}
