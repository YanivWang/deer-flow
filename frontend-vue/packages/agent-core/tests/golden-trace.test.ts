/*
  【文件职责】     用真实录制的 raw SSE 跑通分帧层（06 §M2 B 的第 2 类证据）。
  【架构位置】     L1 测试
  【主要导出】     无
  【依赖关系】     ../../../tests/fixtures/streams/*.sse
  【边界与注意】   这份 fixture 是**经 Nuxt proxy 从真实 Gateway 录下来的**，
                   不是手写的。手写的 SSE 只能验证「我以为后端长这样」，
                   录制的能验证「后端确实长这样」——两者的区别正是 05 L14
                   在说的事。录制与去敏方式见 fixture 目录的 README。

                   本文件只断言**分帧层**看到了什么。事件语义（哪个是终止、
                   哪个是缺口）属于 L3，在 agent-deerflow 的测试里。这条边界
                   要守住：一旦在这里写下 `event === "end"`，L1 就认识
                   DeerFlow 的 wire 事件名了。

                   ⚠️ 跨 chunk 的切分在这里是**人为制造**的：录制拿到的是完整
                   响应体，真实的 TCP 分片没有被记录下来。所以这份证据能验分帧
                   与顺序，不能验「真实网络下的 chunk 边界」——那是第 4 类证据。
*/

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readSseFrames } from "../src/transport/read-sse-frames";
import type { SseFrame } from "../src/transport/sse-event";

import { bytesOf, collect, streamOf } from "./helpers";

const fixture = (name: string) =>
  readFileSync(
    new URL(`../../../tests/fixtures/streams/${name}`, import.meta.url),
    "utf8",
  );

const CREATE = fixture("deerflow-create.sse");
const RESUME_GAP = fixture("deerflow-resume-gap.sse");

const read = (chunks: readonly (string | Uint8Array)[]) =>
  collect(readSseFrames(streamOf(chunks), { maxBufferBytes: 4 * 1024 * 1024 }));

const namesOf = (frames: SseFrame[]) =>
  frames.flatMap((f) => (f.kind === "event" ? [f.event.event] : []));

