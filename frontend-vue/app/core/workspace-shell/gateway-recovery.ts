/*
  【文件职责】     识别 Gateway unavailable 到 authenticated 的恢复边沿。
  【对应 frontend/】 gateway-offline-banner.tsx
  【架构位置】     L3 workspace shell
  【主要导出】     createGatewayRecoveryTracker
  【依赖关系】     无
  【边界与注意】   初始 authenticated 不通知；连续健康或连续故障不重复通知。
*/
export function createGatewayRecoveryTracker(onRecovered: () => void) {
  let sawUnavailable = false;
  return {
    observe(tag: string | null | undefined) {
      if (tag === "unavailable") {
        sawUnavailable = true;
      } else if (tag === "authenticated" && sawUnavailable) {
        sawUnavailable = false;
        onRecovered();
      }
    },
  };
}
