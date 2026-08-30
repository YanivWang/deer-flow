/*
  事件库为空时那一支的取数协议：打哪条路由、以及 run 身份从哪来。

  两条判据都来自实测（wave 7）：
  - 路由必须是 `POST /history`。后端只有 `get_thread_history` 会把 run 身份写回
    消息（`msg.setdefault("run_id", …)` + `stamp_turn_duration_on_last_ai`）；
    `get_thread_state` 只做一次 `serialize_channel_values_for_api`，两个字段都没有。
  - **没有 run 身份时不能造一个。** 造出来的 id 会被 WorkspaceChangesBadge 当成
    真 run 发请求；实测 browser-feature 场景里 Vue 因此比 React 多发了一条
    `/runs/state-<threadId>/workspace-changes`。
*/
import { describe, expect, it } from "vitest";

import {
  buildThreadCheckpointSeedUrl,
  checkpointSeedRows,
} from "@/core/threads/history";

describe("checkpoint seed url", () => {
  it("posts to /history, not /state", () => {
    expect(buildThreadCheckpointSeedUrl("", "t-1")).toBe(
      "/api/langgraph/threads/t-1/history",
    );
    expect(buildThreadCheckpointSeedUrl("http://gw/", "t-1")).toBe(
      "http://gw/api/langgraph/threads/t-1/history",
    );
  });

  it("encodes the thread id", () => {
    expect(buildThreadCheckpointSeedUrl("", "a/b?c")).toBe(
      "/api/langgraph/threads/a%2Fb%3Fc/history",
    );
  });
});

describe("checkpoint seed rows", () => {
  it("reads the latest entry's messages and keeps their order", () => {
    const rows = checkpointSeedRows([
      {
        values: {
          messages: [
            { id: "m1", type: "human", content: "q" },
            { id: "m2", type: "ai", content: "a" },
          ],
        },
      },
      { values: { messages: [{ id: "older", type: "ai", content: "x" }] } },
    ]);
    expect(rows.map((row) => row.content.id)).toEqual(["m1", "m2"]);
    expect(rows.map((row) => row.seq)).toEqual([1, 2]);
    expect(rows.every((row) => row.metadata.caller === "lead_agent")).toBe(
      true,
    );
  });

  it("takes the run id the backend stamped on ai/tool messages", () => {
    const rows = checkpointSeedRows([
      { values: { messages: [{ id: "m", type: "ai", run_id: "run-7" }] } },
    ]);
    expect(rows[0]?.run_id).toBe("run-7");
  });

  it("takes a human message's run id from additional_kwargs", () => {
    const rows = checkpointSeedRows([
      {
        values: {
          messages: [
            { id: "m", type: "human", additional_kwargs: { run_id: "run-9" } },
          ],
        },
      },
    ]);
    expect(rows[0]?.run_id).toBe("run-9");
  });

  it("leaves the run id empty rather than inventing one", () => {
    const rows = checkpointSeedRows([
      { values: { messages: [{ id: "m", type: "ai", content: "a" }] } },
    ]);
    // 空串是「这条消息不属于任何已知 run」的真实答案；徽章的
    // `enabled: Boolean(props.runId && …)` 会照此停住，不发请求。
    expect(rows[0]?.run_id).toBe("");
    expect(rows[0]?.run_id).not.toContain("state-");
  });

  it("ignores a non-string run id instead of stringifying it", () => {
    const rows = checkpointSeedRows([
      { values: { messages: [{ id: "m", type: "ai", run_id: 42 }] } },
    ]);
    expect(rows[0]?.run_id).toBe("");
  });

  it("survives an empty, malformed or message-less payload", () => {
    expect(checkpointSeedRows([])).toEqual([]);
    expect(checkpointSeedRows(null)).toEqual([]);
    expect(checkpointSeedRows([{}])).toEqual([]);
    expect(checkpointSeedRows([{ values: {} }])).toEqual([]);
    expect(checkpointSeedRows([{ values: { messages: "nope" } }])).toEqual([]);
    expect(checkpointSeedRows([{ values: { messages: [null] } }])).toHaveLength(
      1,
    );
  });
});
