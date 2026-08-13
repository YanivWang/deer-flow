import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import { mergeLoopbackNoProxy } from "./with-loopback-no-proxy.mjs";

const require = createRequire(import.meta.url);
const inventory = JSON.parse(
  readFileSync(new URL("../tests/m7-inventory.json", import.meta.url), "utf8"),
);
const listed = spawnSync(
  process.execPath,
  [
    require.resolve("@playwright/test/cli"),
    "test",
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

const expected = [...inventory.specFiles].sort();
const actual = [...fileCounts.keys()].sort();
const testCount = [...fileCounts.values()].reduce(
  (sum, count) => sum + count,
  0,
);
const errors = [];
if (inventory.expectedFileCount !== expected.length)
  errors.push("manifest file count mismatch");
if (new Set(expected).size !== expected.length)
  errors.push("manifest contains duplicate specs");
if (JSON.stringify(expected) !== JSON.stringify(actual))
  errors.push(
    `spec drift: expected ${expected.join(", ")}; actual ${actual.join(", ")}`,
  );
if (testCount !== inventory.expectedTestCount)
  errors.push(
    `test drift: expected ${inventory.expectedTestCount}; actual ${testCount}`,
  );
if (errors.length) {
  console.error(`M7 inventory check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(
  `M7 shared inventory verified: ${actual.length} files / ${testCount} tests`,
);
if (process.argv.includes("--list")) {
  for (const file of expected)
    console.log(`  ${file}: ${fileCounts.get(file)} tests`);
}
