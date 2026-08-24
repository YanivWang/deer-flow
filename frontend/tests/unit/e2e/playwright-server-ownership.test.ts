import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "@rstest/core";

const frontendRoot = resolve(process.cwd());

describe("Playwright server ownership", () => {
  it("never silently reuses a process that merely occupies an E2E port", () => {
    const unsafeAssignments = readdirSync(frontendRoot)
      .filter((name) => /^playwright(?:\..+)?\.config\.ts$/.test(name))
      .flatMap((name) => {
        const source = readFileSync(resolve(frontendRoot, name), "utf8");
        return [...source.matchAll(/reuseExistingServer:\s*([^,\n]+)/g)]
          .filter((match) => match[1]?.trim() !== "false")
          .map((match) => `${name}: ${match[1]?.trim()}`);
      });

    expect(unsafeAssignments).toEqual([]);
  });

  it("keeps the default mock E2E server off the normal development port", () => {
    const source = readFileSync(
      resolve(frontendRoot, "playwright.config.ts"),
      "utf8",
    );

    expect(source).toContain('E2E_FRONTEND_PORT ?? "3002"');
    expect(source).toContain("PORT: frontendPort");
  });
});
