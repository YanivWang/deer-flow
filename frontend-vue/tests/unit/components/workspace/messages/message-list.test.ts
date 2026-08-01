import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MessageList from "../../../../../app/components/workspace/messages/MessageList.vue";
import type { StreamViewMessage } from "../../../../../app/core/api/stream/view-model";

const mermaidInitialize = vi.hoisted(() => vi.fn());
const mermaidRender = vi.hoisted(() =>
  vi.fn(async (_id: string, _source: string) => ({
    svg: '<svg role="img" viewBox="0 0 120 40"><title>Mock Mermaid</title><g onclick="bad()"><a href="javascript:alert(1)"><text>Blocked</text></a><text x="4" y="20">Rendered graph</text></g></svg>',
  })),
);

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidInitialize,
    render: mermaidRender,
  },
}));

describe("MessageList", () => {
  beforeEach(() => {
    mermaidInitialize.mockClear();
    mermaidRender.mockReset();
    mermaidRender.mockResolvedValue({
      svg: '<svg role="img" viewBox="0 0 120 40"><title>Mock Mermaid</title><g onclick="bad()"><a href="javascript:alert(1)"><text>Blocked</text></a><text x="4" y="20">Rendered graph</text></g></svg>',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders human, ai, tool, and error message groups with stable roles", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message("human", "Plan the migration"),
          message("assistant", "Here is the plan"),
          message("tool", "search completed"),
          message("error", "stream failed"),
        ],
      },
    });

    expect(wrapper.find('[data-testid="vue-message-human-0"]').text()).toContain(
      "Plan the migration",
    );
    expect(wrapper.find('[data-testid="vue-message-ai-1"]').text()).toContain("Here is the plan");
    expect(wrapper.find('[data-testid="vue-message-tool-2"]').text()).toContain(
      "search completed",
    );
    expect(wrapper.find('[data-testid="vue-message-error-3"]').text()).toContain(
      "stream failed",
    );
    expect(wrapper.findAll(".message-list__role").map((role) => role.text())).toEqual([
      "用户",
      "AI",
      "工具",
      "错误",
    ]);
  });

  it("degrades unknown roles to a generic message group", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [message("system", "raw system note")],
      },
    });

    expect(wrapper.get('[data-testid="vue-message-unknown-0"]').text()).toContain(
      "raw system note",
    );
    expect(wrapper.get('[data-testid="vue-message-unknown-0"]').attributes("data-role")).toBe(
      "unknown",
    );
  });

  it("renders markdown links, citations, code, lists, safe HTML, math, and artifact images", () => {
    const wrapper = mount(MessageList, {
      props: {
        artifactPaths: ["/mnt/user-data/outputs/chart.png"],
        messages: [
          message(
            "assistant",
            "See [citation:paper](/mnt/report.md#p1), `code`, \\(E=mc^2\\), <strong>safe</strong>, <a href=\"javascript:alert(1)\" onclick=\"x()\">bad</a>, and ![chart](chart.png).\n\n- item\n\n<script>alert(1)</script>",
          ),
        ],
        threadId: "thread-a",
      },
    });

    expect(wrapper.get('[data-testid="vue-message-citation-link"]').attributes("href")).toBe(
      "/api/threads/thread-a/artifacts/mnt/report.md#p1",
    );
    expect(wrapper.get('[data-testid="vue-message-citation-link"]').text()).toBe("paper");
    expect(wrapper.get('[data-testid="vue-message-citation-sources"]').text()).toContain(
      "paper",
    );
    expect(wrapper.get('[data-testid="vue-message-citation-sources"] a').attributes("href")).toBe(
      "/api/threads/thread-a/artifacts/mnt/report.md#p1",
    );
    expect(wrapper.get(".rich-message-content__inline-code").text()).toBe("code");
    expect(wrapper.get('[data-testid="vue-message-inline-math"]').html()).toContain("katex");
    expect(wrapper.get('[data-testid="vue-message-inline-html"]').html()).toContain(
      "<strong>safe</strong>",
    );
    expect(wrapper.html()).not.toContain("onclick");
    expect(wrapper.html()).not.toContain("javascript:");
    expect(wrapper.get('[data-testid="vue-message-list"]').text()).toContain("item");
    expect(wrapper.get('[data-testid="vue-message-image-link"]').attributes("href")).toBe(
      "/api/threads/thread-a/artifacts/mnt/user-data/outputs/chart.png",
    );
    expect(wrapper.find("script").exists()).toBe(false);
    expect(wrapper.text()).toContain("alert(1)");
  });

  it("renders unsafe markdown links as inert text", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [message("assistant", "[click me](javascript:alert(1))")],
      },
    });

    expect(wrapper.find("a").exists()).toBe(false);
    expect(wrapper.get('[data-testid="vue-message-unsafe-link"]').text()).toBe("click me");
  });

  it("renders URL and email autolink literals from React Streamdown remark-gfm", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            "参考 https://example.com/report?q=deerflow, www.example.com/docs, support@example.com, 代码 `https://code.example.com` 不自动链接。",
          ),
        ],
      },
    });

    const links = wrapper.findAll('[data-testid="vue-message-link"]');
    expect(links).toHaveLength(3);
    expect(links[0]?.attributes("href")).toBe("https://example.com/report?q=deerflow");
    expect(links[0]?.text()).toBe("https://example.com/report?q=deerflow");
    expect(links[1]?.attributes("href")).toBe("http://www.example.com/docs");
    expect(links[1]?.text()).toBe("www.example.com/docs");
    expect(links[2]?.attributes("href")).toBe("mailto:support@example.com");
    expect(links[2]?.text()).toBe("support@example.com");
    expect(wrapper.get(".rich-message-content__inline-code").text()).toBe(
      "https://code.example.com",
    );
  });

  it("renders character references and escaped punctuation as visible CommonMark text", () => {
    const wrapper = mount(MessageList, {
      props: {
        artifactPaths: ["/mnt/user-data/outputs/chart.png"],
        messages: [
          message(
            "assistant",
            [
              "Tom &amp; Jerry &#x1F680; keeps \\*literal\\* markers.",
              "",
              [
                "See [Tom &amp; Jerry](https://example.com/path?x=1&amp;y=2),",
                "[Ref \\& label][], and ![Chart &copy;](chart.png).",
              ].join(" "),
              "",
              "[ref & label]: https://example.com/ref",
              "`&amp; \\*code\\*` <span>&amp; \\*html\\*</span>",
            ].join("\n"),
          ),
        ],
        threadId: "thread-a",
      },
    });

    expect(wrapper.text()).toContain("Tom & Jerry 🚀 keeps *literal* markers.");
    expect(wrapper.text()).toContain("&amp; \\*code\\*");
    expect(wrapper.text()).toContain("&amp; \\*html\\*");
    const links = wrapper.findAll('[data-testid="vue-message-link"]');
    expect(links[0]?.text()).toBe("Tom & Jerry");
    expect(links[0]?.attributes("href")).toBe("https://example.com/path?x=1&amp;y=2");
    expect(links[1]?.text()).toBe("Ref & label");
    expect(links[1]?.attributes("href")).toBe("https://example.com/ref");
    expect(wrapper.get('[data-testid="vue-message-image-link"] img').attributes("alt")).toBe(
      "Chart ©",
    );
    expect(wrapper.text()).not.toContain("[ref & label]:");
  });

  it("renders CommonMark reference-style links and images without showing definitions", () => {
    const wrapper = mount(MessageList, {
      props: {
        artifactPaths: ["/mnt/user-data/outputs/chart.png"],
        messages: [
          message(
            "assistant",
            [
              "See [Gateway][Gateway Contract], [citation:paper][], [Shortcut], [bad][Unsafe], and ![chart][chart ref].",
              "",
              "[ gateway  contract ]: <https://example.com/gateway>",
              "[citation:paper]: /mnt/report.md#p1",
              "[shortcut]: https://example.com/shortcut",
              "[unsafe]: javascript:alert(1)",
              "[Chart Ref]: chart.png",
            ].join("\n"),
          ),
        ],
        threadId: "thread-a",
      },
    });

    const links = wrapper.findAll('[data-testid="vue-message-link"]');
    expect(links).toHaveLength(2);
    expect(links[0]?.attributes("href")).toBe("https://example.com/gateway");
    expect(links[1]?.attributes("href")).toBe("https://example.com/shortcut");
    expect(wrapper.get('[data-testid="vue-message-citation-link"]').attributes("href")).toBe(
      "/api/threads/thread-a/artifacts/mnt/report.md#p1",
    );
    expect(wrapper.get('[data-testid="vue-message-unsafe-link"]').text()).toBe("bad");
    expect(wrapper.findAll("a").some((link) => link.text() === "bad")).toBe(false);
    expect(wrapper.get('[data-testid="vue-message-image-link"]').attributes("href")).toBe(
      "/api/threads/thread-a/artifacts/mnt/user-data/outputs/chart.png",
    );
    expect(wrapper.text()).not.toContain("[ gateway  contract ]:");
    expect(wrapper.text()).not.toContain("[Chart Ref]:");
  });

  it("renders markdown tables with rich inline content", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            "| Module | Evidence | Status |\n| :--- | ---: | :---: |\n| `auth` | [contract](https://example.com/auth) | ready |\n| scheduler | source smoke | pending |",
          ),
        ],
      },
    });

    const table = wrapper.get('[data-testid="vue-message-table"]');
    expect(table.findAll("th").map((cell) => cell.text())).toEqual([
      "Module",
      "Evidence",
      "Status",
    ]);
    expect(table.findAll("td").map((cell) => cell.text())).toEqual([
      "auth",
      "contract",
      "ready",
      "scheduler",
      "source smoke",
      "pending",
    ]);
    expect(table.findAll("th").map((cell) => cell.attributes("data-align"))).toEqual([
      "left",
      "right",
      "center",
    ]);
    expect(table.findAll("td").slice(0, 3).map((cell) => cell.attributes("data-align"))).toEqual([
      "left",
      "right",
      "center",
    ]);
    expect(table.findAll("th")[1]?.classes()).toContain(
      "rich-message-content__table-cell--align-right",
    );
    expect(table.findAll("th")[2]?.classes()).toContain(
      "rich-message-content__table-cell--align-center",
    );
    expect(table.get(".rich-message-content__inline-code").text()).toBe("auth");
    expect(table.get('[data-testid="vue-message-link"]').attributes("href")).toBe(
      "https://example.com/auth",
    );
  });

  it("renders CommonMark thematic breaks instead of leaking divider markers", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [message("assistant", "Before\n\n---\n\nAfter\n\n* * *")],
      },
    });

    const dividers = wrapper.findAll('[data-testid="vue-message-thematic-break"]');
    expect(dividers).toHaveLength(2);
    expect(wrapper.text()).toContain("Before");
    expect(wrapper.text()).toContain("After");
    expect(wrapper.text()).not.toContain("---");
    expect(wrapper.text()).not.toContain("* * *");
  });

  it("keeps escaped and code pipe characters in the same rendered table cell", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            "| Literal | Code | Link |\n| --- | --- | --- |\n| a \\| b | `x|y` | [A\\|B](https://example.com/a) |",
          ),
        ],
      },
    });

    const table = wrapper.get('[data-testid="vue-message-table"]');
    const cells = table.findAll("td");
    expect(cells).toHaveLength(3);
    expect(cells.map((cell) => cell.text())).toEqual(["a | b", "x|y", "A|B"]);
    expect(table.get(".rich-message-content__inline-code").text()).toBe("x|y");
    expect(table.get('[data-testid="vue-message-link"]').attributes("href")).toBe(
      "https://example.com/a",
    );
  });

  it("renders GFM footnotes from React Streamdown remark-gfm", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            [
              "Alpha[^First Note] and again[^first note]. Code `[^first note]` stays literal.",
              "",
              "[^first note]: Footnote **body** with [link](https://example.com).",
            ].join("\n"),
          ),
        ],
      },
    });

    const refs = wrapper.findAll('[data-testid="vue-message-footnote-ref"]');
    expect(refs).toHaveLength(2);
    expect(refs.map((ref) => ref.text())).toEqual(["1", "1"]);
    expect(refs[0]?.get("a").attributes("href")).toBe("#fn-first%20note");
    expect(wrapper.get(".rich-message-content__inline-code").text()).toBe("[^first note]");

    const footnotes = wrapper.get('[data-testid="vue-message-footnotes"]');
    expect(footnotes.attributes("aria-label")).toBe("脚注");
    expect(footnotes.get("li").attributes("id")).toBe("fn-first%20note");
    expect(footnotes.text()).toContain("Footnote body with link.");
    expect(footnotes.get('[data-testid="vue-message-strong"]').text()).toBe("body");
    expect(footnotes.get('[data-testid="vue-message-link"]').attributes("href")).toBe(
      "https://example.com",
    );
    expect(footnotes.get(".rich-message-content__footnote-backref").attributes("href")).toBe(
      "#fnref-first%20note",
    );
    expect(wrapper.text()).not.toContain("[^first note]:");
  });

  it("renders GFM task lists as readonly checkbox items", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            "- [x] shipped `parser`\n- [ ] review [contract](https://example.com)\n- normal item",
          ),
        ],
      },
    });

    const checkboxes = wrapper.findAll('[data-testid="vue-message-task-checkbox"]');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]?.attributes("checked")).toBeDefined();
    expect(checkboxes[0]?.attributes("disabled")).toBeDefined();
    expect(checkboxes[0]?.attributes("aria-label")).toBe("任务已完成");
    expect(checkboxes[1]?.attributes("checked")).toBeUndefined();
    expect(checkboxes[1]?.attributes("disabled")).toBeDefined();
    expect(checkboxes[1]?.attributes("aria-label")).toBe("任务未完成");
    expect(wrapper.get(".rich-message-content__list--task").text()).toContain(
      "shipped parser",
    );
    expect(wrapper.get(".rich-message-content__inline-code").text()).toBe("parser");
    expect(wrapper.get('[data-testid="vue-message-link"]').attributes("href")).toBe(
      "https://example.com",
    );
    expect(wrapper.get('[data-testid="vue-message-list"]').text()).toContain("normal item");
  });

  it("renders GFM strikethrough without treating single tildes as deleted text", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            "状态：~~已取消~~，温度 23~30℃，~不是删除线~，~~~也不是~~~，并保留 ~~`code` [link](https://example.com) \\(x\\)~~。",
          ),
        ],
      },
    });

    const deleted = wrapper.findAll('[data-testid="vue-message-strikethrough"]');
    expect(deleted).toHaveLength(2);
    expect(deleted[0]?.find("del").text()).toBe("已取消");
    expect(wrapper.text()).toContain("23~30℃");
    expect(wrapper.text()).toContain("~不是删除线~");
    expect(wrapper.text()).toContain("~~~也不是~~~");
    expect(deleted[1]?.find(".rich-message-content__inline-code").text()).toBe("code");
    expect(deleted[1]?.find('[data-testid="vue-message-link"]').attributes("href")).toBe(
      "https://example.com",
    );
    expect(deleted[1]?.find('[data-testid="vue-message-inline-math"]').html()).toContain(
      "katex",
    );
  });

  it("renders strong and emphasis markdown without parsing code or raw HTML contents", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            "结论：**强提醒 `code` [link](https://example.com)**，请 *复核 ~~done~~*，代码 `**literal**`，HTML <strong>**already html**</strong>。",
          ),
        ],
      },
    });

    const strong = wrapper.get('[data-testid="vue-message-strong"]');
    const emphasis = wrapper.get('[data-testid="vue-message-emphasis"]');
    expect(strong.element.tagName).toBe("STRONG");
    expect(strong.text()).toBe("强提醒 code link");
    expect(strong.get(".rich-message-content__inline-code").text()).toBe("code");
    expect(strong.get('[data-testid="vue-message-link"]').attributes("href")).toBe(
      "https://example.com",
    );
    expect(emphasis.element.tagName).toBe("EM");
    expect(emphasis.find('[data-testid="vue-message-strikethrough"]').text()).toBe("done");
    expect(wrapper.get(".rich-message-content__inline-code").text()).toBe("code");
    expect(wrapper.text()).toContain("**literal**");
    expect(wrapper.get('[data-testid="vue-message-inline-html"]').html()).toContain(
      "<strong>**already html**</strong>",
    );
  });

  it("renders CommonMark hard line breaks while preserving soft line breaks and rich inline parts", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            "**结论**  \n[link](https://example.com)\\\n第三行\nsoft `code  \nraw` <span>html  \nraw</span>",
          ),
        ],
      },
    });

    const hardBreaks = wrapper.findAll('[data-testid="vue-message-line-break"]');
    expect(hardBreaks).toHaveLength(2);
    expect(hardBreaks.every((node) => node.element.tagName === "BR")).toBe(true);
    expect(wrapper.get('[data-testid="vue-message-strong"]').text()).toBe("结论");
    expect(wrapper.get('[data-testid="vue-message-link"]').attributes("href")).toBe(
      "https://example.com",
    );
    expect(wrapper.get(".rich-message-content__inline-code").text()).toBe("code  \nraw");
    expect(wrapper.get('[data-testid="vue-message-inline-html"]').html()).toContain(
      "<span>html  \nraw</span>",
    );
    expect(wrapper.findAll('[data-testid="vue-message-paragraph"]')).toHaveLength(1);
  });

  it("renders deeper markdown blocks and copies fenced code", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            "###### Result ##\n\n> source-backed\n\n1. inspect\n2. ship\n\n```TS\nconst ok = true;\n```",
          ),
        ],
      },
    });

    expect(wrapper.get('[data-testid="vue-message-heading"]').text()).toBe("Result");
    expect(wrapper.get('[data-testid="vue-message-heading"]').element.tagName).toBe("H6");
    expect(wrapper.get('[data-testid="vue-message-heading"]').attributes("data-level")).toBe("6");
    expect(wrapper.get('[data-testid="vue-message-blockquote"]').text()).toBe("source-backed");
    expect(wrapper.get('[data-testid="vue-message-ordered-list"]').text()).toContain("inspect");
    expect(wrapper.get('[data-testid="vue-message-code-language"]').text()).toBe("ts");

    await wrapper.get('[data-testid="vue-message-code-copy"]').trigger("click");

    expect(writeText).toHaveBeenCalledWith("const ok = true;");
    expect(wrapper.get('[data-testid="vue-message-code-copy-status"]').text()).toBe("已复制");
  });

  it("renders display math blocks", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [message("assistant", "\\[\na^2 + b^2 = c^2\n\\]")],
      },
    });

    const mathBlock = wrapper.get('[data-testid="vue-message-math-block"]');
    expect(mathBlock.attributes("aria-label")).toBe("a^2 + b^2 = c^2");
    expect(mathBlock.html()).toContain("katex-display");
  });

  it("renders dollar-delimited math while leaving code and HTML delimiters literal", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            "Inline $E=mc^2$, code `$not_math$`, HTML <span>$html$</span>.\n\n$$a^2 + b^2 = c^2$$",
          ),
        ],
      },
    });

    expect(wrapper.get('[data-testid="vue-message-inline-math"]').attributes("aria-label")).toBe(
      "E=mc^2",
    );
    expect(wrapper.get('[data-testid="vue-message-inline-math"]').html()).toContain("katex");
    expect(wrapper.get(".rich-message-content__inline-code").text()).toBe("$not_math$");
    expect(wrapper.get('[data-testid="vue-message-inline-html"]').html()).toContain(
      "<span>$html$</span>",
    );
    const mathBlock = wrapper.get('[data-testid="vue-message-math-block"]');
    expect(mathBlock.attributes("aria-label")).toBe("a^2 + b^2 = c^2");
    expect(mathBlock.html()).toContain("katex-display");
  });

  it("reveals only appended assistant text while a message is streaming", async () => {
    const wrapper = mount(MessageList, {
      props: {
        isStreaming: true,
        messages: [message("assistant", "正在分析 DeerFlow")],
      },
    });

    expect(wrapper.find('[data-testid="vue-message-streaming-reveal"]').exists()).toBe(true);

    await wrapper.setProps({
      messages: [message("assistant", "正在分析 DeerFlow 消息渲染")],
    });

    const revealed = wrapper.findAll('[data-testid="vue-message-streaming-reveal"]');
    expect(revealed).toHaveLength(1);
    expect(revealed[0]?.text()).toBe("消息渲染");
    expect(wrapper.get('[data-testid="vue-message-ai-0"]').text()).toContain(
      "正在分析 DeerFlow 消息渲染",
    );
  });

  it("hides a trailing empty streaming list item until content arrives", async () => {
    const wrapper = mount(MessageList, {
      props: {
        isStreaming: true,
        messages: [message("assistant", ["1. First", "", "2."].join("\n"))],
      },
    });
    const initialItems = wrapper.findAll('[data-testid="vue-message-ordered-list"] li');
    const firstItem = initialItems[0]?.element;
    const pendingItem = initialItems[1]?.element;

    expect(initialItems).toHaveLength(2);
    expect(pendingItem).toBeInstanceOf(HTMLLIElement);
    expect(initialItems[1]?.attributes("hidden")).toBeDefined();
    expect(initialItems[1]?.attributes("data-streaming-list-item")).toBeUndefined();

    await wrapper.setProps({
      messages: [message("assistant", ["1. First", "", "2. Second"].join("\n"))],
    });

    const revealedItems = wrapper.findAll('[data-testid="vue-message-ordered-list"] li');
    expect(revealedItems[0]?.element).toBe(firstItem);
    expect(revealedItems[1]?.element).toBe(pendingItem);
    expect(revealedItems[1]?.attributes("hidden")).toBeUndefined();
    expect(revealedItems[1]?.attributes("data-streaming-list-item")).toBe("true");
    expect(revealedItems[1]?.text()).toBe("Second");
    expect(revealedItems[1]?.classes()).toContain("rich-message-content__streaming-list-item");
  });

  it("keeps mid-list empty items visible so ordered counters stay stable", () => {
    const wrapper = mount(MessageList, {
      props: {
        isStreaming: true,
        messages: [message("assistant", ["1. First", "2.", "3. Third"].join("\n"))],
      },
    });
    const items = wrapper.findAll('[data-testid="vue-message-ordered-list"] li');

    expect(items).toHaveLength(3);
    expect(items[1]?.attributes("hidden")).toBeUndefined();
    expect(items[1]?.text()).toBe("");
    expect(wrapper.text()).toContain("Third");
  });

  it("does not reveal settled assistant history or human messages", () => {
    const wrapper = mount(MessageList, {
      props: {
        isStreaming: false,
        messages: [
          message("assistant", "已经完成"),
          message("human", "继续"),
        ],
      },
    });

    expect(wrapper.find('[data-testid="vue-message-streaming-reveal"]').exists()).toBe(false);
  });

  it("renders mermaid fences through the source-backed Mermaid renderer", async () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          message(
            "assistant",
            [
              "```mermaid",
              "flowchart TD",
              'A -- "sealed memory" -.-> F',
              "```",
            ].join("\n"),
          ),
        ],
      },
    });

    await flushPromises();

    expect(mermaidInitialize).toHaveBeenCalledWith({
      securityLevel: "strict",
      startOnLoad: false,
    });
    expect(mermaidRender).toHaveBeenCalledWith(
      expect.stringMatching(/^vue-message-mermaid-\d+-1$/),
      ['flowchart TD', 'A -. "sealed memory" .-> F'].join("\n"),
    );
    expect(wrapper.get('[data-testid="vue-message-mermaid-language"]').text()).toBe(
      "Mermaid 图表",
    );
    expect(wrapper.get('[data-testid="vue-message-mermaid-chart"]').attributes("aria-label")).toBe(
      "Mermaid chart",
    );
    expect(wrapper.get('[data-testid="vue-message-mermaid-chart"]').html()).toContain(
      "Rendered graph",
    );
    expect(wrapper.html()).not.toContain("onclick");
    expect(wrapper.html()).not.toContain("javascript:");
    expect(wrapper.find('[data-testid="vue-message-code-block"]').exists()).toBe(false);
  });

  it("falls back to the mermaid source when diagram rendering fails", async () => {
    mermaidRender.mockRejectedValueOnce(new Error("bad diagram"));
    const source = ["```mermaid", "flowchart TD", "A -->", "```"].join("\n");
    const wrapper = mount(MessageList, {
      props: {
        messages: [message("assistant", source)],
      },
    });

    await flushPromises();

    const fallback = wrapper.get('[data-testid="vue-message-mermaid-fallback"]');
    expect(fallback.text()).toContain("Mermaid 渲染失败：bad diagram");
    expect(fallback.text()).toContain("flowchart TD");
    expect(fallback.text()).toContain("A -->");
  });


  it("renders human-input tool artifacts and emits submitted responses", async () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          {
            content: "Need clarification",
            role: "tool",
            raw: {
              type: "tool",
              content: "Need clarification",
              artifact: {
                human_input: {
                  version: 1,
                  kind: "human_input_request",
                  source: "ask_clarification",
                  request_id: "request-1",
                  question: "Choose an approach?",
                  input_mode: "single_choice",
                  options: [{ id: "option-1", label: "Fast", value: "fast" }],
                },
              },
            },
          },
        ],
      },
    });

    expect(wrapper.get('[data-testid="vue-human-input-question"]').text()).toBe(
      "Choose an approach?",
    );

    await wrapper.get('[data-testid="vue-human-input-option-option-1"]').trigger("click");

    expect(wrapper.emitted("submitHumanInput")?.[0]?.[1]).toMatchObject({
      response_kind: "option",
      option_id: "option-1",
      value: "fast",
    });
  });

  it("renders assistant tool calls and tool results as rich cards", () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          {
            content: "Opening a page",
            role: "ai",
            raw: {
              type: "ai",
              content: "Opening a page",
              tool_calls: [
                {
                  id: "call-browser",
                  name: "browser_navigate",
                  args: { url: "https://example.com" },
                },
                {
                  id: "call-write",
                  name: "write_file",
                  args: {
                    path: "/mnt/user-data/outputs/app.ts",
                    content: "export const ok = true;",
                  },
                },
              ],
            },
          },
          {
            content: "Page title: DeerFlow",
            role: "tool",
            raw: {
              type: "tool",
              name: "browser_snapshot",
              tool_call_id: "call-browser",
              content: "Page title: DeerFlow",
            },
          },
        ],
      },
    });

    expect(
      wrapper.findAll('[data-testid="vue-tool-rich-card-title"]').map((node) => node.text()),
    ).toEqual([
      "在浏览器中打开 https://example.com",
      "写入 app.ts",
      "Browser Snapshot 结果",
    ]);
    expect(wrapper.get('[data-testid="vue-tool-rich-card-draft"]').text()).toContain(
      "export const ok = true;",
    );
  });
});

function message(role: string, content: string): StreamViewMessage {
  return {
    content,
    raw: { content, role },
    role,
  };
}
