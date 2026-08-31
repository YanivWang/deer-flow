/*
  【文件职责】     Reasoning 根与触发器之间的展开状态通道。
  【架构位置】     L2
  【主要导出】     reasoningKey / injectReasoning
  【依赖关系】     Vue inject/provide
  【边界与注意】   只传 `isOpen`。上游 `useReasoning` 的 context 还带
                   `isStreaming` / `duration` / `startTime`，那三个只服务
                   `defaultGetThinkingMessage`——本仓没有移植那条默认文案链
                   （理由见 ReasoningTrigger.vue 的文件头），所以它们没有读者。
                   宁可留一个只有一项的 context，也不要摆三个永远没人取的值。

                   inject 失败时抛错，与上游 `useReasoning` 同一条约束。抛错这句
                   留在 .ts 而不是 SFC 里，是因为 i18n source guard 只扫产品 `.vue`，
                   会把 `new Error("…")` 的英文当成漏翻的用户文案（坑 52）。
*/
import { inject, type InjectionKey, type Ref } from "vue";

export interface ReasoningContext {
  isOpen: Ref<boolean>;
}

export const reasoningKey: InjectionKey<ReasoningContext> = Symbol("reasoning");

export function injectReasoning(): ReasoningContext {
  const context = inject(reasoningKey, null);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
}
