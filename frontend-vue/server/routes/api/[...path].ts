/*
  【文件职责】     处理通用 /api/** Gateway proxy。
  【对应 frontend/】 frontend/next.config.js
  【架构位置】     L3
  【主要导出】     Nitro API route
  【依赖关系】     委托 proxyGatewayRequest
  【边界与注意】   单一 catch-all 同时处理普通与 langgraph 前缀，避免路由遮蔽。
*/

import { proxyGatewayRequest } from "../../utils/gateway-proxy";

export default defineEventHandler((event) => proxyGatewayRequest(event));
