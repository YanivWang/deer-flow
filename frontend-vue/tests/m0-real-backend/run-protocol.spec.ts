/*
  【文件职责】     经 Nuxt preview 记录真实 Gateway create/resume/cancel/heartbeat/gap raw trace。
  【对应 frontend/】 frontend/src/core/api/api-client.ts
  【架构位置】     测试
  【主要导出】     @run-protocol case
  【依赖关系】     使用仓库 deterministic replay fixture
  【边界与注意】   trace 只保留事件名/id presence/status，不保存用户内容或凭据。
                   heartbeat 与 gap 依赖 run_m0_gateway.py 的保留窗口：它必须高于
                   实时突发、低于本 run 的事件总数，两侧都有显式前置断言。
*/

import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

type SseFrame = { comment?: string; event?: string; id?: string; data: string };

/** Split a raw SSE body into frames, keeping comment frames distinguishable. */
function parseFrames(raw: string): SseFrame[] {
  return raw
    .replaceAll("\r\n", "\n")
    .split("\n\n")
    .filter((frame) => frame.trim().length > 0)
    .map((frame) => {
      const lines = frame.split("\n");
      const field = (prefix: string) =>
        lines
          .find((line) => line.startsWith(prefix))
          ?.slice(prefix.length)
          .trim();
      return {
        comment: lines
          .find((line) => line.startsWith(":"))
          ?.slice(1)
          .trim(),
        event: field("event:"),
        id: field("id:"),
        data: lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n"),
      };
    });
}

const isHeartbeat = (frame: SseFrame) => frame.comment === "heartbeat";
const protocolEvents = (frames: SseFrame[]) =>
  frames.filter((frame) => frame.event !== undefined);

