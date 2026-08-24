/*
  【文件职责】     StreamMarkdown 的 React-equivalent 基础元素覆盖与代码块 / mermaid UI。
  【对应 frontend/】 streamdown default components · frontend/src/core/streamdown/components.tsx
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     richContentComponents
  【依赖关系】     vue · @/lib/utils · ./MarkdownPre.vue
  【边界与注意】   Tailwind preflight 会清掉原生列表标记；标题、强调、列表等必须在实际
                   MessageList 渲染链上带与 React Streamdown 相同的 class，不能只保留夹具。
*/

import { defineComponent, h, markRaw } from "vue";

import { cn } from "@/lib/utils";

import MarkdownPre from "./MarkdownPre.vue";
import MarkdownTable from "./MarkdownTable.vue";

function styledElement(
  componentName: string,
  tag: string,
  className: string,
  streamdownName: string,
) {
  return defineComponent({
    name: componentName,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => {
        const { node: _node, class: incomingClass, ...rest } = attrs;
        void _node;
        return h(
          tag,
          {
            ...rest,
            class: cn(className, incomingClass as string | undefined),
            "data-streamdown": streamdownName,
          },
          slots.default?.(),
        );
      };
    },
  });
}

const Heading1 = styledElement(
  "MarkdownHeading1",
  "h1",
  "mt-6 mb-2 text-3xl font-semibold",
  "heading-1",
);
const Heading2 = styledElement(
  "MarkdownHeading2",
  "h2",
  "mt-6 mb-2 text-2xl font-semibold",
  "heading-2",
);
const Heading3 = styledElement(
  "MarkdownHeading3",
  "h3",
  "mt-6 mb-2 text-xl font-semibold",
  "heading-3",
);
const Heading4 = styledElement(
  "MarkdownHeading4",
  "h4",
  "mt-6 mb-2 text-lg font-semibold",
  "heading-4",
);
const Heading5 = styledElement(
  "MarkdownHeading5",
  "h5",
  "mt-6 mb-2 text-base font-semibold",
  "heading-5",
);
const Heading6 = styledElement(
  "MarkdownHeading6",
  "h6",
  "mt-6 mb-2 text-sm font-semibold",
  "heading-6",
);
const Strong = styledElement(
  "MarkdownStrong",
  "span",
  "font-semibold",
  "strong",
);
const InlineCode = styledElement(
  "MarkdownInlineCode",
  "code",
  "rounded bg-muted px-1.5 py-0.5 font-mono text-sm",
  "inline-code",
);
const UnorderedList = styledElement(
  "MarkdownUnorderedList",
  "ul",
  "list-inside list-disc whitespace-normal [li_&]:pl-6",
  "unordered-list",
);
const OrderedList = styledElement(
  "MarkdownOrderedList",
  "ol",
  "list-inside list-decimal whitespace-normal [li_&]:pl-6",
  "ordered-list",
);
const ListItem = styledElement(
  "MarkdownListItem",
  "li",
  "py-1 [&>p]:inline",
  "list-item",
);
const Blockquote = styledElement(
  "MarkdownBlockquote",
  "blockquote",
  "my-4 border-l-4 border-muted-foreground/30 pl-4 text-muted-foreground italic",
  "blockquote",
);
const HorizontalRule = styledElement(
  "MarkdownHorizontalRule",
  "hr",
  "my-6 border-border",
  "horizontal-rule",
);
const Superscript = styledElement(
  "MarkdownSuperscript",
  "sup",
  "text-sm",
  "superscript",
);
const TableHead = styledElement(
  "MarkdownTableHead",
  "thead",
  "bg-muted/80",
  "table-header",
);
const TableBody = styledElement(
  "MarkdownTableBody",
  "tbody",
  "divide-y divide-border",
  "table-body",
);
const TableRow = styledElement(
  "MarkdownTableRow",
  "tr",
  "border-border",
  "table-row",
);
const TableHeaderCell = styledElement(
  "MarkdownTableHeaderCell",
  "th",
  "whitespace-nowrap px-4 py-2 text-left text-sm font-semibold",
  "table-header-cell",
);
const TableCell = styledElement(
  "MarkdownTableCell",
  "td",
  "px-4 py-2 text-sm",
  "table-cell",
);

/** 传给 `StreamMarkdown` 的 `components`。⚠️ 覆盖组件收到的是 `class` 不是 `className`。 */
export const richContentComponents = markRaw({
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
  strong: Strong,
  code: InlineCode,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  blockquote: Blockquote,
  hr: HorizontalRule,
  sup: Superscript,
  table: MarkdownTable,
  thead: TableHead,
  tbody: TableBody,
  tr: TableRow,
  th: TableHeaderCell,
  td: TableCell,
  pre: MarkdownPre,
} as const);
