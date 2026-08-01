import { appendCsrfHeader } from "../csrf";

export class SkillRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SkillRequestError";
    this.status = status;
  }

  get isAdminRequired(): boolean {
    return this.status === 403;
  }
}

export type SkillCategory = "public" | "custom" | "legacy" | string;

export type Skill = {
  name: string;
  description: string;
  license: string | null;
  category: SkillCategory;
  enabled: boolean;
  editable: boolean;
};

export type SkillsListResponse = {
  skills: Skill[];
};

export type SkillInstallRequest = {
  thread_id: string;
  path: string;
};

export type SkillInstallResponse = {
  success: boolean;
  skill_name: string;
  message: string;
};

export type SkillReloadResponse = {
  success: boolean;
  scope: "process";
  message: string;
};

export type CustomSkillContent = Skill & {
  content: string;
};

export type CustomSkillHistoryResponse = {
  history: Array<Record<string, unknown>>;
};

export type SkillDeleteResponse = {
  success: boolean;
};

export type SkillRollbackRequest = {
  history_index?: number;
};

export async function loadSkills(): Promise<Skill[]> {
  const response = await fetchSkillsJson<SkillsListResponse>("/api/skills");
  return response.skills;
}

export async function loadSkillDetail(skillName: string): Promise<Skill> {
  return fetchSkillsJson<Skill>(`/api/skills/${encodeURIComponent(skillName)}`);
}

export async function updateSkillEnabled(skillName: string, enabled: boolean): Promise<Skill> {
  return fetchSkillsJson<Skill>(`/api/skills/${encodeURIComponent(skillName)}`, {
    body: JSON.stringify({ enabled }),
    method: "PUT",
  });
}

export async function installSkill(request: SkillInstallRequest): Promise<SkillInstallResponse> {
  return fetchSkillsJson<SkillInstallResponse>("/api/skills/install", {
    body: JSON.stringify(request),
    method: "POST",
  });
}

export async function reloadSkills(): Promise<SkillReloadResponse> {
  return fetchSkillsJson<SkillReloadResponse>("/api/skills/reload", {
    method: "POST",
  });
}

export async function loadCustomSkill(skillName: string): Promise<CustomSkillContent> {
  return fetchSkillsJson<CustomSkillContent>(
    `/api/skills/custom/${encodeURIComponent(skillName)}`,
  );
}

export async function updateCustomSkill(
  skillName: string,
  content: string,
): Promise<CustomSkillContent> {
  return fetchSkillsJson<CustomSkillContent>(
    `/api/skills/custom/${encodeURIComponent(skillName)}`,
    {
      body: JSON.stringify({ content }),
      method: "PUT",
    },
  );
}

export async function deleteCustomSkill(skillName: string): Promise<SkillDeleteResponse> {
  return fetchSkillsJson<SkillDeleteResponse>(
    `/api/skills/custom/${encodeURIComponent(skillName)}`,
    {
      method: "DELETE",
    },
  );
}

export async function loadCustomSkillHistory(
  skillName: string,
): Promise<CustomSkillHistoryResponse> {
  return fetchSkillsJson<CustomSkillHistoryResponse>(
    `/api/skills/custom/${encodeURIComponent(skillName)}/history`,
  );
}

export async function rollbackCustomSkill(
  skillName: string,
  request: SkillRollbackRequest = {},
): Promise<CustomSkillContent> {
  return fetchSkillsJson<CustomSkillContent>(
    `/api/skills/custom/${encodeURIComponent(skillName)}/rollback`,
    {
      body: JSON.stringify(request),
      method: "POST",
    },
  );
}

async function fetchSkillsJson<T>(
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
    throw new SkillRequestError(
      response.status,
      await readResponseErrorMessage(response, `HTTP ${response.status}: ${response.statusText}`),
    );
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
  const detail = isRecord(payload) ? payload.detail : undefined;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }
  if (isRecord(detail) && typeof detail.message === "string" && detail.message.trim()) {
    return detail.message.trim();
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
