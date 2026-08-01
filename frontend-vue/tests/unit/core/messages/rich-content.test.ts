import { describe, expect, it } from "vitest";

import {
  applyStreamingReveal,
  capMarkdownNesting,
  collectCitationSources,
  compactDisplayMathBlocks,
  getSafeRichMarkdown,
  isSafeHref,
  normalizeLatexMathDelimiters,
  normalizeMermaidCode,
  parseRichContent,
  parseRichInline,
  stripLeakedSystemTags,
} from "../../../../app/core/messages/rich-content";

describe("rich message content", () => {
  it("parses markdown paragraphs, lists, code fences, and inline code", () => {
    expect(parseRichContent("Hello `DeerFlow`\n\n- one\n- two\n\n```ts\nconst ok = true;\n```")).toEqual([
      {
        parts: [
          { text: "Hello ", type: "text" },
          { text: "DeerFlow", type: "code" },
        ],
        type: "paragraph",
      },
      {
        items: [
          [{ text: "one", type: "text" }],
          [{ text: "two", type: "text" }],
        ],
        type: "list",
      },
      {
        code: "const ok = true;",
        language: "ts",
        type: "code",
      },
    ]);
  });

  it("resolves safe links, citation labels, unsafe links, and artifact images", () => {
    const parts = parseRichInline(
      "[site](https://example.com) [citation:doc-1](/mnt/report.md#p1) [bad](javascript:alert(1)) ![chart](chart.png)",
      {
        artifactPaths: ["/mnt/user-data/outputs/chart.png"],
        threadId: "thread-a",
      },
    );

    expect(parts).toEqual([
      {
        citationLabel: null,
        external: true,
        href: "https://example.com",
        label: "site",
        type: "link",
      },
      { text: " ", type: "text" },
      {
        citationLabel: "doc-1",
        external: false,
        href: "/api/threads/thread-a/artifacts/mnt/report.md#p1",
        label: "citation:doc-1",
        type: "link",
      },
      { text: " ", type: "text" },
      { href: "javascript:alert(1", label: "bad", type: "unsafe-link" },
      { text: ") ", type: "text" },
      {
        alt: "chart",
        src: "/api/threads/thread-a/artifacts/mnt/user-data/outputs/chart.png",
        type: "image",
      },
    ]);
  });

  it("parses React Streamdown remark-gfm-backed URL and email autolink literals", () => {
    expect(
      parseRichInline(
        "参考 https://example.com/report?q=deerflow, www.example.com/docs, 和 support@example.com.",
      ),
    ).toEqual([
      { text: "参考 ", type: "text" },
      {
        citationLabel: null,
        external: true,
        href: "https://example.com/report?q=deerflow",
        label: "https://example.com/report?q=deerflow",
        type: "link",
      },
      { text: ", ", type: "text" },
      {
        citationLabel: null,
        external: true,
        href: "http://www.example.com/docs",
        label: "www.example.com/docs",
        type: "link",
      },
      { text: ", 和 ", type: "text" },
      {
        citationLabel: null,
        external: false,
        href: "mailto:support@example.com",
        label: "support@example.com",
        type: "link",
      },
      { text: ".", type: "text" },
    ]);
  });

  it("trims GFM autolink literal punctuation and unmatched brackets", () => {
    expect(parseRichInline("(www.example.com/path). user@example.com,")).toMatchObject([
      { text: "(", type: "text" },
      {
        href: "http://www.example.com/path",
        label: "www.example.com/path",
        type: "link",
      },
      { text: "). ", type: "text" },
      {
        href: "mailto:user@example.com",
        label: "user@example.com",
        type: "link",
      },
      { text: ",", type: "text" },
    ]);
  });

  it("parses CommonMark reference-style links and images while hiding definitions", () => {
    expect(
      parseRichContent(
        [
          "See [Gateway][Gateway Contract], [citation:paper][], [Shortcut], and [bad][Unsafe].",
          "",
          "![chart][chart ref]",
          "",
          "[ gateway  contract ]: <https://example.com/gateway>",
          "[citation:paper]: /mnt/report.md#p1",
          "[shortcut]: https://example.com/shortcut",
          "[unsafe]: javascript:alert(1)",
          "[Chart Ref]: chart.png",
        ].join("\n"),
        {
          artifactPaths: ["/mnt/user-data/outputs/chart.png"],
          threadId: "thread-a",
        },
      ),
    ).toEqual([
      {
        parts: [
          { text: "See ", type: "text" },
          {
            citationLabel: null,
            external: true,
            href: "https://example.com/gateway",
            label: "Gateway",
            type: "link",
          },
          { text: ", ", type: "text" },
          {
            citationLabel: "paper",
            external: false,
            href: "/api/threads/thread-a/artifacts/mnt/report.md#p1",
            label: "citation:paper",
            type: "link",
          },
          { text: ", ", type: "text" },
          {
            citationLabel: null,
            external: true,
            href: "https://example.com/shortcut",
            label: "Shortcut",
            type: "link",
          },
          { text: ", and ", type: "text" },
          { href: "javascript:alert(1)", label: "bad", type: "unsafe-link" },
          { text: ".", type: "text" },
        ],
        type: "paragraph",
      },
      {
        parts: [
          {
            alt: "chart",
            src: "/api/threads/thread-a/artifacts/mnt/user-data/outputs/chart.png",
            type: "image",
          },
        ],
        type: "paragraph",
      },
    ]);
  });

  it("does not parse reference-style text inside inline code or raw HTML", () => {
    const referenceDefinitions = new Map([["ref", "https://example.com"]]);

    expect(
      parseRichInline("`[doc][ref]` <span>[doc][ref]</span> [doc][ref]", {
        referenceDefinitions,
      }),
    ).toEqual([
      { text: "[doc][ref]", type: "code" },
      { text: " ", type: "text" },
      { html: "<span>[doc][ref]</span>", type: "html" },
      { text: " ", type: "text" },
      {
        citationLabel: null,
        external: true,
        href: "https://example.com",
        label: "doc",
        type: "link",
      },
    ]);
  });

  it("does not autolink URL-like text inside inline code or raw HTML", () => {
    expect(parseRichInline("`https://example.com`")).toEqual([
      { text: "https://example.com", type: "code" },
    ]);

    expect(parseRichInline('<a href="https://example.com">safe</a>')).toEqual([
      {
        html: '<a href="https://example.com" target="_blank" rel="noopener noreferrer">safe</a>',
        type: "html",
      },
    ]);
  });

  it("parses pipe tables with rich inline cells and normalized row widths", () => {
    expect(
      parseRichContent(
        [
          "| Name | Status | Link |",
          "| --- | :---: | --- |",
          "| `Gateway` | ready | [source](https://example.com) |",
          "| Scheduler | pending |",
        ].join("\n"),
      ),
    ).toEqual([
      {
        alignments: [null, "center", null],
        headers: [
          [{ text: "Name", type: "text" }],
          [{ text: "Status", type: "text" }],
          [{ text: "Link", type: "text" }],
        ],
        rows: [
          [
            [{ text: "Gateway", type: "code" }],
            [{ text: "ready", type: "text" }],
            [
              {
                citationLabel: null,
                external: true,
                href: "https://example.com",
                label: "source",
                type: "link",
              },
            ],
          ],
          [
            [{ text: "Scheduler", type: "text" }],
            [{ text: "pending", type: "text" }],
            [],
          ],
        ],
        type: "table",
      },
    ]);
  });

  it("parses GFM table alignment markers from the divider row", () => {
    expect(
      parseRichContent(
        [
          "| Left | Right | Center | Default |",
          "| :--- | ---: | :---: | --- |",
          "| one | two | three | four |",
        ].join("\n"),
      ),
    ).toEqual([
      {
        alignments: ["left", "right", "center", null],
        headers: [
          [{ text: "Left", type: "text" }],
          [{ text: "Right", type: "text" }],
          [{ text: "Center", type: "text" }],
          [{ text: "Default", type: "text" }],
        ],
        rows: [
          [
            [{ text: "one", type: "text" }],
            [{ text: "two", type: "text" }],
            [{ text: "three", type: "text" }],
            [{ text: "four", type: "text" }],
          ],
        ],
        type: "table",
      },
    ]);
  });

  it("keeps escaped and code pipe characters inside GFM table cells", () => {
    expect(
      parseRichContent(
        [
          "| Literal | Code | Link |",
          "| --- | --- | --- |",
          "| a \\| b | `x|y` | [A\\|B](https://example.com/a) |",
        ].join("\n"),
      ),
    ).toEqual([
      {
        headers: [
          [{ text: "Literal", type: "text" }],
          [{ text: "Code", type: "text" }],
          [{ text: "Link", type: "text" }],
        ],
        rows: [
          [
            [{ text: "a | b", type: "text" }],
            [{ text: "x|y", type: "code" }],
            [
              {
                citationLabel: null,
                external: true,
                href: "https://example.com/a",
                label: "A|B",
                type: "link",
              },
            ],
          ],
        ],
        type: "table",
      },
    ]);
  });

  it("parses React Streamdown remark-gfm-backed footnote references and definitions", () => {
    expect(
      parseRichContent(
        [
          "Alpha[^First Note] and again[^first note]. Code `[^first note]` stays literal.",
          "",
          "[^first note]: Footnote **body** with [link](https://example.com).",
          "    Continued line with \\*literal\\* marker.",
        ].join("\n"),
      ),
    ).toEqual([
      {
        parts: [
          { text: "Alpha", type: "text" },
          { index: 1, label: "first note", type: "footnote-ref" },
          { text: " and again", type: "text" },
          { index: 1, label: "first note", type: "footnote-ref" },
          { text: ". Code ", type: "text" },
          { text: "[^first note]", type: "code" },
          { text: " stays literal.", type: "text" },
        ],
        type: "paragraph",
      },
      {
        items: [
          {
            label: "first note",
            parts: [
              { text: "Footnote ", type: "text" },
              {
                parts: [{ text: "body", type: "text" }],
                type: "strong",
              },
              { text: " with ", type: "text" },
              {
                citationLabel: null,
                external: true,
                href: "https://example.com",
                label: "link",
                type: "link",
              },
              { text: ".\nContinued line with *literal* marker.", type: "text" },
            ],
          },
        ],
        type: "footnotes",
      },
    ]);
  });

  it("does not render unreferenced footnote definitions or footnote-looking code", () => {
    expect(
      parseRichContent(
        ["Text only.", "", "[^unused]: hidden", "", "```md", "[^code]: literal", "```"].join(
          "\n",
        ),
      ),
    ).toEqual([
      {
        parts: [{ text: "Text only.", type: "text" }],
        type: "paragraph",
      },
      {
        code: "[^code]: literal",
        language: "md",
        type: "code",
      },
    ]);
  });

  it("parses headings, blockquotes, ordered lists, and normalized code languages", () => {
    expect(
      parseRichContent(
        "# Plan\n\n###### Deep anchor ##\n\n# Keep C#\n\n> source-backed only\n\n1. inspect\n2. implement\n\n```TypeScript\nconst ok = true;\n```",
      ),
    ).toEqual([
      {
        level: 1,
        parts: [{ text: "Plan", type: "text" }],
        type: "heading",
      },
      {
        level: 6,
        parts: [{ text: "Deep anchor", type: "text" }],
        type: "heading",
      },
      {
        level: 1,
        parts: [{ text: "Keep C#", type: "text" }],
        type: "heading",
      },
      {
        parts: [{ text: "source-backed only", type: "text" }],
        type: "blockquote",
      },
      {
        items: [
          [{ text: "inspect", type: "text" }],
          [{ text: "implement", type: "text" }],
        ],
        type: "ordered-list",
      },
      {
        code: "const ok = true;",
        language: "typescript",
        type: "code",
      },
    ]);
  });

  it("parses GFM task list markers from React Streamdown remark-gfm", () => {
    expect(
      parseRichContent(
        "- [x] shipped `parser`\n- [ ] review [contract](https://example.com)\n- normal item",
      ),
    ).toEqual([
      {
        checkedItems: [true, false, null],
        items: [
          [
            { text: "shipped ", type: "text" },
            { text: "parser", type: "code" },
          ],
          [
            { text: "review ", type: "text" },
            {
              citationLabel: null,
              external: true,
              href: "https://example.com",
              label: "contract",
              type: "link",
            },
          ],
          [{ text: "normal item", type: "text" }],
        ],
        type: "list",
      },
    ]);
  });

  it("parses GFM strikethrough while preserving single tildes", () => {
    expect(parseRichInline("状态：~~已取消~~，周六23~30℃。")).toEqual([
      { text: "状态：", type: "text" },
      {
        parts: [{ text: "已取消", type: "text" }],
        type: "strikethrough",
      },
      { text: "，周六23~30℃。", type: "text" },
    ]);
  });

  it("does not treat single or longer tilde runs as GFM strikethrough", () => {
    expect(
      parseRichInline("~~done~~ ~not deleted~ ~~~literal~~~ `~~code~~` <span>~~html~~</span>"),
    ).toEqual([
      {
        parts: [{ text: "done", type: "text" }],
        type: "strikethrough",
      },
      { text: " ~not deleted~ ~~~literal~~~ ", type: "text" },
      { text: "~~code~~", type: "code" },
      { text: " ", type: "text" },
      { html: "<span>~~html~~</span>", type: "html" },
    ]);
  });

  it("parses React Streamdown-backed strong and emphasis inline markdown", () => {
    expect(parseRichInline("结论：**强提醒**，请 *复核* `**code**`。")).toEqual([
      { text: "结论：", type: "text" },
      {
        parts: [{ text: "强提醒", type: "text" }],
        type: "strong",
      },
      { text: "，请 ", type: "text" },
      {
        parts: [{ text: "复核", type: "text" }],
        type: "emphasis",
      },
      { text: " ", type: "text" },
      { text: "**code**", type: "code" },
      { text: "。", type: "text" },
    ]);
  });

  it("parses CommonMark hard line breaks without splitting soft line breaks", () => {
    expect(parseRichInline("第一行  \n第二行\\\n第三行\nsoft")).toEqual([
      { text: "第一行", type: "text" },
      { type: "line-break" },
      { text: "第二行", type: "text" },
      { type: "line-break" },
      { text: "第三行\nsoft", type: "text" },
    ]);
  });

  it("decodes CommonMark character references in visible inline text", () => {
    expect(parseRichInline("Tom &amp; Jerry &#x1F680; &copy; &unknown; \\&amp;")).toEqual([
      { text: "Tom & Jerry 🚀 © &unknown; &amp;", type: "text" },
    ]);
  });

  it("renders escaped markdown punctuation as visible text", () => {
    expect(parseRichInline("\\*literal\\* \\{label\\} \\\\**strong**")).toEqual([
      { text: "*literal* {label} \\", type: "text" },
      {
        parts: [{ text: "strong", type: "text" }],
        type: "strong",
      },
    ]);
  });

  it("decodes visible link labels and image alt text without rewriting hrefs", () => {
    const referenceDefinitions = new Map([
      ["tom & jerry", "https://example.com/ref?x=1&amp;y=2"],
    ]);

    expect(
      parseRichInline(
        [
          "[Tom &amp; Jerry](https://example.com/path?x=1&amp;y=2)",
          "[Tom \\& Jerry][]",
          "![Chart &copy;](chart.png)",
        ].join(" "),
        {
          artifactPaths: ["/mnt/user-data/outputs/chart.png"],
          referenceDefinitions,
          threadId: "thread-a",
        },
      ),
    ).toEqual([
      {
        citationLabel: null,
        external: true,
        href: "https://example.com/path?x=1&amp;y=2",
        label: "Tom & Jerry",
        type: "link",
      },
      { text: " ", type: "text" },
      {
        citationLabel: null,
        external: true,
        href: "https://example.com/ref?x=1&amp;y=2",
        label: "Tom & Jerry",
        type: "link",
      },
      { text: " ", type: "text" },
      {
        alt: "Chart ©",
        src: "/api/threads/thread-a/artifacts/mnt/user-data/outputs/chart.png",
        type: "image",
      },
    ]);
  });

  it("keeps rich inline content around hard line breaks and excludes code or HTML internals", () => {
    expect(
      parseRichInline("**结论**  \n[link](https://example.com) `code  \nraw` <span>html  \nraw</span>"),
    ).toMatchObject([
      {
        parts: [{ text: "结论", type: "text" }],
        type: "strong",
      },
      { type: "line-break" },
      {
        href: "https://example.com",
        label: "link",
        type: "link",
      },
      { text: " ", type: "text" },
      { text: "code  \nraw", type: "code" },
      { text: " ", type: "text" },
      { html: "<span>html  \nraw</span>", type: "html" },
    ]);
  });

  it("keeps rich inline content inside strong and emphasis markers", () => {
    expect(parseRichInline("**`code` [link](https://example.com) \\(x\\)** and *~~done~~*")).toMatchObject([
      {
        parts: [
          { text: "code", type: "code" },
          { text: " ", type: "text" },
          {
            href: "https://example.com",
            label: "link",
            type: "link",
          },
          { text: " ", type: "text" },
          { source: "x", type: "math" },
        ],
        type: "strong",
      },
      { text: " and ", type: "text" },
      {
        parts: [
          {
            parts: [{ text: "done", type: "text" }],
            type: "strikethrough",
          },
        ],
        type: "emphasis",
      },
    ]);
  });

  it("does not parse strong or emphasis markers inside raw HTML", () => {
    expect(parseRichInline("<strong>**already html**</strong> and **markdown**")).toEqual([
      {
        html: "<strong>**already html**</strong>",
        type: "html",
      },
      { text: " and ", type: "text" },
      {
        parts: [{ text: "markdown", type: "text" }],
        type: "strong",
      },
    ]);
  });

  it("keeps rich inline content inside GFM strikethrough", () => {
    expect(parseRichInline("~~`code` [link](https://example.com) \\(x\\)~~")).toMatchObject([
      {
        parts: [
          { text: "code", type: "code" },
          { text: " ", type: "text" },
          {
            href: "https://example.com",
            label: "link",
            type: "link",
          },
          { text: " ", type: "text" },
          { source: "x", type: "math" },
        ],
        type: "strikethrough",
      },
    ]);
  });

  it("hides only trailing empty streaming list items like React Streamdown", () => {
    expect(
      parseRichContent(["1. First", "", "2."].join("\n"), {}, { streaming: true }),
    ).toEqual([
      {
        hiddenItems: [false, true],
        items: [[{ text: "First", type: "text" }], []],
        type: "ordered-list",
      },
    ]);

    expect(parseRichContent("- ", {}, { streaming: true })).toEqual([
      {
        hiddenItems: [true],
        items: [[]],
        type: "list",
      },
    ]);

    expect(
      parseRichContent(["1. First", "2.", "3. Third"].join("\n"), {}, { streaming: true }),
    ).toEqual([
      {
        items: [
          [{ text: "First", type: "text" }],
          [],
          [{ text: "Third", type: "text" }],
        ],
        type: "ordered-list",
      },
    ]);
  });

  it("keeps completed empty list items outside streaming treatment", () => {
    expect(parseRichContent(["1. First", "", "2."].join("\n"))).toEqual([
      {
        items: [[{ text: "First", type: "text" }], []],
        type: "ordered-list",
      },
    ]);
  });

  it("marks a streaming list item for marker reveal when content arrives", () => {
    const previousBlocks = parseRichContent(
      ["1. First", "", "2."].join("\n"),
      {},
      { streaming: true },
    );
    const nextBlocks = applyStreamingReveal(
      parseRichContent(
        ["1. First", "", "2. Second"].join("\n"),
        {},
        { streaming: true },
      ),
      previousBlocks,
    );

    expect(nextBlocks).toEqual([
      {
        items: [
          [{ text: "First", type: "text" }],
          [{ reveal: true, text: "Second", type: "text" }],
        ],
        revealItems: [false, true],
        type: "ordered-list",
      },
    ]);
  });

  it("parses mermaid fences as normalized diagram blocks", () => {
    expect(
      parseRichContent(
        [
          '```mermaid title="relationships"',
          "flowchart TD",
          '  A -- "sealed memory" -.-> F',
          "```",
          "",
          "~~~mermaid",
          "B-->C",
          "~~~",
        ].join("\n"),
      ),
    ).toEqual([
      {
        code: ['flowchart TD', '  A -. "sealed memory" .-> F'].join("\n"),
        type: "mermaid",
      },
      {
        code: "B-->C",
        type: "mermaid",
      },
    ]);

    expect(normalizeMermaidCode('A--"sealed memory"-.->F')).toBe(
      'A -. "sealed memory" .-> F',
    );
  });

  it("marks only newly streamed inline tails for reveal", () => {
    const previousBlocks = parseRichContent("正在分析 DeerFlow");
    const nextBlocks = applyStreamingReveal(
      parseRichContent("正在分析 DeerFlow 消息渲染"),
      previousBlocks,
    );

    expect(nextBlocks).toEqual([
      {
        parts: [
          { text: "正在分析 DeerFlow", type: "text" },
          { reveal: true, text: " 消息渲染", type: "text" },
        ],
        type: "paragraph",
      },
    ]);
  });

  it("normalizes React Streamdown-compatible math delimiters outside code", () => {
    expect(
      normalizeLatexMathDelimiters("Inline \\(E=mc^2\\)\n\n```ts\nconst raw = '\\\\(x\\\\)';\n```"),
    ).toBe("Inline $E=mc^2$\n\n```ts\nconst raw = '\\\\(x\\\\)';\n```");
    expect(compactDisplayMathBlocks("$$\na^2 +\nb^2\n$$")).toBe("$$\na^2 + b^2\n$$");
  });

  it("parses React Streamdown remark-math dollar delimiters with code exclusions", () => {
    const inlineParts = parseRichInline("Inline $E=mc^2$ and `$not_math$` <span>$html$</span>.");

    expect(inlineParts).toMatchObject([
      { text: "Inline ", type: "text" },
      { source: "E=mc^2", type: "math" },
      { text: " and ", type: "text" },
      { text: "$not_math$", type: "code" },
      { text: " ", type: "text" },
      { html: "<span>$html$</span>", type: "html" },
      { text: ".", type: "text" },
    ]);
    expect(inlineParts[1]?.type === "math" ? inlineParts[1].html : "").toContain("katex");

    expect(parseRichInline("$ $")).toEqual([{ text: "$ $", type: "text" }]);
    expect(parseRichInline("$unterminated")).toEqual([
      { text: "$unterminated", type: "text" },
    ]);
  });

  it("parses single-line display math without rewriting fenced code dollar blocks", () => {
    const blocks = parseRichContent(
      ["$$a^2 + b^2 = c^2$$", "", "```md", "$$literal$$", "```"].join("\n"),
    );

    expect(blocks[0]).toMatchObject({
      source: "a^2 + b^2 = c^2",
      type: "math",
    });
    expect(blocks[0]?.type === "math" ? blocks[0].html : "").toContain("katex-display");
    expect(blocks[1]).toEqual({
      code: "$$literal$$",
      language: "md",
      type: "code",
    });
  });

  it("caps pathological Streamdown nesting without rewriting code blocks", () => {
    const deepBlockquote = `${">".repeat(105)} protected`;
    const deepList = `${" ".repeat(240)}- protected`;
    const fenced = [
      "```md",
      `${">".repeat(105)} literal`,
      `${" ".repeat(240)}literal`,
      "```",
    ].join("\n");

    expect(capMarkdownNesting(deepBlockquote)).toBe(`${">".repeat(100)} protected`);
    expect(capMarkdownNesting(deepList)).toBe(`${" ".repeat(200)}- protected`);
    expect(capMarkdownNesting(fenced)).toBe(fenced);
  });

  it("strips leaked system marker tags only outside code-shaped regions", () => {
    const markdown = [
      "<memory>visible reminder</memory>",
      "",
      "```html",
      "<memory>literal fenced code</memory>",
      "```",
      "    <memory>literal indented code</memory>",
    ].join("\n");

    expect(stripLeakedSystemTags(markdown)).toBe(
      [
        "visible reminder",
        "",
        "```html",
        "<memory>literal fenced code</memory>",
        "```",
        "    <memory>literal indented code</memory>",
      ].join("\n"),
    );
  });

  it("uses the safe rich markdown preprocessing at the parser boundary", () => {
    const blocks = parseRichContent(`${">".repeat(105)} <memory>bounded</memory>`);

    expect(blocks).toEqual([
      {
        parts: [{ text: `${">".repeat(99)} bounded`, type: "text" }],
        type: "blockquote",
      },
    ]);
    expect(getSafeRichMarkdown("\\(E=mc^2\\)")).toBe("$E=mc^2$");
  });

  it("renders inline and display math through KaTeX-backed safe HTML", () => {
    const inlineParts = parseRichInline("Energy: \\(E=mc^2\\).");
    expect(inlineParts).toMatchObject([
      { text: "Energy: ", type: "text" },
      { source: "E=mc^2", type: "math" },
      { text: ".", type: "text" },
    ]);
    expect(inlineParts[1]?.type === "math" ? inlineParts[1].html : "").toContain("katex");

    const blocks = parseRichContent("\\[\na^2 + b^2 = c^2\n\\]");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      source: "a^2 + b^2 = c^2",
      type: "math",
    });
    expect(blocks[0]?.type === "math" ? blocks[0].html : "").toContain("katex-display");
  });

  it("keeps a safe subset of inline HTML while stripping dangerous tags and attributes", () => {
    const parts = parseRichInline(
      'Use <strong>bold</strong>, <a href="https://example.com" onclick="x()">ok</a>, <a href="javascript:alert(1)">bad</a>, <script>alert(1)</script>.',
    );

    expect(parts).toHaveLength(1);
    const html = parts[0]?.type === "html" ? parts[0].html : "";
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">ok</a>');
    expect(html).toContain("<a>bad</a>");
    expect(html).toContain("alert(1)");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script>");
  });

  it("keeps pipe-delimited text as a paragraph without a markdown divider row", () => {
    expect(parseRichContent("alpha | beta\nnot a divider")).toEqual([
      {
        parts: [{ text: "alpha | beta\nnot a divider", type: "text" }],
        type: "paragraph",
      },
    ]);
  });

  it("collects deduplicated citation sources from parsed blocks", () => {
    const blocks = parseRichContent(
      [
        "See [citation:paper](/mnt/report.md#p1) and [citation:paper](/mnt/report.md#p1).",
        "",
        "| Source | Link |",
        "| --- | --- |",
        "| web | [citation:web](https://example.com/source) |",
      ].join("\n"),
      { threadId: "thread-a" },
    );

    expect(collectCitationSources(blocks)).toEqual([
      {
        href: "/api/threads/thread-a/artifacts/mnt/report.md#p1",
        label: "paper",
      },
      {
        href: "https://example.com/source",
        label: "web",
      },
    ]);
  });

  it("blocks protocol-relative and executable hrefs", () => {
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("/workspace/chats/a")).toBe(true);
    expect(isSafeHref("#local")).toBe(true);
    expect(isSafeHref("//example.com")).toBe(false);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false);
  });
});
