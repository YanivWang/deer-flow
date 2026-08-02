import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const vueCoreRoot = resolve(process.cwd(), "app/core");
const provenancePath = resolve(vueCoreRoot, "PROVENANCE.md");
const allowedClassifications = new Set(["ADAPTED", "ADDED", "DEMOCKED", "DETYPED", "REWRITTEN"]);

describe("core provenance guard", () => {
  it("classifies every current Vue core file without claiming full parity", () => {
    const provenance = readFileSync(provenancePath, "utf8");
    const entries = [...provenance.matchAll(/^\| `([^`]+)` \| ([A-Z]+) \|/gm)].map((match) => ({
      classification: match[2],
      file: match[1],
    }));
    const files = filesUnder(vueCoreRoot)
      .filter((file) => file !== provenancePath)
      .map((file) => relative(vueCoreRoot, file));

    expect(provenance).toContain("does **not** claim byte-identical or 100% React core parity");
    expect(entries.map(({ file }) => file)).toEqual(expect.arrayContaining(files));
    expect(files).toEqual(expect.arrayContaining(entries.map(({ file }) => file)));
    expect(entries.every(({ classification }) => allowedClassifications.has(classification))).toBe(true);
  });

  it("keeps the reference baseline and known split gaps explicit", () => {
    const provenance = readFileSync(provenancePath, "utf8");

    expect(provenance).toContain("React reference baseline: `b71a892b`");
    expect(provenance).toContain("`threads/history.ts`");
    expect(provenance).toContain("`threads/coalesce.ts`");
    expect(provenance).toContain("`threads/cache.ts`");
    expect(provenance).toContain("`threads/types.ts`");
  });
});

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}
