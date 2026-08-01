import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = Number(process.env.P0_LAN_NUXT_PORT ?? 3013);

function findLanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return undefined;
}

async function waitForNuxt(url, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    if (child.exitCode !== null) {
      throw new Error(`Nuxt exited before readiness with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until Nuxt finishes building.
    }
    await delay(500);
  }
  throw new Error("Nuxt did not become ready.");
}

async function main() {
  const lanAddress = process.env.P0_LAN_ADDRESS ?? findLanAddress();
  if (!lanAddress) {
    throw new Error("No non-internal IPv4 address was found for LAN smoke testing.");
  }

  const child = spawn(
    "corepack",
    ["pnpm", "exec", "nuxt", "dev", "--host", "0.0.0.0", "--port", String(port)],
    {
      env: {
        ...process.env,
        FORCE_COLOR: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(`[nuxt] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[nuxt] ${chunk}`));

  let browser;
  try {
    await waitForNuxt(`http://127.0.0.1:${port}/login`, child);
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://${lanAddress}:${port}/login`);
    await page.getByRole("heading", { name: "DeerFlow" }).waitFor();
    const secureState = await page.evaluate(() => ({
      isSecureContext: window.isSecureContext,
      hasRandomUUID: typeof crypto.randomUUID === "function",
      hasGetRandomValues: typeof crypto.getRandomValues === "function",
    }));

    if (secureState.isSecureContext) {
      throw new Error(`Expected LAN HTTP origin to be insecure, got secure for ${lanAddress}.`);
    }
    if (secureState.hasRandomUUID) {
      throw new Error("Expected crypto.randomUUID to be unavailable on insecure LAN HTTP origin.");
    }
    if (!secureState.hasGetRandomValues) {
      throw new Error("Expected crypto.getRandomValues to remain available for UUID fallback.");
    }

    console.log(`LAN secure-context smoke passed for http://${lanAddress}:${port}/login.`);
  } finally {
    await browser?.close();
    child.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
