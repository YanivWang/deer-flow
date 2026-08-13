import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { mergeLoopbackNoProxy } from "../../scripts/with-loopback-no-proxy.mjs";

const makefile = readFileSync(
  new URL("../../Makefile", import.meta.url),
  "utf8",
);
const m4bConfig = readFileSync(
  new URL("../../playwright.m4b.config.ts", import.meta.url),
  "utf8",
);
const inventory = JSON.parse(
  readFileSync(new URL("../m4b-inventory.json", import.meta.url), "utf8"),
) as {
  expectedFileCount: number;
  expectedTestCount: number;
  specFiles: string[];
};

describe("local Playwright command contracts", () => {
  it("real-backend pins the shared specs and Vue webServer to the same 3101 port", () => {
    expect(makefile).toContain("E2E_PORT ?= 3101");
    expect(makefile).toContain(
      "E2E_FRONTEND_PORT=$(E2E_PORT) $(E2E_EXEC) playwright test -c playwright.real-backend.config.ts",
    );
  });

  it("merges both NO_PROXY spellings without deleting the user's entries", () => {
    const merged = mergeLoopbackNoProxy({
      NO_PROXY: "internal.example,localhost",
      no_proxy: "legacy.example,127.0.0.1",
      HTTPS_PROXY: "http://proxy.example",
    });

    expect(merged.NO_PROXY).toBe(
      "internal.example,localhost,legacy.example,127.0.0.1",
    );
    expect(merged.no_proxy).toBe(merged.NO_PROXY);
    expect(merged.HTTPS_PROXY).toBe("http://proxy.example");
  });

  it("routes Playwright test processes through the loopback proxy wrapper", () => {
    const commands = makefile
      .split("\n")
      .filter((line) => line.includes("playwright test"));
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.every((line) => line.includes("$(E2E_EXEC)"))).toBe(true);
  });
});

describe("M4b inventory contract", () => {
  it("is exactly the frozen 11-file / 66-test gate", () => {
    expect(inventory.specFiles).toHaveLength(11);
    expect(new Set(inventory.specFiles)).toHaveLength(11);
    expect(inventory.expectedFileCount).toBe(11);
    expect(inventory.expectedTestCount).toBe(66);
    expect(m4bConfig).toContain("tests/m4b-inventory.json");
  });
});