test("@run-protocol covers create, resume, cancel, gap and heartbeat", async ({
  context,
  page,
}, testInfo) => {
  const fixture = JSON.parse(
    readFileSync(
      "../backend/tests/fixtures/replay/write_read_file.ultra.json",
      "utf8",
    ),
  ) as { prompt: string; context: Record<string, unknown> };
  // Reuse the recording's own context verbatim, exactly as the backend golden
  // test does, so the replayed graph matches the fixture by construction.
  const runBody = {
    assistant_id: "lead_agent",
    input: { messages: [{ role: "user", content: fixture.prompt }] },
    context: fixture.context,
    stream_mode: ["values", "messages-tuple", "updates", "custom"],
    on_disconnect: "continue",
  };

  const email = `m0-run-${Date.now()}@example.com`;
  const register = await context.request.post("/api/v1/auth/register", {
    data: { email, password: "very-strong-password-123" },
  });
  expect(register.status(), await register.text()).toBe(201);
  const csrf = (await context.cookies()).find(
    ({ name }) => name === "csrf_token",
  )?.value;
  expect(csrf).toBeTruthy();

  const threadId = crypto.randomUUID();
  const thread = await context.request.post("/api/langgraph/threads", {
    headers: { "X-CSRF-Token": csrf ?? "" },
    data: { thread_id: threadId, metadata: {} },
  });
  expect(thread.status(), await thread.text()).toBe(200);

  // maxRedirects:0 is the real assertion that create is a single POST: a 307
  // from the proxy or the Gateway would surface here instead of being followed.
  const create = await context.request.post(
    `/api/langgraph/threads/${threadId}/runs/stream`,
    {
      headers: { "X-CSRF-Token": csrf ?? "" },
      data: runBody,
      maxRedirects: 0,
      timeout: 80_000,
    },
  );
  expect(create.status(), await create.text()).toBe(200);
  const contentLocation = create.headers()["content-location"];
  expect(contentLocation).toMatch(/^\/api\/threads\/[^/]+\/runs\/[^/]+$/);
  expect(create.headers().location).toBeUndefined();

  const createFrames = parseFrames(await create.text());
  const createEvents = protocolEvents(createFrames);
  const cursor = createEvents.find(({ id }) => id)?.id;
  expect(cursor).toBeTruthy();

  // Precondition: a live subscriber must never fall behind the retention window,
  // otherwise the stream is cut short and heartbeat/end can never be observed.
  expect(
    createEvents.map(({ event }) => event),
    "create stream was gapped: raise DEERFLOW_M0_QUEUE_MAXSIZE above the live burst",
  ).not.toContain("gap");
  expect(createEvents.at(-1)?.event).toBe("end");

  // The replay model idles once for DEERFLOW_M0_REPLAY_DELAY_SECONDS, which is
  // longer than the bridge heartbeat interval, so the idle window must surface
  // as at least one SSE comment frame.
  expect(
    createFrames.filter(isHeartbeat).length,
    "no heartbeat in the idle window; check DEERFLOW_M0_REPLAY_DELAY_SECONDS vs the bridge heartbeat interval",
  ).toBeGreaterThan(0);

  // Resuming from the very first cursor after the run finished must be reported
  // as a replay gap, not silently served as a partial replay.
  const publicResumePath = `/api/langgraph${contentLocation?.slice(4)}/stream`;
  const resume = await context.request.get(publicResumePath, {
    headers: { "Last-Event-ID": cursor ?? "" },
  });
  expect(resume.status(), await resume.text()).toBe(200);
  const resumeEvents = protocolEvents(parseFrames(await resume.text()));
  expect(
    resumeEvents[0]?.event,
    `expected an evicted cursor to gap; the run emitted ${createEvents.length} events, so DEERFLOW_M0_QUEUE_MAXSIZE must stay below that`,
  ).toBe("gap");
  const gapPayload = JSON.parse(resumeEvents[0]?.data ?? "{}") as {
    code?: string;
    recovery?: string;
  };
  expect(gapPayload.code).toBe("stream_replay_gap");
  expect(gapPayload.recovery).toBe("reload_durable_state");

  // Cancel is exercised from the browser so Origin, Cookie and CSRF all apply.
  // The run is still inside its idle window when cancel lands.
  const cancelThreadId = crypto.randomUUID();
  const cancelThread = await context.request.post("/api/langgraph/threads", {
    headers: { "X-CSRF-Token": csrf ?? "" },
    data: { thread_id: cancelThreadId, metadata: {} },
  });
  expect(cancelThread.status(), await cancelThread.text()).toBe(200);

  await page.goto("/");
  const cancelResult = await page.evaluate(
    async ({ body, threadId }) => {
      const csrfToken = document.cookie
        .split("; ")
        .find((value) => value.startsWith("csrf_token="))
        ?.slice("csrf_token=".length);
      const run = await fetch(
        `/api/langgraph/threads/${threadId}/runs/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken ?? "",
          },
          body: JSON.stringify(body),
        },
      );
      const contentLocation = run.headers.get("content-location");
      if (!contentLocation) {
        return { createStatus: run.status, cancelStatus: 0 };
      }
      const cancel = await fetch(
        `/api/langgraph${contentLocation.slice(4)}/cancel?wait=true&action=interrupt`,
        {
          method: "POST",
          headers: { "X-CSRF-Token": csrfToken ?? "" },
        },
      );
      await run.text();
      return { createStatus: run.status, cancelStatus: cancel.status };
    },
    { body: runBody, threadId: cancelThreadId },
  );
  expect(cancelResult.createStatus).toBe(200);
  expect(
    [200, 202, 204],
    "cancel must land while the run is still active; a 409 means the idle window closed first",
  ).toContain(cancelResult.cancelStatus);

  // Write the trace to disk rather than attaching an in-memory body: the list
  // reporter drops body attachments on a passing test, which would leave this
  // gate with no reviewable artifact at all.
  const tracePath = testInfo.outputPath("run-protocol-redacted.json");
  writeFileSync(
    tracePath,
    JSON.stringify(
      {
        create: {
          method: "POST",
          status: create.status(),
          followedRedirect: false,
          contentLocation: "present",
          location: "absent",
          eventCount: createEvents.length,
          heartbeatFrames: createFrames.filter(isHeartbeat).length,
          events: createEvents.map(({ event, id }) => ({
            event,
            id: id ? "present" : "absent",
          })),
        },
        resume: {
          method: "GET",
          status: resume.status(),
          lastEventId: "present",
          firstEvent: resumeEvents[0]?.event,
          gapCode: gapPayload.code,
          gapRecovery: gapPayload.recovery,
        },
        cancel: {
          method: "POST",
          createStatus: cancelResult.createStatus,
          status: cancelResult.cancelStatus,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await testInfo.attach("run-protocol-redacted.json", {
    path: tracePath,
    contentType: "application/json",
  });
});
