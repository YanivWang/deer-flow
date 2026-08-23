#!/usr/bin/env node
/*
  【文件职责】     执行 WP-12 产品 Vue SFC 英文硬编码阻断门禁。
  【对应 frontend/】 无；Vue-owned maintenance gate
  【架构位置】     构建脚本
  【主要导出】     CLI
  【依赖关系】     scripts/lib/i18n-source-guard.mjs
  【边界与注意】   --inventory 输出完整分类；门禁不维护按组件放行的大 allowlist。
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
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
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
