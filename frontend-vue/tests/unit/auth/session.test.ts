import { describe, expect, it, vi } from "vitest";

import { probeSession } from "@/core/auth/session";

describe("probeSession", () => {
  it("distinguishes 401 from an unavailable Gateway", async () => {
    await expect(
      probeSession(
        vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
      ),
    ).resolves.toEqual({ tag: "unauthenticated" });
    await expect(
      probeSession(
        vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
      ),
    ).resolves.toEqual({ tag: "unavailable" });
  });

  it("validates the authenticated user shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        id: "user-1",
        email: "admin@example.com",
        system_role: "admin",
        needs_setup: false,
      }),
    );
    await expect(probeSession(fetchImpl)).resolves.toMatchObject({
      tag: "authenticated",
      user: { id: "user-1" },
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/auth/me", {
      credentials: "include",
      cache: "no-store",
    });
  });
});
