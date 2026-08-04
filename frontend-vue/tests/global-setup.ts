/*
  【文件职责】     在 Playwright 用例前预热 Nuxt preview。
  【对应 frontend/】 frontend/playwright.config.ts
  【架构位置】     测试
  【主要导出】     globalSetup
  【依赖关系】     读取 PLAYWRIGHT_BASE_URL
  【边界与注意】   只接受真实 2xx/3xx 响应，失败传播退出码。
*/

export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101";
  const response = await fetch(`${baseURL}/health`);
  if (!response.ok)
    throw new Error(`Nuxt health warm-up failed: ${response.status}`);
}
