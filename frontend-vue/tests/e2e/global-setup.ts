import { chromium, type FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== "string") return;

  const warmupUrls = [
    `${baseURL}/workspace/chats/new`,
    `${baseURL}/workspace/chats/00000000-0000-0000-0000-000000000001`,
  ];
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const url of warmupUrls) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.locator("body").waitFor({ state: "attached", timeout: 120_000 });
      } catch {
        // The browser tests own API mocking; warm-up is only a best-effort
        // Nuxt page compilation step and must not hide the actual test error.
      }
    }
  } finally {
    await browser.close();
  }
}
