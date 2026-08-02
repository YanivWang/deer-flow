import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "app");

describe("Vue parity plan template boundaries", () => {
  it("keeps Vue product templates free of aria and sr-only facilities", () => {
    const findings = filesUnder(sourceRoot)
      .filter((file) => /\.(?:vue|ts)$/.test(file))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        const template = /<template>([\s\S]*?)<\/template>/.exec(source)?.[1] ?? source;
        return /\baria-[\w-]+\b|\bsr-only\b/.test(template) ? [file] : [];
      });

    expect(findings).toEqual([]);
  });

  it("keeps click handlers on native interactive elements", () => {
    const findings = filesUnder(sourceRoot)
      .filter((file) => file.endsWith(".vue"))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return /<(?:div|span|p|li)\b[^>]*@click=/.test(source) ? [file] : [];
      });

    expect(findings).toEqual([]);
  });
});

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) {
      if (basename(path) === ".nuxt") return [];
      return filesUnder(path);
    }
    return [path];
  });
}
