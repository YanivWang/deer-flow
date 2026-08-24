/*
  【文件职责】     返回 Nuxt 进程自身的存活状态。
  【架构位置】     工程底座
  【主要导出】     GET /health
  【依赖关系】     被容器 healthcheck 与 smoke 消费
  【边界与注意】   不代理 Gateway，不泄露运行配置。
*/

export default defineEventHandler(() => ({
  status: "ok",
  service: "frontend-vue",
}));
