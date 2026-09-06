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

                   **上面那句「凡是……都在这里对一遍」以前是假的**（wave 106）：
                   哪几条事实被钉，靠的是下面写死的用例清单，而「文档里还有哪些
                   同形的句子」没有任何机器在看。实测五句「数量词 + 量词 + ：+
                   反引号清单」的枚举里，**两句压根没人钉**（`src/transport/`
                   的四个文件、会话向外发的三种输出），另两句**只查了一半**
                   （源码有的文档得提，文档多点一个源码没有的却照样绿——正是
                   本文件在错误 kind 那一条上已经写明、却没推广出去的漏洞）。

                   现在的做法：取样面由 `enumerationSentences()` 从文档里**算**
                   出来，`PINNED_ENUMERATIONS` 必须与它**恰好一一对应**——
                   多一句没人钉会红，少一句（登记了但文档里找不到）也会红。
                   新写一句这种枚举，就必须同时给它一个源码侧的取法。
*/

import { readFileSync, readdirSync } from "node:fs";
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

/**
 * 一个类型声明的正文：从 `export type X` 到**第一个空行**为止。
 *
 * 不能像以前那样用 `[\s\S]*?;` 兜到第一个分号——判别式联合的成员里就带分号
 * （`{ status: "streaming"; handle: THandle }`），那样只能切出第一支。
 */
function typeBlock(source: string, typeName: string): string {
  const start = new RegExp(`^export type ${typeName}\\b`, "m").exec(source);
  if (!start) return "";
  const rest = source.slice(start.index);
  const end = rest.search(/\n\s*\n/);
  return end === -1 ? rest : rest.slice(0, end);
}

/** 字面量联合（`"a" | "b"`）的成员。 */
function unionMembers(source: string, typeName: string): string[] {
  return [...typeBlock(source, typeName).matchAll(/"([a-z_]+)"/g)].map(
    (m) => m[1] as string,
  );
}

/**
 * 判别式联合里某个字段的取值（`{ status: "idle" } | { status: "creating" } …`）。
 *
 * 按字段名取，不是把整块里的字面量一网打尽——`RunSessionState` 的成员里还带着
 * `mode: "draining"`、`recovery: "reload_durable_state"`，它们不是状态名。
 */
function discriminantMembers(
  source: string,
  typeName: string,
  field: string,
): string[] {
  const block = typeBlock(source, typeName);
  const values = [
    ...block.matchAll(new RegExp(`\\b${field}:\\s*"([a-z_]+)"`, "g")),
  ].map((m) => m[1] as string);
  return [...new Set(values)];
}

/** 文档里用得到的中文数量词。不认识的数量词会让对应用例直接红。 */
const COUNT_WORDS: Record<string, number> = {
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
};

const COUNT_PHRASE =
  /([一二两三四五六七八九十]+)[个种条类项份步层][^：:。\n]{0,20}[：:]/;

type EnumerationSentence = {
  sentence: string;
  countWord: string;
  items: string[];
};

/**
 * 本守卫的取样面：文档里「数量词 + 量词 + `：` + **两个以上**反引号项」的句子。
 *
 * 判据为什么是「反引号项 ≥ 2」：这一类句子点的是**符号**（枚举成员、文件名），
 * 能从源码机械算出来；而「两条硬约束：」「三条实现约束：」后面跟的是散文列表项，
 * 按本文件头的边界不该也没法机械核验。两者靠句内有没有符号清单自然分开，
 * **不需要豁免表**。
 *
 * 切句要先按空行与项目符号分块，再把块内的软换行接上——markdown 会把一句话
 * 折成两行（`四个文件各管一段：` 那句就跨行），不接上会只数到前半句的项。
 */
function enumerationSentences(markdown: string): EnumerationSentence[] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of markdown.split("\n")) {
    const trimmed = line.trimStart();
    // 表格单元格不是句子；项目符号各自成块，免得上一句的冒号接上下一条的反引号。
    if (trimmed.startsWith("|")) continue;
    if (trimmed === "" || /^[-*+] /.test(trimmed)) {
      if (current.length) blocks.push(current);
      current = trimmed === "" ? [] : [trimmed];
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);

  const found: EnumerationSentence[] = [];
  for (const block of blocks) {
    const joined = block.join("").replace(/\s*\n\s*/g, "");
    for (const raw of joined.split("。")) {
      const sentence = raw.trim();
      const phrase = COUNT_PHRASE.exec(sentence);
      if (!phrase) continue;
      const tail = sentence.slice(phrase.index + phrase[0].length);
      const items = [...tail.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);
      if (items.length < 2) continue;
      found.push({ sentence, countWord: phrase[1] as string, items });
    }
  }
  return found;
}