describe("真实 create 流", () => {
  it("整体读一遍：226 个事件 + 1 个心跳帧", async () => {
    const frames = await read([CREATE]);
    const events = frames.filter((f) => f.kind === "event");
    const heartbeats = frames.filter((f) => f.kind === "heartbeat");
    expect(events).toHaveLength(226);
    expect(heartbeats).toHaveLength(1);
    expect(heartbeats[0]).toEqual({ kind: "heartbeat", comment: "heartbeat" });
  });

  it("事件名的分布与录制一致", async () => {
    const counts = namesOf(await read([CREATE])).reduce<Record<string, number>>(
      (acc, name) => ({ ...acc, [name]: (acc[name] ?? 0) + 1 }),
      {},
    );
    expect(counts).toEqual({
      metadata: 1,
      values: 13,
      updates: 50,
      messages: 9,
      checkpoints: 52,
      tasks: 100,
      end: 1,
    });
  });

  it("225 个帧带 id，最后一个不带——终止帧没有游标", async () => {
    const events = (await read([CREATE])).flatMap((f) =>
      f.kind === "event" ? [f.event] : [],
    );
    const withId = events.filter((e) => e.id !== undefined);
    expect(withId).toHaveLength(225);
    // 这条不是凑数：续传游标只能取自带 id 的帧。如果实现「记住最后一帧的 id」，
    // 终止帧会把游标覆盖成 undefined，重连就退回从头开始。
    expect(events.at(-1)?.id).toBeUndefined();
    expect(events.at(-2)?.id).toBeDefined();
  });

  it("id 是单调递增的 bridge 游标", async () => {
    const ids = (await read([CREATE])).flatMap((f) =>
      f.kind === "event" && f.event.id !== undefined ? [f.event.id] : [],
    );
    const seq = ids.map((id) => Number(id.split("-")[1]));
    expect(seq).toEqual([...seq].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每个 data 都是完整 JSON——多行拼接没有把载荷切坏", async () => {
    for (const frame of await read([CREATE])) {
      if (frame.kind !== "event") continue;
      expect(() => JSON.parse(frame.event.data)).not.toThrow();
    }
  });

  it("逐字节喂进去，结果与整体读一致", async () => {
    // 最狠的一种切分：每个 chunk 一个字节，所有分隔符与多字节字符都被切开。
    //
    // 录制加进 checkpoints/tasks 之后从 53KB 涨到 1.1MB，而**逐字节的代价是超线性的**：
    // 每来一个字节都要在累积 buffer 上找一次分隔符，而 checkpoints 帧单帧就有 ~16KB。
    // 实测整份 2.1MB 版本跑 42 秒仍未跑完。所以逐字节只跑**前 64KB**——
    // 它含 6 种事件的完整帧，也含第一个多字节字符（第 28,352 字节），
    // 正是这条用例要打的两个点。整份改用 997 字节定长切：质数长度保证切点不会与
    // 任何帧长对齐，分隔符与多字节字符照样被切开，但读的次数降到千级。
    const bytes = bytesOf(CREATE);
    const head = bytes.slice(0, 64 * 1024);
    const byteChunks = Array.from({ length: head.length }, (_, i) =>
      head.slice(i, i + 1),
    );
    const headNames = namesOf(await read([head]));
    expect(namesOf(await read(byteChunks))).toEqual(headNames);
    // 前 64KB 必须真的含多种事件，否则上面那条退化成只验了几帧。
    expect(new Set(headNames).size).toBeGreaterThanOrEqual(5);

    const stride = 997;
    const chunks = Array.from(
      { length: Math.ceil(bytes.length / stride) },
      (_, i) => bytes.slice(i * stride, i * stride + stride),
    );
    expect(namesOf(await read(chunks))).toEqual(namesOf(await read([CREATE])));
    /*
      显式超时，不吃 vitest 的 5 秒默认值。这条用例是整个套件里最贵的一条，而且是
      故意的：65,536 个单字节 chunk 加一遍 2.1MB 定长切，空载实测 1,388ms，同文件
      另外 8 条加起来 44ms。5 秒只留了 3.6 倍余量，而单测常常与 e2e/parity 抢机器
      ——2026-08-30 一天之内就因此在 `make verify` 里假红了两次（两次都是并发跑别的
      套件时），单独重跑必过。把余量按这条用例真实的量级定成 20 倍。
    */
  }, 30_000);

  it("按 CRLF 重放也得到同一批帧（经代理后可能变成 CRLF）", async () => {
    const crlf = CREATE.replaceAll("\n", "\r\n");
    expect(namesOf(await read([crlf]))).toEqual(namesOf(await read([CREATE])));
  });
});

describe("真实 resume 缺口流", () => {
  it("只有一个事件，且它没有 id", async () => {
    const frames = await read([RESUME_GAP]);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ kind: "event" });
    const event = frames[0]?.kind === "event" ? frames[0].event : undefined;
    expect(event?.id).toBeUndefined();
  });

  it("载荷里的 run_id 与 create 流 metadata 里的是同一个", async () => {
    // 去敏把每个 uuid 映射到各自的占位符，正是为了让这条关系还能被断言——
    // 压成一个常量的话，「缺口报的是不是当前这个 run」就永远测不了。
    const createFrames = await read([CREATE]);
    const metadata = createFrames.find(
      (f) => f.kind === "event" && f.event.event === "metadata",
    );
    const gapFrames = await read([RESUME_GAP]);
    const gap = gapFrames[0];
    expect(metadata?.kind).toBe("event");
    expect(gap?.kind).toBe("event");
    if (metadata?.kind !== "event" || gap?.kind !== "event") return;

    const metaRunId = (JSON.parse(metadata.event.data) as { run_id: string })
      .run_id;
    const gapRunId = (JSON.parse(gap.event.data) as { run_id: string }).run_id;
    expect(gapRunId).toBe(metaRunId);
  });
});
