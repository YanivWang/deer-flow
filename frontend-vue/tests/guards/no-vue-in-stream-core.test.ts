import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("stream core guard", () => {
  it("does not import Vue from the framework-neutral stream core", () => {
    const files = [
      ...filesUnder(join(process.cwd(), "app/core/stream")),
      ...filesUnder(join(process.cwd(), "app/core/protocol/stream")),
    ];
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return /from ["']vue["']|from ["']#imports["']|from ["']nuxt/.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
