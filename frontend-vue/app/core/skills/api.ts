/*
  【文件职责】     读取 skill catalog，并调用全局启停与安装 HTTP 合同。
  【架构位置】     L3 Gateway adapter
  【主要导出】     SkillRequestError · loadSkills · enableSkill · installSkill
  【依赖关系】     authenticated fetch · shared Gateway error parser
  【边界与注意】   GET 对普通用户开放；PUT/安装的真实 403 必须可被 UI 分类。
*/

import { fetch } from "@/core/api/fetcher";
import { readGatewayResponseError } from "@/core/api/errors";
import { getBackendBaseURL } from "@/core/config";

import type { Skill } from "./type";

export class SkillRequestError extends Error {
  readonly status: number;

  constructor(
    status: number,
    message: string,
    readonly body: unknown = null,
    readonly responseText = "",
  ) {
    super(message);
    this.name = "SkillRequestError";
    this.status = status;
  }

  get isAdminRequired(): boolean {
    return this.status === 403;
  }
}

async function readErrorDetail(response: Response): Promise<SkillRequestError> {
  const error = await readGatewayResponseError(
    response,
    `HTTP ${response.status}: ${response.statusText}`,
  );
  return new SkillRequestError(
    response.status,
    error.message,
    error.body,
    error.responseText,
  );
}

export async function loadSkills(options: { signal?: AbortSignal } = {}) {
  const skills = await fetch(`${getBackendBaseURL()}/api/skills`, {
    signal: options.signal,
  });
  if (!skills.ok) {
    throw await readErrorDetail(skills);
  }
  const json = await skills.json();
  return json.skills as Skill[];
}

export async function enableSkill(
  skillName: string,
  enabled: boolean,
  options: { signal?: AbortSignal } = {},
) {
  const response = await fetch(
    `${getBackendBaseURL()}/api/skills/${encodeURIComponent(skillName)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled,
      }),
      signal: options.signal,
    },
  );
  if (!response.ok) {
    throw await readErrorDetail(response);
  }
  return response.json() as Promise<Skill>;
}

export interface InstallSkillRequest {
  thread_id: string;
  path: string;
}

export interface InstallSkillResponse {
  success: boolean;
  skill_name: string;
  message: string;
}

export async function installSkill(
  request: InstallSkillRequest,
): Promise<InstallSkillResponse> {
  const response = await fetch(`${getBackendBaseURL()}/api/skills/install`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await readErrorDetail(response);
    // Surface authorization failures so callers can show an admin-only hint
    // instead of a generic failure.
    if (response.status === 403) {
      throw error;
    }
    // Other HTTP errors keep the existing soft-failure contract.
    return {
      success: false,
      skill_name: "",
      message: error.message,
    };
  }

  return response.json();
}
