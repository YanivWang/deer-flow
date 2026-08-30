/*
  Mock-mode fixtures for the Lark integration endpoints.

  Typed against the real contract on purpose: an untyped object literal lets a
  fixture silently fall behind the API it stands in for. That already happened —
  every flow response here was missing the required `generation`, which the
  Gateway uses to reject a superseded flow.
*/
import type { LarkAuthStartResponse } from "@/core/integrations/lark/types";

export function POST() {
  const body: LarkAuthStartResponse = {
    verification_url: "https://open.feishu.cn/auth/mock-device",
    device_code: "mock-device-code",
    generation: "mock-auth-generation",
    expires_in: 600,
    user_code: null,
    hint: null,
  };
  return Response.json(body);
}
