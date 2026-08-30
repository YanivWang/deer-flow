/*
  打开线程时那一次 checkpoint 取数的协议：打哪条路由、从响应里取哪一份 values。

  三条判据都来自读后端 + 实测（wave 7 定路由，wave 8 定形状）：
  - 路由必须是 `POST /history`。后端只有 `get_thread_history` 会把 run 身份写回
    消息（`msg.setdefault("run_id", …)` + `stamp_turn_duration_on_last_ai`）；
    `get_thread_state` 只做一次 `serialize_channel_values_for_api`，两个字段都没有。
  - 只取数组第一条：后端注释写明只有最新（第一条）checkpoint 带 `messages`，
    SDK 取的 `flatHistory.at(-1)` 在 `limit: 1` 时同指这一条。
  - 没有 checkpoint 时返回 `undefined` 而不是 `{}`：`{}` 喂进 reducer 是一帧
    「全量替换成空」，会把 store 清空。
*/
import { describe, expect, it } from "vitest";

import {
  buildThreadCheckpointSeedUrl,
  checkpointSeedValues,
} from "@/core/threads/checkpoint-seed";

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

describe("checkpoint seed values", () => {
  it("takes the first entry's values", () => {
    expect(
      checkpointSeedValues([
        { values: { title: "latest", messages: [{ id: "m1" }] } },
        { values: { title: "older", messages: [{ id: "older" }] } },
      ]),
    ).toEqual({ title: "latest", messages: [{ id: "m1" }] });
  });

  it("passes every channel through instead of picking known keys", () => {
    // 后端加一个通道时这里不能静默丢掉它——`values` 对 reducer 是全量替换，
    // 少一个键就是把那个通道清空。
    const values = checkpointSeedValues([
      { values: { messages: [], thread_data: { a: 1 }, brand_new: "keep" } },
    ]);
    expect(values).toEqual({
      messages: [],
      thread_data: { a: 1 },
      brand_new: "keep",
    });
  });

  it("returns undefined when there is no checkpoint at all", () => {
    // `[]` 是「这条线程还没有 checkpoint」的正常回答（压缩前的新线程就是这样），
    // 不是错误；返回 `{}` 会让种子把 store 清空。
    expect(checkpointSeedValues([])).toBeUndefined();
    expect(checkpointSeedValues([{}])).toBeUndefined();
  });

  it("returns undefined for a malformed payload", () => {
    expect(checkpointSeedValues(null)).toBeUndefined();
    expect(checkpointSeedValues({ values: {} })).toBeUndefined();
    expect(checkpointSeedValues([{ values: null }])).toBeUndefined();
    expect(checkpointSeedValues([{ values: "nope" }])).toBeUndefined();
    expect(checkpointSeedValues([{ values: [1, 2] }])).toBeUndefined();
  });
});