type PinnedEnumeration = {
  label: string;
  /**
   * 在取样面里认出这一句。**不要把数量词写进 anchor**——写进去之后，
   * 改错数量词会变成「这句没人钉」，而不是「数量对不上」，报错方向就反了。
   */
  anchor: RegExp;
  /** 源码那一侧的成员；顺序不参与比对，集合必须逐个相等。 */
  members: () => string[];
};

const PINNED_ENUMERATIONS: PinnedEnumeration[] = [
  {
    label: "AgentErrorKind",
    anchor: /^`AgentErrorKind`/,
    members: () => unionMembers(read("../src/errors.ts"), "AgentErrorKind"),
  },
  {
    label: "AgentMessageRole",
    anchor: /^角色[一二两三四五六七八九十]+种/,
    members: () => unionMembers(read("../src/message.ts"), "AgentMessageRole"),
  },
  {
    label: "src/transport/ 的分工",
    anchor: /文件各管一段/,
    members: () =>
      readdirSync(new URL("../src/transport/", import.meta.url)).filter(
        (name) => name.endsWith(".ts"),
      ),
  },
  {
    label: "RunSessionState.status",
    anchor: /^[一二两三四五六七八九十]+个状态/,
    members: () =>
      discriminantMembers(
        read("../src/session/state.ts"),
        "RunSessionState",
        "status",
      ),
  },
  {
    label: "SessionOutput.kind",
    anchor: /^会话向外只发/,
    members: () =>
      discriminantMembers(
        read("../src/session/state.ts"),
        "SessionOutput",
        "kind",
      ),
  },
];

describe("ARCHITECTURE.md 与源码一致", () => {
  it("取样面与登记表恰好一一对应", () => {
    const sentences = enumerationSentences(doc);
    // 取法自己先证明它还在工作：文档里本来就有五句这样的枚举。
    expect(
      sentences.length,
      "一句枚举都没抽到——切句或数量词的规则失效了",
    ).toBeGreaterThan(3);

    const unpinned = sentences
      .filter(
        (s) => !PINNED_ENUMERATIONS.some((p) => p.anchor.test(s.sentence)),
      )
      .map((s) => s.sentence);
    expect(
      unpinned,
      "这些枚举句没有任何用例钉着；给它们各配一个源码侧的取法",
    ).toEqual([]);

    // 反方向：登记了却在文档里找不到（改写、删掉、或 anchor 命中两句）。
    const misses = PINNED_ENUMERATIONS.map((pin) => ({
      label: pin.label,
      hits: sentences.filter((s) => pin.anchor.test(s.sentence)).length,
    })).filter((entry) => entry.hits !== 1);
    expect(misses, "这些登记项没有恰好命中文档里的一句").toEqual([]);
  });

  for (const pin of PINNED_ENUMERATIONS) {
    it(`${pin.label}：数量词与清单两个方向都对得上`, () => {
      const members = pin.members();
      expect(
        members.length,
        `${pin.label} 一个成员都没取到，源码侧的取法失效了`,
      ).toBeGreaterThan(1);

      const sentence = enumerationSentences(doc).find((s) =>
        pin.anchor.test(s.sentence),
      );
      expect(sentence, `文档里找不到 ${pin.label} 那句枚举`).toBeTruthy();

      const claimed = COUNT_WORDS[sentence?.countWord ?? ""];
      expect(
        claimed,
        `文档写的数量词「${sentence?.countWord}」不在 COUNT_WORDS 里`,
      ).toBeTruthy();
      expect(claimed, `${pin.label}：文档声明的条数与源码不符`).toBe(
        members.length,
      );

      /*
        逐个相等，不是「源码的每一个文档都提到了」。单向那半在本文件里挂了很久：
        数量那条比的是数量**词**与源码条数、列表本身不参与计数，「每个成员都被
        点名」又只从源码一侧看——于是文档里躺一个已改名的旧成员不会有任何东西
        变红（wave 48 在 baseline 键上、wave 104 在 HAND_MAINTAINED 上撞的是同一形状）。
      */
      expect(
        [...(sentence?.items ?? [])].sort(),
        `${pin.label}：文档清单与源码不是同一批`,
      ).toEqual([...members].sort());
    });
  }

  it("只有 network 可以退避重连", () => {
    const kinds = unionMembers(
      read("../src/errors.ts"),
      "AgentErrorKind",
    ) as AgentErrorKind[];
    const retryable = kinds.filter((kind) => isRetryableKind(kind));
    expect(retryable).toEqual(["network"]);
    expect(doc).toContain("**只有 `network` 可以退避重连。**");
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
    // 反向：文档不得点名一个源码里已经没有的 controller（同上面那条单向漏洞）。
    const named = [...doc.matchAll(/`(\w*Controller)`/g)]
      .map((m) => m[1] as string)
      .filter((name) => name !== "AbortController");
    const known = new Set(controllers);
    expect(
      [...new Set(named)].filter((name) => !known.has(name)),
      "文档点名了源码里没有的 controller",
    ).toEqual([]);
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
