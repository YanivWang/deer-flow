import { defineEventHandler, getCookie, getRequestURL, sendRedirect } from "h3";

import { resolveServerAuthState, shouldProtectHtmlPath } from "../utils/auth-state";

export default defineEventHandler((event) => {
  if (process.env.DEER_FLOW_AUTH_DISABLED === "1") {
    return;
  }

  const url = getRequestURL(event);
  if (!shouldProtectHtmlPath(url.pathname)) {
    return;
  }

  const authState = resolveServerAuthState(getCookie(event, "access_token"));
  if (authState.status === "missing") {
    return sendRedirect(event, "/login", 302);
  }
});
