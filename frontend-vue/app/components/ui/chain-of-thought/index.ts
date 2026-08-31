/*
  【文件职责】     思维链容器的公共入口。
  【架构位置】     L2
  【主要导出】     ChainOfThought / ChainOfThoughtContent / ChainOfThoughtStep
  【依赖关系】     同目录 SFC
  【边界与注意】   上游 `ai-elements/chain-of-thought.tsx` 导出 7 个组件，本仓只移植
                   卡片真正用到的 3 个。Header / SearchResults / SearchResult / Image
                   在本仓一个调用点都没有，先移植等于先冻结一份没人验证过的形状。
*/
export { default as ChainOfThought } from "./ChainOfThought.vue";
export { default as ChainOfThoughtContent } from "./ChainOfThoughtContent.vue";
export { default as ChainOfThoughtStep } from "./ChainOfThoughtStep.vue";
