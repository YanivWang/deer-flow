/*
  【文件职责】     暴露 ConversationEmptyState 组件。
  【架构位置】     L2
  【主要导出】     ConversationEmptyState
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。四件套里另外三件为什么没移植，
                   写在 ConversationEmptyState.vue 的文件头里。
*/

export { default as ConversationEmptyState } from "./ConversationEmptyState.vue";
