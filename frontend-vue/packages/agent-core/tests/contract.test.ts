/*
  【文件职责】     让 ARCHITECTURE.md 说的每个可核验事实与 src/ 保持一致。
  【架构位置】     L1 测试
  【主要导出】     无；Vitest cases
  【依赖关系】     ../ARCHITECTURE.md · ../src/**
  【边界与注意】   与 architecture.test.ts 分工：那边守「包边界还在不在」，
                   这边守「随包走的说明书还对不对」。

                   为什么需要它：散文文档不会因为代码变化而变红。本仓已经反复
                   证明这一点——文档里写死的枚举、默认值和数字，代码改了之后
                   一路全绿地烂着，直到有人照着敲才发现。所以凡是能从源码机械
                   算出来的，都在这里对一遍：枚举成员、重试判据、默认值、状态
                   清单。改了代码不改文档（或反过来），这条门禁会红。

                   **只钉能从源码直接算出来的东西。** 设计理由、故障场景描述
                   这类散文不在此列——它们的正确性靠 review，不靠正则。
*/

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_BACKOFF,
  DEFAULT_WATCHDOG,
  isRetryableKind,
  type AgentErrorKind,
} from "../src/index";

const read = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), "utf8");

const doc = read("../ARCHITECTURE.md");

/** 从一个 TS 联合类型声明里取出字面量成员。 */
function unionMembers(source: string, typeName: string): string[] {
  const declaration = new RegExp(
    `export type ${typeName}\\s*=([\\s\\S]*?);`,
    "m",
  ).exec(source);
  if (!declaration?.[1]) return [];
  return [...declaration[1].matchAll(/"([a-z_]+)"/g)].map(
    (m) => m[1] as string,
  );
}

