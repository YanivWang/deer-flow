/*
  Mock-mode fixtures for the Lark integration endpoints.

  Typed against the real contract on purpose: an untyped object literal lets a
  fixture silently fall behind the API it stands in for. That already happened —
  every flow response here was missing the required `generation`, which the
  Gateway uses to reject a superseded flow.
*/
import type { LarkConfigStartResponse } from "@/core/integrations/lark/types";

export function POST() {
  const body: LarkConfigStartResponse = {
    verification_url: "https://open.feishu.cn/page/cli?user_code=config",
    device_code: "mock-config-device-code",
    generation: "mock-config-generation",
    expires_in: 600,
    interval: 5,
    user_code: "config",
    brand: "feishu",
  };
  return Response.json(body);
}
