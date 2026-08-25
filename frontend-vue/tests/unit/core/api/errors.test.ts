import { describe, expect, it } from "vitest";

import {
  GatewayResponseError,
  readGatewayResponseError,
} from "@/core/api/errors";

describe("Gateway response errors", () => {
  it("preserves status, FastAPI detail and the parsed response body", async () => {
    const error = await readGatewayResponseError(
      new Response(JSON.stringify({ detail: "Thread has a run in flight." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
      "Fallback",
    );

    expect(error).toBeInstanceOf(GatewayResponseError);
    expect(error.status).toBe(409);
    expect(error.message).toBe("Thread has a run in flight.");
    expect(error.body).toEqual({ detail: "Thread has a run in flight." });
  });

  it("keeps non-JSON backend text instead of replacing it with a generic error", async () => {
    const error = await readGatewayResponseError(
      new Response("upstream gateway unavailable", { status: 502 }),
      "Fallback",
    );
    expect(error.status).toBe(502);
    expect(error.message).toBe("upstream gateway unavailable");
    expect(error.responseText).toBe("upstream gateway unavailable");
  });

  it("keeps raw HTML for diagnostics but uses the caller fallback for display", async () => {
    const error = await readGatewayResponseError(
      new Response("<html>502</html>", { status: 502 }),
      "Failed to load thread.",
    );
    expect(error.message).toBe("Failed to load thread.");
    expect(error.responseText).toBe("<html>502</html>");
  });

  it("does not turn an absent JSON body into a visible null error", async () => {
    const response = {
      status: 502,
      statusText: "Bad Gateway",
      json: async () => null,
    } as Response;
    const error = await readGatewayResponseError(response, "Failed to load");
    expect(error.message).toBe("Failed to load");
    expect(error.body).toBeNull();
  });
});
