/*
  【文件职责】     artifact URL 组装的行为测试。
  【对应 frontend/】 frontend/tests/unit/core/artifacts/utils.test.ts
  【架构位置】     单元测试
  【主要导出】     无
  【依赖关系】     app/core/artifacts/utils.ts
  【边界与注意】   **手工维护，不再由 codemod 生成**（登记在 rstest-to-vitest.mjs 的
                   HAND_MAINTAINED）。相对上游有两处删减与一处 Vue-owned 增补：

                   1. 删掉 2 个 static demo 用例
                      （"maps static demo artifact paths…" / "encodes reserved characters
                      in static demo artifact URLs"）。它们测的是 `isStaticWebsiteOnly()`
                      早返回，而 01-scope 已把静态模式排除出迁移范围，
                      `app/core/artifacts/utils.ts` 落地时按 06 §M1 1b 删掉了该分支。
                      留着就是在测一段**故意不存在**的行为。

                   2. 删掉整套 NEXT_PUBLIC_* 环境变量夹具。上游靠 `process.env` 读配置，
                      我们改成了注入 runtime options（08 §Runtime config），
                      这套夹具在 Nuxt 侧一个字节都读不到，留着会让人以为测试隔离了配置。
                      `loadFreshArtifactUtils()` 的 `vi.resetModules()` 已经保证
                      每个用例拿到全新的 config 模块，隔离由它负责。

                   3. 增补显式 isMock 图片解析，证明 showcase 不会落到生产 artifact API。

                   其余用例逐字保留——它们才是「语义没走形」的证据。
*/

import { describe, expect, test, vi } from "vitest";

async function loadFreshArtifactUtils() {
  vi.resetModules();
  return await import("@/core/artifacts/utils");
}

