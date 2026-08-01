import { appendCsrfHeader } from "../csrf";

export type MemorySection = {
  summary: string;
  updatedAt: string;
};

export type MemoryFact = {
  id: string;
  content: string;
  category: string;
  confidence: number;
  createdAt: string;
  source: string;
};

export type UserMemory = {
  version: string;
  lastUpdated: string;
  user: {
    workContext: MemorySection;
    personalContext: MemorySection;
    topOfMind: MemorySection;
  };
  history: {
    recentMonths: MemorySection;
    earlierContext: MemorySection;
    longTermBackground: MemorySection;
  };
  facts: MemoryFact[];
};

export type MemoryFactInput = {
  content: string;
  category: string;
  confidence: number;
};

export type MemoryFactPatchInput = Partial<MemoryFactInput>;

export async function loadMemory(): Promise<UserMemory> {
  return fetchMemoryJson<UserMemory>("/api/memory");
}

export async function exportMemory(): Promise<UserMemory> {
  return fetchMemoryJson<UserMemory>("/api/memory/export");
}

export async function importMemory(memory: UserMemory): Promise<UserMemory> {
  return fetchMemoryJson<UserMemory>("/api/memory/import", {
    body: JSON.stringify(memory),
    method: "POST",
  });
}

export async function createMemoryFact(input: MemoryFactInput): Promise<UserMemory> {
  return fetchMemoryJson<UserMemory>("/api/memory/facts", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function updateMemoryFact(
  factId: string,
  input: MemoryFactPatchInput,
): Promise<UserMemory> {
  return fetchMemoryJson<UserMemory>(`/api/memory/facts/${encodeURIComponent(factId)}`, {
    body: JSON.stringify(input),
    method: "PATCH",
  });
}

export async function deleteMemoryFact(factId: string): Promise<UserMemory> {
  return fetchMemoryJson<UserMemory>(`/api/memory/facts/${encodeURIComponent(factId)}`, {
    method: "DELETE",
  });
}

export async function clearMemory(): Promise<UserMemory> {
  return fetchMemoryJson<UserMemory>("/api/memory", { method: "DELETE" });
}

async function fetchMemoryJson<T>(
  path: string,
  init: Omit<RequestInit, "headers"> & { headers?: HeadersInit } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: buildHeaders(init.headers, method),
  });
  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, "记忆请求失败。"));
  }
  return (await response.json()) as T;
}

function buildHeaders(headers: HeadersInit | undefined, method: string): Headers {
  const nextHeaders = new Headers(headers);
  if (method.toUpperCase() !== "GET" && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }
  return appendCsrfHeader(nextHeaders, method);
}

async function readResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return fallback;
  }
  return formatResponseErrorDetail(isRecord(payload) ? payload.detail : undefined) ?? fallback;
}

function formatResponseErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (isRecord(item) && typeof item.msg === "string") {
          return item.msg;
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join("; ") : undefined;
  }
  if (isRecord(detail) && typeof detail.message === "string" && detail.message.trim()) {
    return detail.message.trim();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
