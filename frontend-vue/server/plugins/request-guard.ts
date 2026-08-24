/*
  【文件职责】     在 Nitro 路由匹配前拒绝 API traversal 与不安全 body 元数据。
  【架构位置】     L3
  【主要导出】     Nitro request hook
  【依赖关系】     复用 gateway-proxy 的安全断言
  【边界与注意】   只检查 /api/**，避免干预页面和静态资源请求。
*/

import { assertSafeGatewayRequest } from "../utils/gateway-proxy";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    if ((event.node.req.url ?? "").startsWith("/api/")) {
      assertSafeGatewayRequest(event);
    }
  });
});
