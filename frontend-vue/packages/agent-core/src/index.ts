/*
  【文件职责】     声明 agent-core 的最小公共导出面。
  【对应 frontend/】 无；M0 新增边界
  【架构位置】     L1
  【主要导出】     AGENT_CORE_CONTRACT_VERSION
  【依赖关系】     不依赖任何宿主框架
  【边界与注意】   M0 只建立包边界，不实现 run/session/reducer。
*/

export const AGENT_CORE_CONTRACT_VERSION = "m0" as const;
