#!/usr/bin/env node
/*
  【文件职责】     执行产品 Vue SFC 英文硬编码阻断门禁。
  【架构位置】     构建脚本
  【主要导出】     CLI
  【依赖关系】     scripts/lib/i18n-source-guard.mjs
  【边界与注意】   --inventory 输出完整分类；门禁不维护按组件放行的大 allowlist。

                   **先判扫描面盖全了没有，再判扫到的干不干净。** 否则这句
                   "product Vue SFCs contain no core English literals" 说的
                   只是「我读过的那些没有」——wave 84 实测过，一个
                   `app/error.vue` 就能让它在四道门禁全绿的情况下变成假话。
*/

import {
  productVueInventory,
  scanProductVueFiles,
} from "./lib/i18n-source-guard.mjs";

if (process.argv.includes("--inventory")) {
  const inventory = productVueInventory();
  process.stdout.write(
    `${JSON.stringify(
      {
        checkedLocalizedOrDynamicProductSfc: inventory.checked,
        excludedTestFixtureSfc: inventory.excludedTestFixtures,
        unscannedSfc: inventory.unscanned,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

const { unscanned } = productVueInventory();
if (unscanned.length) {
  for (const file of unscanned) process.stderr.write(`${file}\n`);
  process.stderr.write(
    `i18n source guard failed: ${unscanned.length} Vue SFC(s) outside the scanned roots. ` +
      "Add the directory to PRODUCT_ROOTS, or say why it is not product UI.\n",
  );
  process.exit(1);
}

const issues = scanProductVueFiles();
if (issues.length) {
  for (const issue of issues) {
    process.stderr.write(
      `${issue.filename}:${issue.line} [${issue.kind}] ${JSON.stringify(issue.text)}\n`,
    );
  }
  process.stderr.write(
    `i18n source guard failed: ${issues.length} user-visible English literal(s).\n`,
  );
  process.exit(1);
}
process.stdout.write(
  "i18n source guard passed: product Vue SFCs contain no core English literals\n",
);
