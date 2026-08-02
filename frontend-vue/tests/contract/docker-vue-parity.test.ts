import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "..");

describe("docker-vue deployment parity", () => {
  it("exposes the Nuxt/Nitro server directly while targeting the existing Gateway service", () => {
    const compose = readWorkspaceFile("docker-vue/docker-compose.yaml");

    expect(compose).toContain("name: deer-flow-vue");
    expect(compose).toContain("${VUE_PORT:-2027}:3000");
    expect(compose).toContain("NUXT_GATEWAY_URL: ${VUE_GATEWAY_URL:-http://gateway:8001}");
    expect(compose).toContain("NUXT_GATEWAY_URL=${VUE_GATEWAY_URL:-http://gateway:8001}");
    expect(compose).toContain("NITRO_HOST=0.0.0.0");
    expect(compose).toContain("NITRO_PORT=3000");
    expect(compose).toContain("external: true");
    expect(compose).toContain("name: ${DEER_FLOW_NETWORK:-deer-flow_deer-flow}");
  });

  it("provides a hot-reload Docker dev service without shadowing node_modules", () => {
    const compose = readWorkspaceFile("docker-vue/docker-compose.dev.yaml");

    expect(compose).toContain("name: deer-flow-vue-dev");
    expect(compose).toContain("target: deps");
    expect(compose).toContain('"nuxt", "dev"');
    expect(compose).toContain("${VUE_DEV_PORT:-2028}:3000");
    expect(compose).toContain("../frontend-vue/app:/app/app");
    expect(compose).not.toContain("../frontend-vue:/app");
    expect(compose).toContain("name: ${DEER_FLOW_NETWORK:-deer-flow_deer-flow}");
  });

  it("keeps the Docker runner port aligned with the compose target port", () => {
    const dockerfile = readWorkspaceFile("frontend-vue/Dockerfile");
    const healthcheck =
      "HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 " +
      'CMD wget -qO- "http://127.0.0.1:${NITRO_PORT}/login" >/dev/null || exit 1';

    expect(dockerfile).toContain("EXPOSE 3000");
    expect(dockerfile).toContain("ENV NODE_ENV=production");
    expect(dockerfile).toContain("ARG NUXT_GATEWAY_URL=http://gateway:8001");
    expect(dockerfile).toContain("ENV NUXT_GATEWAY_URL=${NUXT_GATEWAY_URL}");
    expect(dockerfile).toContain("ENV NITRO_HOST=0.0.0.0");
    expect(dockerfile).toContain("ENV NITRO_PORT=3000");
    expect(dockerfile).toContain("RUN corepack enable && corepack pnpm install --frozen-lockfile");
    expect(dockerfile).toContain("RUN corepack pnpm build");
    expect(dockerfile).toContain("COPY --from=build /app/.output ./.output");
    expect(dockerfile).toContain(healthcheck);
    expect(dockerfile).toContain('CMD ["node", ".output/server/index.mjs"]');
  });

  it("keeps Nuxt proxy route rules aligned with the legacy nginx Gateway rewrite", () => {
    const nuxtConfig = readWorkspaceFile("frontend-vue/nuxt.config.ts");
    const nginxConfig = readWorkspaceFile("docker/nginx/nginx.conf");

    expect(nuxtConfig).toContain('process.env.NUXT_GATEWAY_URL ??');
    expect(nuxtConfig).toContain("process.env.DEER_FLOW_INTERNAL_GATEWAY_BASE_URL ??");
    expect(nuxtConfig).toContain('"/api/langgraph/**"');
    expect(nuxtConfig).toContain("proxy: `${gatewayUrl}/api/**`");
    expect(nuxtConfig).toContain('"/api/**"');

    expect(nginxConfig).toContain("rewrite ^/api/langgraph/(.*) /api/$1 break;");
    expect(nginxConfig).toContain("set $gateway_upstream gateway:8001;");
  });

  it("keeps Mermaid dayjs plugin aliases resolvable for production builds", () => {
    const nuxtConfig = readWorkspaceFile("frontend-vue/nuxt.config.ts");

    expect(nuxtConfig).toContain('import { dirname, resolve } from "node:path";');
    expect(nuxtConfig).toContain('import { fileURLToPath } from "node:url";');
    expect(nuxtConfig).toContain("const dayjsPluginPath = (plugin: string) =>");
    expect(nuxtConfig).toContain('"dayjs/esm/plugin/advancedFormat.js"');
    expect(nuxtConfig).toContain('"dayjs/esm/plugin/customParseFormat.js"');
    expect(nuxtConfig).toContain('"dayjs/esm/plugin/duration.js"');
    expect(nuxtConfig).toContain('"dayjs/esm/plugin/isoWeek.js"');
    expect(nuxtConfig).toContain('resolve(projectRoot, "node_modules/dayjs/plugin", `${plugin}.js`)');
  });

  it("documents the Vue runtime healthcheck as a local Nitro smoke", () => {
    const readme = readWorkspaceFile("docker-vue/README.md");

    expect(readme).toContain("Runtime healthcheck");
    expect(readme).toContain("http://127.0.0.1:${NITRO_PORT}/login");
    expect(readme).toContain("without requiring Gateway auth or a live");
  });
});

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}
