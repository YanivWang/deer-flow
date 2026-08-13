import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { mergeLoopbackNoProxy } from "./with-loopback-no-proxy.mjs";

const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");
const inventory = JSON.parse(
  readFileSync(
    new URL("../tests/m7-local-inventory.json", import.meta.url),
    "utf8",
  ),
);
const listed = spawnSync(
  process.execPath,
  [
    playwrightCli,
    "test",
    "-c",
    "playwright.m7-local.config.ts",
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
    fileCounts.set(
      spec.file,
      (fileCounts.get(spec.file) ?? 0) + spec.tests.length,
    );
  }
  for (const child of suite.suites ?? []) collect(child);
}
for (const suite of report.suites ?? []) collect(suite);
const expectedFiles = [...inventory.specFiles].sort();
const actualFiles = [...fileCounts.keys()].sort();
const actualTests = [...fileCounts.values()].reduce(
  (sum, count) => sum + count,
  0,
);
const errors = [];
if (inventory.expectedFileCount !== expectedFiles.length)
  errors.push("manifest file count does not match specFiles");
if (new Set(expectedFiles).size !== expectedFiles.length)
  errors.push("manifest contains duplicate specs");
if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles))
  errors.push(
    `spec drift: expected ${expectedFiles.join(", ")}; actual ${actualFiles.join(", ")}`,
  );
if (actualTests !== inventory.expectedTestCount)
  errors.push(
    `test drift: expected ${inventory.expectedTestCount}; actual ${actualTests}`,
  );
if (errors.length) {
  console.error(`M7 local inventory check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(
  `M7 local inventory verified: ${actualFiles.length} files / ${actualTests} tests`,
);
if (process.argv.includes("--list")) {
  for (const file of expectedFiles)
    console.log(`  ${file}: ${fileCounts.get(file)} tests`);
}
