import { createServer } from "node:http";
import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const host = "127.0.0.1";
const nuxtPort = Number(process.env.P0_NUXT_PORT ?? 3012);

function listen(server, port, address = host) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, address, () => {
      server.off("error", reject);
      resolve(server.address());
    });
  });
}

async function waitForNuxt(url, child) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < 60_000) {
    if (child.exitCode !== null) {
      throw new Error(`Nuxt exited before readiness with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Nuxt did not become ready: ${String(lastError)}`);
}

async function main() {
  const upstream = createServer((request, response) => {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    response.write('event: tick\ndata: {"n":1}\nid: 1\n\n');
    setTimeout(() => response.write('event: tick\ndata: {"n":2}\nid: 2\n\n'), 200);
    setTimeout(() => response.end("event: end\ndata: {}\n\n"), 400);
  });

  const upstreamAddress = await listen(upstream, 0);
  const upstreamUrl = `http://${host}:${upstreamAddress.port}`;
  const child = spawn(
    "corepack",
    ["pnpm", "exec", "nuxt", "dev", "--host", host, "--port", String(nuxtPort)],
    {
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NUXT_GATEWAY_URL: upstreamUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(`[nuxt] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[nuxt] ${chunk}`));

  try {
    await waitForNuxt(`http://${host}:${nuxtPort}/login`, child);
    const startedAt = Date.now();
    const response = await fetch(`http://${host}:${nuxtPort}/api/langgraph/threads/p0/runs/stream`);
    if (!response.ok || !response.body) {
      throw new Error(`Proxy SSE request failed with HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      throw new Error(`Expected text/event-stream, got ${contentType}`);
    }

    const reader = response.body.getReader();
    const chunkTimes = [];
    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      chunkTimes.push(Date.now() - startedAt);
    }

    if (chunkTimes.length < 2) {
      throw new Error(`Expected multiple streamed chunks, got ${chunkTimes.length}`);
    }
    if (chunkTimes[0] > 1_000) {
      throw new Error(`First proxied SSE chunk arrived too late: ${chunkTimes[0]}ms`);
    }
    const span = chunkTimes.at(-1) - chunkTimes[0];
    if (span < 150) {
      throw new Error(`Proxy looked buffered; chunk span was only ${span}ms`);
    }

    console.log(`Nitro SSE proxy streamed ${chunkTimes.length} chunks over ${span}ms.`);
  } finally {
    child.kill("SIGTERM");
    upstream.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
