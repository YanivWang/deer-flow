import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "app");

describe("Vue parity plan template boundaries", () => {
  it("keeps the accessibility primitive available to product surfaces", () => {
    expect(readFileSync(resolve(sourceRoot, "shared/ui/AppButton.vue"), "utf8")).toContain("aria-label");
    expect(readFileSync(resolve(sourceRoot, "widgets/workspace/settings/SettingsSection.vue"), "utf8")).toContain("aria-label");
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
