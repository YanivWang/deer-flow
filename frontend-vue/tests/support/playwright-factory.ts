/*
  【文件职责】     Playwright config 的共享装配层：把「起哪些服务器」与「测什么」分开声明。
  【架构位置】     测试基础设施
  【主要导出】     nuxtPreview / replayGateway / m0Gateway / defineSuite
  【依赖关系】     @playwright/test
  【边界与注意】   每个套件仍是一份独立 config，因为它们的**后端拓扑真的不同**：
                   gateway 二进制不同（run_m0_gateway vs run_replay_gateway）、
                   seed 环境变量不同（channels / agents / settings / runs 各一套）、
                   前端 auth 模式不同。合并它们等于改变被测行为。
                   这一层消除的是复制，不是差异——差异必须在各自 config 里显式写出来。
*/

import { defineConfig, devices } from "@playwright/test";

import type { PlaywrightTestConfig } from "@playwright/test";

type WebServer = NonNullable<PlaywrightTestConfig["webServer"]>;
type WebServerEntry = WebServer extends readonly (infer T)[] ? T : never;

const isCI = Boolean(process.env.CI);

/** Nuxt production preview。build 与 preview 必须拿到同一组 NUXT_PUBLIC_*，否则产物与运行时不一致。 */
export function nuxtPreview(options: {
  port: string;
  /** 前端的 auth 模式。真实 Gateway 套件里它必须与 Gateway 的 auth 设置一致。 */
  authDisabled: boolean;
  /** `__m0` 测试页面。只有代理/协议这类基础设施套件需要。 */
  m0TestPages?: boolean;
  /** 同源代理指向的 Gateway。留空表示套件自己用 page.route() mock。 */
  gatewayPort?: string;
  /** 额外的 NUXT_PUBLIC_*，build 与 preview 都会拿到。 */
  publicEnv?: Record<string, string>;
}): WebServerEntry {
  const shared = {
    NUXT_PUBLIC_AUTH_DISABLED: options.authDisabled ? "1" : "0",
    ...(options.m0TestPages === undefined
      ? {}
      : { NUXT_PUBLIC_M0_TEST_PAGES: options.m0TestPages ? "1" : "0" }),
    ...options.publicEnv,
  };
  const prefix = Object.entries(shared)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  const internal = options.gatewayPort
    ? `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:${options.gatewayPort} `
    : "";
  return {
    command:
      `${internal}${prefix} ./node_modules/.bin/nuxt build && ` +
      `PORT=${options.port} HOST=127.0.0.1 ${prefix} ./node_modules/.bin/nuxt preview`,
    url: `http://localhost:${options.port}`,
    reuseExistingServer: false,
    timeout: 240_000,
  };
}

/** backend/scripts/run_replay_gateway.py —— 真实 FastAPI Gateway，走签入的 replay fixture。 */
export function replayGateway(options: {
  port: string;
  cors: string;
  /** 该套件需要的 seed 开关。每个套件只开自己那一个，见文件头。 */
  env?: Record<string, string>;
}): WebServerEntry {
  return {
    command: `uv run python scripts/run_replay_gateway.py --port ${options.port} --cors ${options.cors}`,
    cwd: "../backend",
    url: `http://127.0.0.1:${options.port}/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    ...(options.env ? { env: options.env } : {}),
  };
}

/** tests/support/run_m0_gateway.py —— 本仓自有的 Gateway 包装，可控事件保留窗口与浏览器工具。 */
export function m0Gateway(options: {
  port: string;
  cors: string;
  args?: string[];
  pipeOutput?: boolean;
}): WebServerEntry {
  const args = options.args?.length ? ` ${options.args.join(" ")}` : "";
  return {
    command: `../backend/.venv/bin/python tests/support/run_m0_gateway.py --port ${options.port} --cors ${options.cors}${args}`,
    url: `http://127.0.0.1:${options.port}/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    ...(options.pipeOutput
      ? { stdout: "pipe" as const, stderr: "pipe" as const }
      : {}),
  };
}

/**
 * 一个套件 = 一个 testDir + 一组服务器。
 *
 * `serial` 给共享进程级状态的套件用：真实 Gateway 的数据、stub server、
 * 截图基线、登录态都不是每个测试一份，并发会互相踩（auth 套件实测：
 * 并行 4 红，workers=1 全绿）。只有各自用 page.route() 自带 mock 的
 * 产品合同套件可以按文件并行。
 */
export function defineSuite(options: {
  name: string;
  testDir: string;
  port: string;
  /** 需要绝对 URL 访问 Gateway 的套件在这里声明；spec 读 E2E_GATEWAY_URL。 */
  gatewayUrl?: string;
  servers: WebServerEntry[];
  serial?: boolean;
  timeout?: number;
  globalSetup?: string;
  expect?: PlaywrightTestConfig["expect"];
  grep?: RegExp;
  /** 套件专属的 use 覆盖，合并在默认值之后。跨应用对照需要把时区、动画和配色钉死。 */
  use?: PlaywrightTestConfig["use"];
}) {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${options.port}`;
  process.env.PLAYWRIGHT_BASE_URL ??= baseURL;
  // 需要用绝对 URL 发 API 请求的 spec 从这里拿地址，而不是各自去读一个
  // 按套件命名的端口变量——那样每挪一次套件就要同步改 spec、Makefile 和 config 三处。
  process.env.E2E_APP_URL ??= baseURL;
  if (options.gatewayUrl) process.env.E2E_GATEWAY_URL ??= options.gatewayUrl;
  return defineConfig({
    testDir: options.testDir,
    fullyParallel: !options.serial,
    workers: options.serial ? 1 : isCI ? 2 : undefined,
    forbidOnly: isCI,
    retries: 0,
    reporter: isCI ? "github" : "list",
    timeout: options.timeout ?? 30_000,
    outputDir: `test-results/${options.name}`,
    ...(options.globalSetup ? { globalSetup: options.globalSetup } : {}),
    /*
      单条断言的等待预算。**Playwright 的默认值是 5s，而用例本身有 30s**——
      交接文档里那一串「异步 / hover / 滚动 + 固定超时」的已知抖动，机制就是这个
      5s：机器一慢，某一条 `toBeVisible` 用光预算，而同一个用例还剩二十几秒没人用。

      wave 108 用 CDP 的 `Emulation.setCPUThrottlingRate` 把它变成了可复现实验：
      `i18n-theme.spec.ts` 第一条 `expect(dialog).toBeVisible()` 在 **30x 节流**下
      实测 **3832ms**（预算 5000ms，用掉 77%），50x 时直接超时。
      也就是说这一类根本不是「断言钉错了对象」（那是 wave 107 修的另一类），
      **断言本身是对的，只是预算给小了。**

      取 10s：**语义一行都不变**（能过的断言立刻返回，过不了的照样红），
      代价只有一个——**真失败时报错慢一倍**（5s → 10s），而且只在那一条上付。
      仍然远低于用例的 30s，所以失败消息还是「哪个 locator 没等到」，
      不会退化成一句「Test timeout of 30000ms exceeded」。
      套件仍可用 `options.expect` 覆盖。
    */
    expect: { timeout: 10_000, ...options.expect },
    ...(options.grep ? { grep: options.grep } : {}),
    use: {
      baseURL,
      locale: "en-US",
      trace: "on-first-retry",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
      ...options.use,
    },
    // project 名就是浏览器维度。套件身份由 config 承担，不重复编进 project——
    // 视觉快照的文件名里含 project 名，把套件名编进去会让「改套件名」
    // 连带作废所有基线图。
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: options.servers,
  });
}
