/*
  【文件职责】     M3 的 gate：Vue 渲染层与 React 版对同一语料做归一化 DOM 等价比对。
  【对应 frontend/】 frontend/ 的 streamdown@2.5.0（录制成夹具）
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     tests/fixtures/{markdown-corpus.mjs,react-markdown-dom.json} ·
                   tests/support/dom-equivalence · app/components/markdown/StreamMarkdown.vue
  【边界与注意】   夹具用的是 React 侧 **components 全部退回同名内建标签** 的渲染
                   （`neutralHtml`）。这样比出来的差异只可能来自两处：unified 管线的装配，
                   和 `hast-util-to-jsx-runtime` 的两个宿主实现——正是 04 §1 给这个 gate
                   划的那条界。

                   不用 Streamdown 默认组件映射（`styledHtml`）当判据，是因为那 37 个槽位
                   是 Vercel 的产品 UI（表格工具栏、链接安全弹窗、全屏门户……），
                   而 02/04 已经裁决 UI 层走 shadcn-vue 逐字复制 cva，不复刻 streamdown。
                   把产品 UI 塞进这个 gate，等于让 M3 去交付 M4b 的组件层。
                   `styledHtml` 仍然录着，作为 M4b 的规格与代码块槽位的对照。

                   重录：`node scripts/record-react-markdown.mjs`
                   校验夹具未过期：`node scripts/record-react-markdown.mjs --check`
*/

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import {
  appRehypePlugins,
  appRemarkPlugins,
  defaultRehypePlugins,
  defaultRemarkPlugins,
  rawHtmlRehypePlugins,
  rehypeStreamingListItems,
} from "@/core/markdown/plugins";

import fixture from "../../fixtures/react-markdown-dom.json";
import {
  CORPUS,
  PRESET_DEFAULT,
  PRESET_RAW,
} from "../../fixtures/markdown-corpus.mjs";
import {
  normalizeChildren,
  normalizeHtml,
} from "../../support/dom-equivalence";

import type { PluggableList } from "unified";

interface FixtureEntry {
  preset: string;
  streaming: boolean;
  incomplete: boolean;
  neutralHtml: string;
  styledHtml: string;
}

const entries = fixture.entries as unknown as Record<string, FixtureEntry>;

function pluginsFor(entry: { preset: string; streaming?: boolean }): {
  remarkPlugins: PluggableList;
  rehypePlugins: PluggableList;
} {
  const streaming: PluggableList = entry.streaming
    ? [rehypeStreamingListItems]
    : [];
  if (entry.preset === PRESET_DEFAULT) {
    return {
      remarkPlugins: defaultRemarkPlugins,
      rehypePlugins: [...defaultRehypePlugins, ...streaming],
    };
  }
  const base =
    entry.preset === PRESET_RAW ? rawHtmlRehypePlugins : appRehypePlugins;
  return {
    remarkPlugins: appRemarkPlugins,
    rehypePlugins: [...base, ...streaming],
  };
}

describe("M3 gate · 归一化 DOM 等价", () => {
  it("语料与夹具一一对应（夹具过期时不能假绿）", () => {
    expect(Object.keys(entries).sort()).toEqual(
      CORPUS.map((entry: { id: string }) => entry.id).sort(),
    );
  });

  for (const entry of CORPUS as {
    id: string;
    preset: string;
    markdown: string;
    streaming?: boolean;
    incomplete?: boolean;
  }[]) {
    it(`${entry.id}（${entry.preset}${entry.streaming ? " streaming" : ""}${
      entry.incomplete ? " incomplete" : ""
    }）`, () => {
      const recorded = entries[entry.id] as FixtureEntry;
      const wrapper = mount(StreamMarkdown, {
        props: {
          content: entry.markdown,
          parseIncompleteMarkdown: entry.incomplete === true,
          ...pluginsFor(entry),
        },
      });

      // React 侧的顶层就是 Streamdown 的根 div，Vue 侧同样；两边都从根的**子节点**比起，
      // 根自身的 class 由 `rootClass` 保持一致，单独断言一次即可。
      const reactTree = normalizeHtml(recorded.neutralHtml);
      const reactRoot = reactTree.find(
        (node) => node.type === "element" && node.tag === "div",
      );
      expect(reactRoot?.type).toBe("element");

      expect(normalizeChildren(wrapper.element)).toEqual(
        reactRoot && reactRoot.type === "element" ? reactRoot.children : [],
      );
      wrapper.unmount();
    });
  }
});
