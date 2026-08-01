import { describe, expect, it, vi } from "vitest";

import {
  clearMemory,
  createMemoryFact,
  deleteMemoryFact,
  exportMemory,
  importMemory,
  loadMemory,
  updateMemoryFact,
} from "../../../../../app/core/api/memory/client";

describe("memory API client", () => {
  it("loads memory from the Gateway route", async () => {
    const fetchMock = vi.fn(async () => Response.json(memory()));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadMemory()).resolves.toMatchObject({ facts: [] });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/memory",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("creates, updates, and deletes memory facts with JSON and CSRF headers", async () => {
    document.cookie = "csrf_token=memory-csrf";
    const fetchMock = vi.fn(async () => Response.json(memory()));
    vi.stubGlobal("fetch", fetchMock);

    await createMemoryFact({ category: "preference", confidence: 0.8, content: "Use Vue" });
    await updateMemoryFact("fact/1", { confidence: 0.9 });
    await deleteMemoryFact("fact/1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/memory/facts");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      category: "preference",
      confidence: 0.8,
      content: "Use Vue",
    });
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("X-CSRF-Token")).toBe(
      "memory-csrf",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/memory/facts/fact%2F1");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "PATCH" }));
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/memory/facts/fact%2F1");
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ method: "DELETE" }));
  });

  it("imports, exports, and clears memory through Gateway management routes", async () => {
    document.cookie = "csrf_token=memory-csrf";
    const fetchMock = vi.fn(async () => Response.json(memory()));
    vi.stubGlobal("fetch", fetchMock);

    await exportMemory();
    await importMemory(memory());
    await clearMemory();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/memory/export");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/memory/import");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual(memory());
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("X-CSRF-Token")).toBe(
      "memory-csrf",
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/memory");
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ method: "DELETE" }));
  });

  it("surfaces backend validation details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail: [{ msg: "content required" }] }, { status: 422 })),
    );

    await expect(createMemoryFact({
      category: "context",
      confidence: 0.8,
      content: "",
    })).rejects.toThrow("content required");
  });
});

function memory() {
  return {
    version: "1.0",
    lastUpdated: "2026-08-01T00:00:00Z",
    user: {
      workContext: { summary: "", updatedAt: "" },
      personalContext: { summary: "", updatedAt: "" },
      topOfMind: { summary: "", updatedAt: "" },
    },
    history: {
      recentMonths: { summary: "", updatedAt: "" },
      earlierContext: { summary: "", updatedAt: "" },
      longTermBackground: { summary: "", updatedAt: "" },
    },
    facts: [],
  };
}
