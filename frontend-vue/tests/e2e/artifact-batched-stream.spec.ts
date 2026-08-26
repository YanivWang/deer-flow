import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { expect, test } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";
import { artifactEditorInput } from "../support/artifact-editor";

const THREAD_ID = "00000000-0000-0000-0000-000000004354";
const RUN_ID = "00000000-0000-0000-0000-000000004355";
const MISSING_PATH_THREAD_ID = "00000000-0000-0000-0000-000000004356";
const POLICY_THREAD_ID = "00000000-0000-0000-0000-000000004357";
const DIRTY_THREAD_ID = "00000000-0000-0000-0000-000000004358";
const ARTIFACT_PATH = "/artifact-fixtures/batched-report.md";

const INITIAL_MESSAGES = [
  {
    type: "human",
    id: "msg-human-batched-artifact",
    content: [{ type: "text", text: "Create a batched markdown report" }],
  },
];

function batchedWriteFileStreamFrames() {
  const chunks = [
    {
      content: "",
      additional_kwargs: {},
      response_metadata: {},
      type: "AIMessageChunk",
      name: null,
      id: "msg-ai-batched-artifact",
      tool_calls: [
        {
          name: "write_file",
          args: { path: ARTIFACT_PATH, content: "Hello " },
          id: "call-batched-artifact",
          type: "tool_call",
        },
      ],
      invalid_tool_calls: [],
      usage_metadata: null,
      tool_call_chunks: [
        {
          name: "write_file",
          args: `{"path":"${ARTIFACT_PATH}","content":"Hello `,
          id: "call-batched-artifact",
          index: 0,
          type: "tool_call_chunk",
        },
      ],
      chunk_position: null,
    },
    {
      content: "",
      additional_kwargs: {},
      response_metadata: {},
      type: "AIMessageChunk",
      name: null,
      id: "msg-ai-batched-artifact",
      tool_calls: [],
      invalid_tool_calls: [
        {
          name: null,
          args: 'world"}',
          id: null,
          error: null,
          type: "invalid_tool_call",
        },
      ],
      usage_metadata: null,
      tool_call_chunks: [
        {
          name: null,
          args: 'world"}',
          id: null,
          index: 0,
          type: "tool_call_chunk",
        },
      ],
      chunk_position: null,
    },
  ];
  const events = [
    {
      event: "metadata",
      data: { run_id: RUN_ID, thread_id: THREAD_ID },
    },
    {
      event: "values",
      data: {
        messages: [
          ...INITIAL_MESSAGES,
          {
            type: "human",
            id: "msg-human-batched-artifact-follow-up",
            content: [{ type: "text", text: "Continue the report" }],
          },
        ],
      },
    },
    ...chunks.map((chunk) => ({ event: "messages", data: [chunk, {}] })),
  ];

  return events.map(
    (event) => `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`,
  );
}

