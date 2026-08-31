<!--
  【文件职责】     mermaid 图槽位：解析成功换成带工具栏的图块，未成功/失败时保持代码块。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     mermaid（动态 import）· ./CodeBlock.vue · ./MarkdownCopyButton.vue ·
                    ./MermaidChart.vue · ./MermaidDownloadMenu.vue · ./MermaidFullscreen.vue
  【边界与注意】   ① **流式期间必须容忍解析失败。** mermaid 语法在一条消息写完之前几乎
                   一直是不合法的（`graph TD; A--` 这种中间态每个 chunk 都会出现），
                   `mermaid.parse` 会抛。所以失败不是错误路径，是**常态路径**——
                   退回代码块，等下一个 chunk 再试。把它当异常处理（弹错、红框、
                   或者让错误冒到 `onErrorCaptured`）会让每条含图的消息在流式期间闪烁。

                   ② **未出图时本仓画的是代码块，上游画的是占位/加载/红色错误框。**
                   这是一处**有意保留的分叉**，不是还没做：上游 `Mermaid` 组件在每次
                   chart 文本变化时都会清错、重渲，渲染失败就落到
                   `rounded-md bg-red-50` 的 `Mermaid Error:` 框——而 ① 说的中间态
                   在流式期间每个 chunk 都出现一次，于是那个红框会一路闪。本仓在这三种
                   状态下渲染的是同一段源码的代码块：内容始终可读，形状不跳。
                   代价是台账测不到的两处差异（占位高度 `min-h-[200px]`、错误框的
                   `Show Code` 折叠），已在提交说明里单独列出。

                   ③ 渲染用 `mermaid.render` 拿 SVG 字符串再 `v-html`。这是本层唯一一处
                   `v-html`：输入是 mermaid 自己生成的 SVG，不是模型输出的原始 HTML——
                   模型输出在此之前已经被当作**代码块文本**处理过，不经过 HTML 解析。
                   不要把这个口子扩大到别的地方。

                   ④ 每次渲染要一个唯一 id：mermaid 会用它建临时 DOM 节点，
                   同页多张图共用 id 会互相覆盖。

                   ⑤ **初始化参数与上游 `@streamdown/mermaid` 逐项一致**，包括
                   `fontFamily: "monospace"`。字体不是装饰：mermaid 按字体量文字宽度
                   再决定节点尺寸和整张图的 viewBox，换一个字体整张图的几何就变了。
                   `theme` 恒为 `"default"`——上游没有接主题，深色下两边一样是浅色图。

                   ⑥ 工具栏是**上游 streamdown 的形状**，不是本仓的 shadcn primitive：
                   下拉不是 DropdownMenu、全屏不是 Dialog、图标不是 lucide。
                   理由分别写在 MermaidDownloadMenu.vue / MermaidFullscreen.vue /
                   MarkdownIcon.vue 的文件头里。
-->

<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";

import CodeBlock from "./CodeBlock.vue";
import MarkdownCopyButton from "./MarkdownCopyButton.vue";
import MermaidChart from "./MermaidChart.vue";
import MermaidDownloadMenu from "./MermaidDownloadMenu.vue";
import MermaidFullscreen from "./MermaidFullscreen.vue";

const props = defineProps<{ code: string }>();

/*
  围栏语言标签。上游把它写死成字面量 `"mermaid"`（这条分支只在 language==="mermaid"
  时才走到），本仓提成常量而不是模板里的文本节点——`i18n` source guard 只放行
  表达式里的标识符形字面量，模板文本节点一律当成未翻译文案。它是语言标识不是文案。
*/
const LANGUAGE = "mermaid";

const svg = shallowRef<string | null>(null);
const renderSeq = ref(0);

watch(
  // ⚠️ `immediate: true`（05 M5）：watch 默认惰性。不加这一条，首帧永远不渲染，
  // 只有当 code 之后再变一次才会出图——非流式消息（历史记录）于是永远是代码块。
  () => props.code,
  async (code) => {
    if (!code.trim()) {
      svg.value = null;
      return;
    }
    const seq = (renderSeq.value += 1);
    try {
      const mermaid = (await import("mermaid")).default;
      // 见文件头 ⑤：与 @streamdown/mermaid 的默认 config 逐项一致。
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        // 图里的文本来自模型输出，按不可信处理。
        securityLevel: "strict",
        fontFamily: "monospace",
        suppressErrorRendering: true,
      });
      await mermaid.parse(code);
      const result = await mermaid.render(`mermaid-${seq}`, code);
      // 晚到的结果不许覆盖新内容——流式期间每个 chunk 都会触发一次渲染。
      if (seq !== renderSeq.value) return;
      svg.value = result.svg;
    } catch {
      // 流式中间态解析失败是常态，见文件头 ①。保持上一次成功的图，
      // 没有成功过就保持代码块。
      if (seq === renderSeq.value && svg.value === null) svg.value = null;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    v-if="svg"
    class="group border-border bg-sidebar language-mermaid relative my-4 flex w-full flex-col gap-2 rounded-xl border p-2"
    data-streamdown="mermaid-block"
  >
    <div class="text-muted-foreground flex h-8 items-center text-xs">
      <span class="ml-1 font-mono lowercase">{{ LANGUAGE }}</span>
    </div>
    <div
      class="pointer-events-none sticky top-2 z-10 -mt-10 flex h-8 items-center justify-end"
    >
      <div
        class="border-sidebar bg-sidebar/80 supports-[backdrop-filter]:bg-sidebar/70 pointer-events-auto flex shrink-0 items-center gap-2 rounded-md border px-1.5 py-1 supports-[backdrop-filter]:backdrop-blur"
        data-streamdown="mermaid-block-actions"
      >
        <MermaidDownloadMenu :code="props.code" :svg="svg" />
        <MarkdownCopyButton :code="props.code" />
        <MermaidFullscreen :svg="svg" />
      </div>
    </div>
    <div class="border-border bg-background rounded-md border">
      <MermaidChart :svg="svg" />
    </div>
  </div>
  <CodeBlock v-else :code="props.code" language="mermaid" />
</template>
