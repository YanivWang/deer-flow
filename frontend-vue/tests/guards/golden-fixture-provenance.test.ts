/*
  【文件职责】     守住签入的 golden 夹具，它的出处标签与上游实际装的版本一致。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     tests/fixtures/react-markdown-dom.json · ../frontend/node_modules/streamdown
  【边界与注意】   `react-markdown-dom.json` 是 **markdown 对齐的全部依据**——本仓渲染出来
                   的 DOM 与它比。它的 `recordedFrom` 写着「streamdown 2.5.0」，
                   **而在 wave 49 之前没有任何东西验过这句话**。

                   两个失效模式，都不会有任何门禁变红：

                   1. **上游升级、夹具没重录** → 本仓继续对着旧版本的 DOM 对齐，
                      而对照台账看不到（markdown 那一屏的差异被夹具吸收掉了）。
                   2. **重录了，但出处是假的** → 录制脚本原来把版本号**写死**在
                      字面量里（`record-react-markdown.mjs`），升级后重录会盖上一个
                      与内容不符的标签。已改成从
                      `frontend/node_modules/streamdown/package.json` 读。

                   判据只钉**版本号一致**，不钉夹具内容——内容对不对是
                   `record-react-markdown.mjs --check` 的事（它重录一遍逐字节比）。
                   这里钉的是「那份 --check 到底在跟哪个版本比」。

                   `../frontend` 缺席时整组跳过：夹具是签入的，本仓的
                   install/build/test 都不依赖兄弟应用。已声明进 `standalone-check.mjs`。
*/

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "../..");
const manifest = join(root, "../frontend/node_modules/streamdown/package.json");
const fixturePath = join(root, "tests/fixtures/react-markdown-dom.json");
const present = existsSync(manifest);

describe.skipIf(!present)("golden 夹具的出处", () => {
  const installed = present
    ? (JSON.parse(readFileSync(manifest, "utf8")) as { version?: string })
        .version
    : undefined;
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    $comment?: string;
    recordedFrom?: string;
  };

  it("读到了两边的版本（任一边空掉时不能假绿）", () => {
    expect(installed, "上游 streamdown 的 package.json 里没有 version").toMatch(
      /^\d+\.\d+\.\d+/,
    );
    expect(fixture.recordedFrom).toContain("streamdown ");
  });

  it("夹具标注的 streamdown 版本 == 上游实际装的版本", () => {
    const stamped = /streamdown (\d+\.\d+\.\d+[^\s·]*)/.exec(
      fixture.recordedFrom ?? "",
    )?.[1];
    expect(
      stamped,
      `夹具录自 streamdown ${stamped}，上游现在装的是 ${installed}。` +
        "重录：`node scripts/record-react-markdown.mjs`（它会把新版本号一起写进出处）。",
    ).toBe(installed);
  });

  it("$comment 里的版本号与 recordedFrom 一致（两处不许各说各的）", () => {
    const inComment = /streamdown@(\d+\.\d+\.\d+[^\s`]*)/.exec(
      fixture.$comment ?? "",
    )?.[1];
    const stamped = /streamdown (\d+\.\d+\.\d+[^\s·]*)/.exec(
      fixture.recordedFrom ?? "",
    )?.[1];
    expect(inComment).toBe(stamped);
  });
});
