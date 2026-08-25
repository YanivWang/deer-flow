/*
  【文件职责】     对照取样的浏览器上下文选项，config 与 spec 共用一份。
  【架构位置】     对照测试基础设施
  【主要导出】     PARITY_CONTEXT_OPTIONS
  【边界与注意】   两处消费者：playwright.parity.config.ts 的 use，以及 diff.spec.ts 里
                   为每个场景新开的 context。写成两份迟早会分叉，而分叉的后果是
                   「同一个场景在两条路径上取到的样本不一样」——比对结果会因此取决于
                   它是被哪个入口跑到的。

                   对照必须在同一组环境条件下取样，否则第一层比对就会被时区、动画
                   中间帧和配色方案淹没。主题维度不走 colorScheme，走两个应用共用的
                   localStorage 键，所以这里把 colorScheme 钉死。
*/

import type { PlaywrightTestConfig } from "@playwright/test";

export const PARITY_CONTEXT_OPTIONS = {
  locale: "en-US",
  timezoneId: "UTC",
  colorScheme: "light",
  reducedMotion: "reduce",
} as const satisfies PlaywrightTestConfig["use"];
