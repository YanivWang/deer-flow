/*
  【文件职责】     声明 Memory server-state 的唯一 Vue Query identity。
  【架构位置】     L3 server-state identity
  【主要导出】     MEMORY_QUERY_KEY
  【依赖关系】     无
  【边界与注意】   设置页与后续消费者必须复用，不得另建 ref/onMounted 缓存。
*/

export const MEMORY_QUERY_KEY = ["memory"] as const;
