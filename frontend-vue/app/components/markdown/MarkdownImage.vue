<!--
  【文件职责】     markdown 图片：外框、悬停遮罩、下载按钮与加载失败回退。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认 MarkdownImage 组件
  【依赖关系】     ./MarkdownIcon.vue · @/lib/utils · $i18n（globalProperties）
  【边界与注意】   逐字对着 streamdown `dist/chunk-BO2N2NFS.js` 的 image 组件写
                   （streamdown 2.5.0）。本仓此前**没有**这个镜像，于是 artifact 预览与
                   关于页渲染的是裸 `<img>`：没有外框、没有下载入口、加载失败时留一张
                   碎图而不是一句说明。聊天路径看不出来——`MessageList` 用自己的
                   `MarkdownMessageImage` 把 `img` 覆盖掉了（线索 111）。

                   三条判据照抄，不要"优化"：
                   ① **下载按钮只在图片真的加载成功后才出现**（或者调用方显式给了
                      width/height）。图都没出来就给一颗下载按钮，点下去只会存到一个
                      坏文件。挂载时要补一次判断：缓存命中的图片不会再派发 load 事件，
                      只能读 `complete` + `naturalWidth`。
                   ② **失败回退只在没有显式尺寸时出现**：给了尺寸说明调用方在占位，
                      这时候塞一句"图片不可用"会把布局撑坏。
                   ③ **下载先按 URL 里的文件名**，只有末段没有像样扩展名（>4 字符或
                      没有点）时才回落到 `alt` + 按 MIME 猜的扩展名。整条 fetch 失败
                      就退回新标签页打开——不要静默什么都不做。

                   `src` 为空时整块不渲染（上游 `return o ? ... : null`）。

                   两句文案走 `markdown.*`，与 CodeBlock 的下载按钮同一条路子：
                   streamdown 把它们写死成英文，本仓照 `deerflow-untranslated-primitive-names`
                   的约定原样照抄（zh-CN 也是同一串英文）。L2 不许 import composable，
                   但模板里的 `$i18n` 走的是 globalProperties 不是 import，这一条与
                   CodeBlock.vue 一致。
-->

<script setup lang="ts">
import { computed, onMounted, ref, useAttrs } from "vue";

import { cn } from "@/lib/utils";

import MarkdownIcon from "./MarkdownIcon.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  src?: string;
  alt?: string;
  class?: string;
}>();

const attrs = useAttrs();
const element = ref<HTMLImageElement | null>(null);
const loaded = ref(false);
const errored = ref(false);

/** 调用方显式给了尺寸时，按"占位中"处理：下载可用，失败也不加回退文案。 */
const hasExplicitSize = computed(
  () => attrs.width !== undefined || attrs.height !== undefined,
);
const showDownload = computed(
  () => (loaded.value || hasExplicitSize.value) && !errored.value,
);
const showFallback = computed(() => errored.value && !hasExplicitSize.value);

const passthrough = computed(() => {
  const { node: _node, class: _class, ...rest } = attrs;
  void _node;
  void _class;
  return rest;
});

onMounted(() => {
  // 缓存命中的图片不会再派发 load，只能自己读一次。
  const image = element.value;
  if (!image?.complete) return;
  const ok = image.naturalWidth > 0;
  loaded.value = ok;
  errored.value = !ok;
});

const MIME_EXTENSIONS: [string, string][] = [
  ["jpeg", "jpg"],
  ["jpg", "jpg"],
  ["png", "png"],
  ["svg", "svg"],
  ["gif", "gif"],
  ["webp", "webp"],
];

function extensionFor(type: string) {
  return (
    MIME_EXTENSIONS.find(([needle]) => type.includes(needle))?.[1] ?? "png"
  );
}

async function download() {
  const src = props.src;
  if (!src) return;
  try {
    const blob = await (await fetch(src)).blob();
    const basename =
      new URL(src, window.location.origin).pathname.split("/").pop() || "";
    const extension = basename.split(".").pop();
    const hasUsableExtension =
      basename.includes(".") &&
      extension !== undefined &&
      extension.length <= 4;
    const name = hasUsableExtension
      ? basename
      : `${(props.alt || basename || "image").replace(/\.[^/.]+$/, "")}.${extensionFor(blob.type)}`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(src, "_blank");
  }
}
</script>

<template>
  <div
    v-if="props.src"
    class="group relative my-4 inline-block"
    data-streamdown="image-wrapper"
  >
    <img
      ref="element"
      v-bind="passthrough"
      :alt="props.alt"
      :class="
        cn('max-w-full rounded-lg', showFallback && 'hidden', props.class)
      "
      data-streamdown="image"
      :src="props.src"
      @load="
        loaded = true;
        errored = false;
      "
      @error="
        loaded = false;
        errored = true;
      "
    />
    <span
      v-if="showFallback"
      class="text-muted-foreground text-xs italic"
      data-streamdown="image-fallback"
      >{{ $i18n.t.value.markdown.imageNotAvailable }}</span
    >
    <div
      class="pointer-events-none absolute inset-0 hidden rounded-lg bg-black/10 group-hover:block"
    />
    <button
      v-if="showDownload"
      class="border-border bg-background/90 hover:bg-background absolute right-2 bottom-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border opacity-0 shadow-sm backdrop-blur-sm transition-all duration-200 group-hover:opacity-100"
      :title="$i18n.t.value.markdown.downloadImage"
      type="button"
      @click="download"
    >
      <MarkdownIcon name="DownloadIcon" :size="14" />
    </button>
  </div>
</template>
