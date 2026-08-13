<!--
  【文件职责】     mermaid 图渲染：解析成功换成 SVG，未成功/失败时保持代码块。
  【对应 frontend/】 无源文件可搬——`@streamdown/mermaid` 的 dist 只有 489 字节，
                    真正的 UI 与代码块 UI 同在 streamdown 那个 67,773 字节的 chunk 里
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     mermaid（动态 import）· ./CodeBlock.vue
  【边界与注意】   ① **流式期间必须容忍解析失败。** mermaid 语法在一条消息写完之前几乎
                   一直是不合法的（`graph TD; A--` 这种中间态每个 chunk 都会出现），
                   `mermaid.parse` 会抛。所以失败不是错误路径，是**常态路径**——
                   退回代码块，等下一个 chunk 再试。把它当异常处理（弹错、红框、
                   或者让错误冒到 `onErrorCaptured`）会让每条含图的消息在流式期间闪烁。

                   ② mermaid 是**惰性 import**。它压缩后仍有数百 KB，且会注册全局 config；
                   静态引入会把它塞进每个加载 markdown 的包里，而绝大多数消息没有图。

                   ③ 渲染用 `mermaid.render` 拿 SVG 字符串再 `v-html`。这是本层唯一一处
                   `v-html`：输入是 mermaid 自己生成的 SVG，不是模型输出的原始 HTML——
                   模型输出在此之前已经被当作**代码块文本**处理过，不经过 HTML 解析。
                   不要把这个口子扩大到别的地方。

                   ④ 每次渲染要一个唯一 id：mermaid 会用它建临时 DOM 节点，
                   同页多张图共用 id 会互相覆盖。
-->

<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";

import CodeBlock from "./CodeBlock.vue";

const props = withDefaults(
  defineProps<{
    code: string;
    /** 深色主题下换 mermaid 内置深色配色。 */
    dark?: boolean;
  }>(),
  { dark: false },
);

const svg = shallowRef<string | null>(null);
const renderSeq = ref(0);

watch(
  // ⚠️ `immediate: true`（05 M5）：watch 默认惰性。不加这一条，首帧永远不渲染，
  // 只有当 code 之后再变一次才会出图——非流式消息（历史记录）于是永远是代码块。
  () => [props.code, props.dark] as const,
  async ([code, dark]) => {
    if (!code.trim()) {
      svg.value = null;
      return;
    }
    const seq = (renderSeq.value += 1);
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: dark ? "dark" : "default",
        // 图里的文本来自模型输出，按不可信处理。
        securityLevel: "strict",
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
    class="border-border bg-sidebar my-4 flex w-full flex-col gap-2 rounded-xl border p-2"
    data-streamdown="mermaid-block"
  >
    <!-- eslint-disable vue/no-v-html —— 本层唯一一处，理由见文件头 ③ -->
    <div
      aria-label="Mermaid chart"
      class="bg-background flex justify-center overflow-x-auto rounded-md p-4"
      data-streamdown="mermaid"
      v-html="svg"
    />
    <!-- eslint-enable vue/no-v-html -->
  </div>
  <CodeBlock v-else :code="code" language="mermaid" />
</template>
