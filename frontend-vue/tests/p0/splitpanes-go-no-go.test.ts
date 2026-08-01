import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("splitpanes go/no-go", () => {
  it("exposes separate resize and resized event names", () => {
    const entry = require.resolve("splitpanes");
    const source = readFileSync(entry, "utf8");

    expect(source).toMatch(/["'`]resize["'`]/);
    expect(source).toMatch(/["'`]resized["'`]/);
  });
});
