import { spawn } from "node:child_process";
import { createServer } from "node:net";
import process from "node:process";

const host = process.env.PLAYWRIGHT_WEB_SERVER_HOST ?? "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_WEB_SERVER_PORT ?? 3001);

function canListen() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, host, () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });
}

function explainListenFailure(error) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const message = error instanceof Error ? error.message : String(error);
  if (code === "EPERM" || code === "EACCES") {
    return [
      `Unable to start the Nuxt E2E web server on ${host}:${port}.`,
      "The current execution sandbox does not allow binding a local TCP listener.",
      "Run this command with local network-listen permission, or start Nuxt separately and set",
      `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://${host}:${port}.`,
      `Original error: ${message}`,
    ].join("\n");
  }
  return `Unable to start the Nuxt E2E web server on ${host}:${port}: ${message}`;
}

async function main() {
  try {
    await canListen();
  } catch (error) {
    console.error(explainListenFailure(error));
    process.exitCode = 1;
    return;
  }

  const child = spawn("corepack", ["pnpm", "exec", "nuxt", "dev"], {
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      HOST: host,
      NITRO_HOST: host,
      NITRO_PORT: String(port),
      NUXT_HOST: host,
      NUXT_PORT: String(port),
      PORT: String(port),
    },
    stdio: "inherit",
  });

  const stop = (signal) => {
    child.kill(signal);
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}

await main();
