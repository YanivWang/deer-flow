import { describe, expect, it, vi } from "vitest";

import {
  AgentsApiDisabledError,
  checkAgentName,
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  updateAgent,
} from "../../../../../app/core/api/agents/client";
import type { AgentNameCheckError } from "../../../../../app/core/api/agents/client";

describe("agents API client", () => {
  it("lists and loads custom agents through Gateway REST endpoints", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json({
          agents: [
            {
              name: "researcher",
              description: "Research helper",
              model: null,
              tool_groups: null,
              skills: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          name: "agent/encoded",
          description: "Encoded",
          model: "model-a",
          tool_groups: ["search"],
          skills: ["web"],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAgents()).resolves.toHaveLength(1);
    await expect(getAgent("agent/encoded")).resolves.toMatchObject({ model: "model-a" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/agents");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/agents/agent%2Fencoded");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });

  it("adds CSRF to create, update, and delete requests", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=token-1" });
    const response = {
      name: "writer",
      description: "Writer",
      model: null,
      tool_groups: null,
      skills: null,
    };
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json(response, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ ...response, model: "model-a" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await createAgent({ name: "writer", soul: "SOUL" });
    await updateAgent("writer", { model: "model-a" });
    await deleteAgent("writer");

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ name: "writer", soul: "SOUL" }),
        method: "POST",
      }),
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ model: "model-a" }),
        method: "PUT",
      }),
    );
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ method: "DELETE" }));
    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("token-1");
    }
  });

  it("checks name availability and maps backend-disabled detail to a typed error", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ available: true, name: "Researcher" }))
      .mockResolvedValueOnce(
        Response.json(
          {
            detail:
              "Custom-agent management API is disabled. Set agents_api.enabled=true.",
          },
          { status: 403 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkAgentName("Researcher")).resolves.toEqual({
      available: true,
      name: "Researcher",
    });
    await expect(checkAgentName("Researcher")).rejects.toBeInstanceOf(AgentsApiDisabledError);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/agents/check?name=Researcher");
  });

  it("keeps name-check backend reachability separate from validation failures", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(Response.json({ detail: "Bad gateway" }, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ detail: [{ msg: "Only letters are allowed." }] }, { status: 422 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkAgentName("a")).rejects.toMatchObject({
      reason: "backend_unreachable",
    } satisfies Partial<AgentNameCheckError>);
    await expect(checkAgentName("a")).rejects.toMatchObject({
      reason: "backend_unreachable",
    } satisfies Partial<AgentNameCheckError>);
    await expect(checkAgentName("a")).rejects.toMatchObject({
      detail: "Only letters are allowed.",
      reason: "request_failed",
    } satisfies Partial<AgentNameCheckError>);
  });
});
