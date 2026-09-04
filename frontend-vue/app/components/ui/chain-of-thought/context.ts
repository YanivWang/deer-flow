/*
  【文件职责】     ChainOfThought 根与内容层之间的展开状态通道。
  【架构位置】     L2
  【主要导出】     ChainOfThoughtContext / chainOfThoughtKey / injectChainOfThought
  【依赖关系】     Vue inject/provide
  【边界与注意】   inject 失败时抛错，与上游 `useChainOfThought` 同一条约束：内容层
                   拿不到 provider 就是用错了地方，静默当成折叠会把整段内容藏起来
                   而不报错。

                   抛错这句留在 .ts 而不是 SFC 里，是因为 i18n source guard 只扫产品
                   `.vue`，而它会把 `new Error("…")` 的英文当成漏翻的用户文案
                   （tests/unit/i18n/source-guard.test.ts 里就钉着这一条）。这不是
                   用户文案，是开发期契约，不该进词典。
*/
import { inject, type InjectionKey, type Ref } from "vue";

export interface ChainOfThoughtContext {
  isOpen: Ref<boolean>;
}

export const chainOfThoughtKey: InjectionKey<ChainOfThoughtContext> =
  Symbol("chain-of-thought");

export function injectChainOfThought(): ChainOfThoughtContext {
  const context = inject(chainOfThoughtKey, null);
  if (!context) {
    throw new Error(
      "ChainOfThought components must be used within ChainOfThought",
    );
  }
  return context;
}