async function startBatchedWriteFileStreamServer() {
  const frames = batchedWriteFileStreamFrames();
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      // The production Gateway exposes this durable run handle. The shared
      // React fixture omits it because its SDK reads the metadata frame.
      "Content-Location": `/api/threads/${THREAD_ID}/runs/${RUN_ID}`,
      "Access-Control-Expose-Headers": "Content-Location",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
    });
    response.write(frames.slice(0, 3).join(""));

    const nextBatch = setTimeout(() => {
      response.write(frames[3]);
    }, 300);
    const finishStream = setTimeout(() => {
      response.end("event: end\ndata: {}\n\n");
    }, 2_000);
    response.once("close", () => {
      clearTimeout(nextBatch);
      clearTimeout(finishStream);
    });
  });

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => reject(error);
    server.once("error", handleError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", handleError);
      resolve();
    });
  });

  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/runs/stream`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

test("assembles streamed write-file argument deltas in the artifact preview", async ({
  page,
}) => {
  let streamStarted = false;
  let releasePostStreamHistory!: () => void;
  const postStreamHistoryReleased = new Promise<void>((resolve) => {
    releasePostStreamHistory = resolve;
  });
  const streamServer = await startBatchedWriteFileStreamServer();
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: THREAD_ID,
        title: "Batched artifact streaming",
        messages: INITIAL_MESSAGES,
      },
    ],
  });
  await page.route("**/api/langgraph/threads/*/history", async (route) => {
    if (streamStarted) {
      await postStreamHistoryReleased;
    }
    return route.fallback();
  });
  await page.route("**/api/langgraph/threads/*/runs/stream", (route) => {
    streamStarted = true;
    return route.continue({ url: streamServer.url });
  });

  try {
    await page.goto(`/workspace/chats/${THREAD_ID}`);

    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.fill("Continue the report");
    await textarea.press("Enter");

    await expect(page.getByText(ARTIFACT_PATH)).toBeVisible({
      timeout: 10_000,
    });

    const artifactsPanel = page.locator("#artifacts");
    await expect(artifactsPanel).toBeVisible();
    await expect(artifactsPanel.getByText("batched-report.md")).toBeVisible();
    await expect(artifactsPanel.getByText("Hello world")).toBeVisible();
  } finally {
    releasePostStreamHistory();
    await streamServer.close();
  }
});

test("does not open an artifact for a file tool call without a path", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MISSING_PATH_THREAD_ID,
        title: "File tool without a path",
        messages: [
          ...INITIAL_MESSAGES,
          {
            type: "ai",
            id: "msg-ai-missing-path",
            content: "",
            tool_calls: [
              {
                id: "call-missing-path",
                name: "write_file",
                args: { description: "Write file" },
              },
            ],
          },
        ],
      },
    ],
  });

  await page.goto(`/workspace/chats/${MISSING_PATH_THREAD_ID}`);

  const writeFileStep = page.getByText("Write file", { exact: true });
  await expect(writeFileStep).toBeVisible({ timeout: 15_000 });
  await writeFileStep.click();
  await expect(page.locator("#artifacts")).toBeHidden();
});

test("fails closed for Office/archive files and requires a full D3-valid HTML response", async ({
  page,
}) => {
  const docx = "/mnt/user-data/outputs/report.docx";
  const archive = "/mnt/user-data/outputs/bundle.zip";
  const html = "/mnt/user-data/outputs/large.html";
  const completeHtml =
    "<!doctype html><html><head><style>body{color:red}</style></head><body>complete</body></html>";
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: POLICY_THREAD_ID,
        title: "Artifact file policy",
        messages: INITIAL_MESSAGES,
        artifacts: [docx, archive, html],
      },
    ],
  });
  let nonTextLoads = 0;
  await page.route("**/api/threads/*/artifacts/**", async (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("report.docx") || url.includes("bundle.zip")) {
      nonTextLoads += 1;
      return route.fulfill({ status: 500, body: "must not load" });
    }
    if (url.includes("large.html")) {
      const range = route.request().headers().range;
      if (range) {
        return route.fulfill({
          status: 206,
          contentType: "text/html",
          headers: {
            "Content-Range": `bytes 0-${completeHtml.length - 1}/2000000`,
          },
          body: completeHtml,
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: completeHtml,
      });
    }
    return route.fallback();
  });

  await page.goto(`/workspace/chats/${POLICY_THREAD_ID}`);
  // 头部入口只把面板打开，不替用户选文件（React 的 ArtifactTrigger 同理），
  // 所以要先从清单里点开一个才进详情。
  await page.getByTestId("artifact-trigger").click();
  await page.getByTestId("artifact-overview").getByText("report.docx").click();
  const panel = page.locator("#artifacts");
  await expect(panel.getByText("Download-only file.")).toBeVisible();
  await expect(panel.getByLabel("Edit", { exact: true })).toHaveCount(0);

  await panel.getByRole("combobox").click();
  await panel.getByRole("option", { name: "bundle.zip" }).click();
  await expect(panel.getByText("Download-only file.")).toBeVisible();
  expect(nonTextLoads).toBe(0);

  await panel.getByRole("combobox").click();
  await panel.getByRole("option", { name: "large.html" }).click();
  await expect(panel.getByLabel("Load full file")).toBeVisible();
  await expect(panel.locator("iframe[title='Artifact preview']")).toHaveCount(
    0,
  );
  await expect(panel.getByTestId("artifact-editor")).toHaveCount(0);
  await panel.getByLabel("Load full file").click();
  await expect(panel.locator("iframe[title='Artifact preview']")).toBeVisible();
});

test("uses the same dirty guard for file switch and panel close", async ({
  page,
}) => {
  const first = "/mnt/user-data/outputs/first.txt";
  const second = "/mnt/user-data/outputs/second.txt";
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: DIRTY_THREAD_ID,
        title: "Artifact dirty lifecycle",
        messages: INITIAL_MESSAGES,
        artifacts: [first, second],
      },
    ],
  });
  await page.route("**/api/threads/*/artifacts/**", (route) => {
    const content = decodeURIComponent(route.request().url()).includes(
      "second.txt",
    )
      ? "second"
      : "first";
    return route.fulfill({
      status: 200,
      contentType: "text/plain",
      headers: { ETag: `"${"a".repeat(64)}"` },
      body: content,
    });
  });

  await page.goto(`/workspace/chats/${DIRTY_THREAD_ID}`);
  await page.getByTestId("artifact-trigger").click();
  await page.getByTestId("artifact-overview").getByText("first.txt").click();
  const panel = page.locator("#artifacts");
  await panel.getByLabel("Edit", { exact: true }).click();
  await artifactEditorInput(panel).fill("dirty draft");

  page.once("dialog", (dialog) => dialog.dismiss());
  await panel.getByRole("combobox").click();
  await panel.getByRole("option", { name: "second.txt" }).click();
  await expect(artifactEditorInput(panel)).toHaveText("dirty draft");
  await expect(panel.getByRole("combobox")).toContainText("first.txt");

  page.once("dialog", (dialog) => dialog.accept());
  await panel.getByLabel("Close", { exact: true }).click();
  await expect(panel).toBeHidden();
});