describe("ARCHITECTURE.md 与源码一致", () => {
  it("错误 kind 的成员和数量都对得上", () => {
    const kinds = unionMembers(read("../src/errors.ts"), "AgentErrorKind");
    expect(kinds.length).toBeGreaterThan(5);
    // 文档声明的数量
    const claimed = /`AgentErrorKind` ([一-龥]+)种/.exec(doc)?.[1];
    const digits: Record<string, number> = {
      七: 7,
      八: 8,
      九: 9,
      十: 10,
      十一: 11,
      十二: 12,
    };
    expect(claimed, "文档没写 AgentErrorKind 有几种").toBeTruthy();
    expect(digits[claimed as string]).toBe(kinds.length);
    // 每一个都必须在文档里被点名
    const unlisted = kinds.filter((kind) => !doc.includes(`\`${kind}\``));
    expect(unlisted, "这些 kind 源码里有、文档没提").toEqual([]);

    /*
      反方向也要查。上面三条都过得去、而文档多点名一个源码里没有的 kind：
      数量那条比的是「九种」这个**词**与源码条数，列表本身不参与计数；
      「每个 kind 都被点名」只从源码这一侧看。于是文档里躺一个已改名的旧 kind
      不会有任何东西变红——正是 wave 48 在 baseline 键上撞过的那种单向断言。
    */
    const sentence = /`AgentErrorKind`[^：]*：([^。]*)。/.exec(doc)?.[1];
    expect(sentence, "文档里找不到那句枚举 kind 的话").toBeTruthy();
    const listed = [...(sentence ?? "").matchAll(/`([^`]+)`/g)].map(
      (m) => m[1]!,
    );
    expect(listed.length).toBe(kinds.length);
    const known = new Set<string>(kinds);
    expect(
      listed.filter((name) => !known.has(name)),
      "文档点名了源码里没有的 kind",
    ).toEqual([]);
  });

  it("只有 network 可以退避重连", () => {
    const kinds = unionMembers(
      read("../src/errors.ts"),
      "AgentErrorKind",
    ) as AgentErrorKind[];
    const retryable = kinds.filter((kind) => isRetryableKind(kind));
    expect(retryable).toEqual(["network"]);
    expect(doc).toContain("**只有 `network` 可以退避重连。**");
  });

  it("会话状态的成员和数量都对得上", () => {
    const source = read("../src/session/state.ts");
    const statuses = [...source.matchAll(/status:\s*"([a-z]+)"/g)].map(
      (m) => m[1] as string,
    );
    const unique = [...new Set(statuses)];
    expect(unique.length).toBeGreaterThan(5);
    const claimed = /^([一-龥]+)个状态：/m.exec(doc)?.[1];
    const digits: Record<string, number> = { 七: 7, 八: 8, 九: 9, 十: 10 };
    expect(claimed, "文档没写会话状态有几个").toBeTruthy();
    expect(digits[claimed as string]).toBe(unique.length);
    const unlisted = unique.filter((status) => !doc.includes(`\`${status}\``));
    expect(unlisted, "这些状态源码里有、文档没提").toEqual([]);
  });

  it("消息角色的成员和数量都对得上", () => {
    const roles = unionMembers(read("../src/message.ts"), "AgentMessageRole");
    expect(roles.length).toBeGreaterThan(2);
    const claimed = /角色([一-龥]+)种：/.exec(doc)?.[1];
    const digits: Record<string, number> = { 三: 3, 四: 4, 五: 5, 六: 6 };
    expect(claimed, "文档没写消息角色有几种").toBeTruthy();
    expect(digits[claimed as string]).toBe(roles.length);
    const unlisted = roles.filter((role) => !doc.includes(`\`${role}\``));
    expect(unlisted).toEqual([]);
  });

  it("默认值只有一处出处，文档不另抄一份数字", () => {
    // 这些值会随实测调整；文档只许指向常量名，抄进散文就会先于代码过期。
    expect(DEFAULT_BACKOFF.baseMs).toBeGreaterThan(0);
    expect(DEFAULT_BACKOFF.factor).toBeGreaterThan(1);
    expect(DEFAULT_BACKOFF.maxMs).toBeGreaterThan(DEFAULT_BACKOFF.baseMs);
    expect(DEFAULT_WATCHDOG.idleMs).toBeGreaterThan(0);
    for (const name of [
      "DEFAULT_BACKOFF",
      "DEFAULT_WATCHDOG",
      "DEFAULT_INSPECT_POLLING",
    ]) {
      expect(doc, `默认值表里少了 ${name}`).toContain(name);
    }
    // 反向：文档不得把这些数字抄成字面量。
    const literals = [
      `${DEFAULT_WATCHDOG.idleMs}`,
      `${DEFAULT_BACKOFF.maxMs}`,
    ].filter((literal) => doc.includes(literal));
    expect(
      literals,
      "默认值被抄进文档散文了；只写常量名，让源码当唯一出处",
    ).toEqual([]);
  });

  it("缓冲上限与重连总次数确实没有默认值", () => {
    const source = read("../src/session/run-session.ts");
    // 解构里带 `=` 的才是有默认值的选项。
    const defaulted = [...source.matchAll(/^\s{4}(\w+)\s*=\s*[A-Za-z]/gm)].map(
      (m) => m[1] as string,
    );
    expect(defaulted).not.toContain("maxBufferBytes");
    expect(defaulted).not.toContain("maxReconnects");
    expect(doc).toContain("**没有默认值**");
  });

  it("两个 AbortController 的分工没有被合并掉", () => {
    const source = read("../src/session/run-session.ts");
    const controllers = [
      ...source.matchAll(/const (\w+) = new AbortController\(\)/g),
    ].map((m) => m[1] as string);
    expect(controllers).toEqual(["streamController", "controlController"]);
    for (const name of controllers) {
      expect(doc, `文档没提 ${name}`).toContain(name);
    }
  });

  it("默认调度器是微任务，不是定时器", () => {
    const source = read("../src/store/external-store.ts");
    /*
      只看默认调度器的函数体。整份文件文本里搜 setTimeout 会命中注释——那里
      正在解释「为什么不能用 setTimeout」，是论据不是实现。第一版就是这么误
      报的。
    */
    const body = /const defaultSchedule[\s\S]*?\n};/.exec(source)?.[0];
    expect(body, "找不到 defaultSchedule，实现被改名了？").toBeTruthy();
    expect(body).toContain("queueMicrotask");
    expect(body).not.toMatch(/setTimeout|setInterval/);
    expect(doc).toContain("`queueMicrotask`");
  });
});
