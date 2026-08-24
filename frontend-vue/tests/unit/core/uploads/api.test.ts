import { beforeEach, describe, expect, vi, test } from "vitest";

vi.mock("@/core/api/fetcher", () => ({
  fetch: vi.fn(),
}));

vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "/backend",
}));

import { fetch as fetcher } from "@/core/api/fetcher";
import { deleteUploadedFile } from "@/core/uploads/api";

const mockedFetch = vi.mocked(fetcher);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status >= 400 ? "Error" : "OK",
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockedFetch.mockReset();
});

describe("uploads api", () => {
  test("encodes uploaded filenames in delete request paths", async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        message: "Deleted report#1?.txt",
      }),
    );

    await expect(
      deleteUploadedFile("thread-1", "report#1?.txt"),
    ).resolves.toEqual({
      success: true,
      message: "Deleted report#1?.txt",
    });

    expect(mockedFetch).toHaveBeenCalledWith(
      "/backend/api/threads/thread-1/uploads/report%231%3F.txt",
      { method: "DELETE" },
    );
  });
});
