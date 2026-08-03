import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const backendAuthRouter = readRepositoryFile("backend/app/gateway/routers/auth.py");
const vueAuthClient = readRepositoryFile("frontend-vue/app/core/auth/client.ts");
const vueAuthSession = readRepositoryFile("frontend-vue/app/entities/auth/use-auth-session.ts");

describe("Vue auth client matches the real Gateway auth contract", () => {
  it("keeps local login aligned with FastAPI form fields and remember-me semantics", () => {
    expect(backendAuthRouter).toContain('@router.post("/login/local", response_model=LoginResponse)');
    expect(backendAuthRouter).toContain("form_data: OAuth2PasswordRequestForm = Depends()");
    expect(backendAuthRouter).toContain("remember_me: bool = Form(default=True)");
    expect(vueAuthClient).toContain('"/api/v1/auth/login/local"');
    expect(vueAuthClient).toContain("new URLSearchParams");
    expect(vueAuthClient).toContain("username: options.email");
    expect(vueAuthClient).toContain("remember_me: String(options.rememberMe)");
    expect(vueAuthClient).toContain('"Content-Type": "application/x-www-form-urlencoded"');
  });

  it("keeps setup, current-user, logout, and password-change endpoints aligned", () => {
    expect(backendAuthRouter).toContain('@router.get("/setup-status")');
    expect(backendAuthRouter).toContain('@router.post("/initialize", response_model=UserResponse');
    expect(backendAuthRouter).toContain('@router.get("/me", response_model=UserResponse)');
    expect(backendAuthRouter).toContain('@router.post("/logout", response_model=MessageResponse)');
    expect(backendAuthRouter).toContain('@router.post("/change-password", response_model=MessageResponse)');
    expect(backendAuthRouter).toContain("current_password: str");
    expect(backendAuthRouter).toContain("new_password: str = Field(..., min_length=8)");
    expect(backendAuthRouter).toContain("remember_me: bool | None = None");
    expect(backendAuthRouter).toContain("_set_csrf_cookie(response, request)");
    expect(vueAuthClient).toContain('"/api/v1/auth/setup-status"');
    expect(vueAuthClient).toContain('"/api/v1/auth/initialize"');
    expect(vueAuthClient).toContain('"/api/v1/auth/me"');
    expect(vueAuthClient).toContain('"/api/v1/auth/logout"');
    expect(vueAuthClient).toContain('"/api/v1/auth/change-password"');
    expect(vueAuthClient).toContain("current_password: options.currentPassword");
    expect(vueAuthClient).toContain("new_password: options.newPassword");
    expect(vueAuthClient).toContain("appendCsrfHeader");
  });

  it("preserves Gateway-owned cookies and SSO callback redirect boundaries", () => {
    expect(backendAuthRouter).toContain("ACCESS_TOKEN_COOKIE_NAME");
    expect(backendAuthRouter).toContain("CSRF_COOKIE_NAME");
    expect(backendAuthRouter).toContain("SESSION_PERSISTENCE_COOKIE_NAME");
    expect(backendAuthRouter).toContain('@router.get("/providers")');
    expect(backendAuthRouter).toContain('@router.get("/oauth/{provider}")');
    expect(backendAuthRouter).toContain('@router.get("/callback/{provider}")');
    expect(backendAuthRouter).toContain("validate_next_param(next)");
    expect(backendAuthRouter).toContain('callback_redirect = f"{frontend_base}/auth/callback?next=');
    expect(vueAuthClient).toContain("validateAuthNextPath");
    expect(vueAuthClient).toContain("verifyAuthenticatedSession");
    expect(vueAuthSession).toContain("buildLoginRedirectPath");
  });
});

function readRepositoryFile(path: string) {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../..", path), "utf8");
}
