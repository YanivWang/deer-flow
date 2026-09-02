<!--
  【文件职责】     markdown 里的链接：先确认再跳转。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     ./MarkdownLinkSafetyModal.vue · @/lib/utils
  【边界与注意】   逐字对着 streamdown `dist/chunk-BO2N2NFS.js` 的 link 组件写
                   （streamdown 2.5.0），并且**默认走开启安全确认那一支**——
                   `linkSafety: { enabled: true }` 是 streamdown 的内建默认值，上游
                   没有关掉它（线索 112）。

                   于是它渲染的是一个 `<button>` 而不是 `<a>`：**这是有意的**，
                   markdown 正文是模型产出的，直接给可点外链等于把跳转决定权交给模型。
                   想让某个调用点走普通 `<a>`（例如 artifact 预览里 React 用
                   `ArtifactLink` 覆盖掉了 `a`），做法是**在那个调用点覆盖 `a`**，
                   不是把这里改成 `<a>`。

                   `href` 恰好是 `streamdown:incomplete-link` 时是流式中途的半截链接，
                   `data-incomplete` 置真且不弹窗。
-->

<script setup lang="ts">
import { computed, ref, useAttrs } from "vue";

import { cn } from "@/lib/utils";

import MarkdownLinkSafetyModal from "./MarkdownLinkSafetyModal.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ href?: string; class?: string }>();
const attrs = useAttrs();
const open = ref(false);

const INCOMPLETE_HREF = "streamdown:incomplete-link";
const incomplete = computed(() => props.href === INCOMPLETE_HREF);

const passthrough = computed(() => {
  const { node: _node, class: _class, href: _href, ...rest } = attrs;
  void _node;
  void _class;
  void _href;
  return rest;
});

function activate() {
  if (!props.href || incomplete.value) return;
  open.value = true;
}

function openTarget() {
  if (props.href) window.open(props.href, "_blank", "noreferrer");
}
</script>

<template>
  <button
    v-bind="passthrough"
    :class="
      cn(
        'text-primary appearance-none text-left font-medium wrap-anywhere underline',
        props.class,
      )
    "
    :data-incomplete="incomplete"
    data-streamdown="link"
    type="button"
    @click="activate"
  >
    <slot />
  </button>
  <MarkdownLinkSafetyModal
    :url="props.href ?? ''"
    :open="open"
    @close="open = false"
    @confirm="openTarget"
  />
</template>