describe("artifact URL helpers", () => {
  test("encodes reserved characters in artifact URL path segments", async () => {
    const { resolveArtifactURL, urlOfArtifact } =
      await loadFreshArtifactUtils();

    expect(
      urlOfArtifact({
        filepath: "/mnt/user-data/outputs/a#b?.txt",
        threadId: "thread #1",
        download: true,
      }),
    ).toBe(
      "/api/threads/thread%20%231/artifacts/mnt/user-data/outputs/a%23b%3F.txt?download=true",
    );
    expect(
      urlOfArtifact({
        filepath: "/mnt/user-data/outputs/a#b?.txt",
        threadId: "thread #1",
        isMock: true,
      }),
    ).toBe(
      "/mock/api/threads/thread%20%231/artifacts/mnt/user-data/outputs/a%23b%3F.txt",
    );
    expect(
      resolveArtifactURL("/mnt/user-data/outputs/中 文#?.png", "thread #1"),
    ).toBe(
      "/api/threads/thread%20%231/artifacts/mnt/user-data/outputs/%E4%B8%AD%20%E6%96%87%23%3F.png",
    );
    expect(
      resolveArtifactURL("/mnt/user-data/outputs/a%23b%3F.txt", "thread-1"),
    ).toBe(
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/a%23b%3F.txt",
    );
  });

  test("preserves markdown query and fragment suffixes on artifact URLs", async () => {
    const { resolveMarkdownArtifactURL, resolveMessageImageURL } =
      await loadFreshArtifactUtils();

    expect(
      resolveMarkdownArtifactURL(
        "/mnt/user-data/outputs/chart.png?v=2#detail",
        "thread-1",
      ),
    ).toBe(
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/chart.png?v=2#detail",
    );
    expect(
      resolveMessageImageURL(
        "/mnt/user-data/outputs/a%23b%3F.png?v=2#detail",
        "thread-1",
        [],
      ),
    ).toBe(
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/a%23b%3F.png?v=2#detail",
    );
  });

  test("returns stable artifact path references", async () => {
    const { extractArtifactsFromThread } = await loadFreshArtifactUtils();
    const threadWithoutArtifacts = { values: {} };
    const artifacts = ["/mnt/user-data/outputs/chart.png"];

    expect(extractArtifactsFromThread(threadWithoutArtifacts)).toBe(
      extractArtifactsFromThread(threadWithoutArtifacts),
    );
    expect(extractArtifactsFromThread({ values: { artifacts } })).toBe(
      artifacts,
    );
  });

  test("resolves absolute and relative message image paths", async () => {
    const { resolveMessageImageURL } = await loadFreshArtifactUtils();
    const artifacts = [
      "/mnt/user-data/outputs/aws-agent-overview.png",
      "/mnt/user-data/outputs/aws-agent-console-config.png",
      "/mnt/user-data/outputs/chart.png",
      "/mnt/user-data/outputs/a#b?.png",
    ];

    expect(
      resolveMessageImageURL("aws-agent-overview.png", "thread-1", artifacts),
    ).toBe(
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/aws-agent-overview.png",
    );
    expect(
      resolveMessageImageURL(
        "./aws-agent-overview.png#detail",
        "thread-1",
        artifacts,
      ),
    ).toBe(
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/aws-agent-overview.png#detail",
    );
    expect(
      resolveMessageImageURL(
        "/mnt/user-data/outputs/chart.png",
        "thread-1",
        artifacts,
      ),
    ).toBe("/api/threads/thread-1/artifacts/mnt/user-data/outputs/chart.png");
    expect(
      resolveMessageImageURL("outputs/chart.png", "thread-1", artifacts),
    ).toBe("/api/threads/thread-1/artifacts/mnt/user-data/outputs/chart.png");
    expect(
      resolveMessageImageURL("a%23b%3F.png#detail", "thread-1", artifacts),
    ).toBe(
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/a%23b%3F.png#detail",
    );
  });

  test("does not rewrite unregistered, ambiguous, or external message images", async () => {
    const { resolveMessageImageURL } = await loadFreshArtifactUtils();

    expect(resolveMessageImageURL("missing.png", "thread-1", [])).toBe(
      "missing.png",
    );
    expect(
      resolveMessageImageURL("shared.png", "thread-1", [
        "/mnt/user-data/outputs/first/shared.png",
        "/mnt/user-data/outputs/second/shared.png",
      ]),
    ).toBe("shared.png");
    expect(
      resolveMessageImageURL("../etc/secret.png", "thread-1", [
        "/mnt/user-data/outputs/secret.png",
      ]),
    ).toBe("../etc/secret.png");
    expect(
      resolveMessageImageURL("https://example.com/image.png", "thread-1", [
        "/mnt/user-data/outputs/image.png",
      ]),
    ).toBe("https://example.com/image.png");
  });

  test("can fallback relative message images to the outputs directory", async () => {
    const { resolveMessageImageURL } = await loadFreshArtifactUtils();

    expect(
      resolveMessageImageURL("anime-beauty.jpg", "thread-1", [], {
        fallbackToOutputs: true,
      }),
    ).toBe(
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/anime-beauty.jpg",
    );
    expect(
      resolveMessageImageURL(
        "./charts/anime-beauty.jpg#preview",
        "thread-1",
        [],
        {
          fallbackToOutputs: true,
        },
      ),
    ).toBe(
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/charts/anime-beauty.jpg#preview",
    );
    expect(
      resolveMessageImageURL("../anime-beauty.jpg", "thread-1", [], {
        fallbackToOutputs: true,
      }),
    ).toBe("../anime-beauty.jpg");
    expect(
      resolveMessageImageURL("https://example.com/image.png", "thread-1", [], {
        fallbackToOutputs: true,
      }),
    ).toBe("https://example.com/image.png");
  });

  test("routes showcase markdown images through the explicit mock transport", async () => {
    const { resolveMessageImageURL } = await loadFreshArtifactUtils();

    expect(
      resolveMessageImageURL(
        "chart.png#preview",
        "demo-thread",
        ["/mnt/user-data/outputs/chart.png"],
        { fallbackToOutputs: true, isMock: true },
      ),
    ).toBe(
      "/mock/api/threads/demo-thread/artifacts/mnt/user-data/outputs/chart.png#preview",
    );
    expect(
      resolveMessageImageURL("missing.png", "demo-thread", [], {
        fallbackToOutputs: true,
        isMock: true,
      }),
    ).toBe(
      "/mock/api/threads/demo-thread/artifacts/mnt/user-data/outputs/missing.png",
    );
  });

  test("builds encoded write-file URLs without undefined query parameters", async () => {
    const { buildWriteFileArtifactURL } = await loadFreshArtifactUtils();
    const filepath = "/mnt/user-data/outputs/a b#c?%20.md";
    expect(
      buildWriteFileArtifactURL({
        filepath: "/mnt/user-data/outputs/report.md",
        messageId: "ai-1",
        toolCallId: "call-1",
      }),
    ).toBe(
      "write-file:/mnt/user-data/outputs/report.md?message_id=ai-1&tool_call_id=call-1",
    );

    const withIds = new URL(
      buildWriteFileArtifactURL({
        filepath,
        messageId: "message #1",
        toolCallId: "call ?1",
      }),
    );
    expect(decodeURIComponent(withIds.pathname)).toBe(filepath);
    expect(withIds.searchParams.get("message_id")).toBe("message #1");
    expect(withIds.searchParams.get("tool_call_id")).toBe("call ?1");

    const withoutIds = buildWriteFileArtifactURL({ filepath });
    expect(withoutIds).not.toContain("undefined");
    expect(new URL(withoutIds).search).toBe("");
  });
});
