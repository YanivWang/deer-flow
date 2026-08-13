import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import { mergeLoopbackNoProxy } from "./with-loopback-no-proxy.mjs";

const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");
const inventory = JSON.parse(
  readFileSync(new URL("../tests/m4b-inventory.json", import.meta.url), "utf8"),
);

const listed = spawnSync(
  process.execPath,
  [
    playwrightCli,
    "test",
    "-c",
    "playwright.m4b.config.ts",
    "--list",
    "--reporter=json",
  ],
  {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: mergeLoopbackNoProxy(),
    maxBuffer: 20 * 1024 * 1024,
  },
);

if (listed.status !== 0) {
  process.stderr.write(listed.stderr);
  process.stdout.write(listed.stdout);
  process.exit(listed.status ?? 1);
}

const report = JSON.parse(listed.stdout);
const fileCounts = new Map();
function collect(suite) {
  for (const spec of suite.specs ?? []) {
    const file = spec.file;
    fileCounts.set(file, (fileCounts.get(file) ?? 0) + spec.tests.length);
  }
  for (const child of suite.suites ?? []) collect(child);
}
for (const suite of report.suites ?? []) collect(suite);

const expectedFiles = [...inventory.specFiles].sort();
const actualFiles = [...fileCounts.keys()].sort();
const actualTestCount = [...fileCounts.values()].reduce(
  (total, count) => total + count,
  0,
);
const errors = [];

if (inventory.expectedFileCount !== expectedFiles.length) {
  errors.push(
    `manifest expectedFileCount=${inventory.expectedFileCount}, but specFiles has ${expectedFiles.length} entries`,
  );
}
if (new Set(expectedFiles).size !== expectedFiles.length) {
  errors.push("manifest specFiles contains duplicates");
}
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  errors.push(
    `spec file drift\nexpected: ${expectedFiles.join(", ")}\nactual:   ${actualFiles.join(", ")}`,
  );
}
if (actualTestCount !== inventory.expectedTestCount) {
  errors.push(
    `test count drift: expected ${inventory.expectedTestCount}, collected ${actualTestCount}`,
  );
}

if (errors.length > 0) {
  console.error(`M4b inventory check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `M4b inventory verified: ${actualFiles.length} files / ${actualTestCount} tests`,
);
if (process.argv.includes("--list")) {
  for (const file of expectedFiles) {
    console.log(`  ${file}: ${fileCounts.get(file)} tests`);
  }
}
