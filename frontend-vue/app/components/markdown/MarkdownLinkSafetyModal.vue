<!--
  【文件职责】     外部链接的确认弹窗：念出目标 URL，给复制与打开两个出口。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     ./MarkdownIcon.vue · @/lib/utils · $i18n（globalProperties）
  【边界与注意】   逐字对着 streamdown `dist/chunk-BO2N2NFS.js` 的 link-safety modal 写
                   （streamdown 2.5.0）。它不是装饰：markdown 正文是**模型产出**的，
                   直接给一个可点的外链等于把跳转决定权交给模型。上游默认开着这一层
                   （`linkSafety: { enabled: true }` 是它的内建默认值），本仓此前整个缺失
                   ——渲染的是直接跳转的 `<a>`（线索 112）。

                   三处照抄，不要"优化"：
                   ① **body 滚动锁是引用计数的**，不是一个布尔。同时开两层（例如
                      artifact 面板里再弹一个）时，先关的那个不能把滚动还回去。
                   ② 遮罩自己也接 Escape 与点击关闭，并且内层卡片要 `stopPropagation`
                      ——否则点卡片里任何地方都会连带关掉。
                   ③ 复制成功后 2 秒回落成"复制链接"。计时器要在卸载时清掉，
                      否则弹窗关掉之后那个回调还会写一个已经没人看的 ref。

                   关闭按钮的名字取 `primitives.close`——上游那一句同样是 streamdown
                   写死的 "Close"，本仓这一串已经在 primitives 里了，不再重复一份。
-->

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

import { cn } from "@/lib/utils";

import MarkdownIcon from "./MarkdownIcon.vue";

const props = defineProps<{ url: string; open: boolean }>();
const emit = defineEmits<{ close: []; confirm: [] }>();

const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

/** 见文件头 ①：同时开几层时，滚动锁要按引用计数还回去。 */
let locked = false;
function lockScroll() {
  if (locked) return;
  locked = true;
  const depth = Number(document.body.dataset.markdownModalDepth ?? "0") + 1;
  document.body.dataset.markdownModalDepth = String(depth);
  if (depth === 1) document.body.style.overflow = "hidden";
}
function unlockScroll() {
  if (!locked) return;
  locked = false;
  const depth = Math.max(
    0,
    Number(document.body.dataset.markdownModalDepth ?? "0") - 1,
  );
  document.body.dataset.markdownModalDepth = String(depth);
  if (depth === 0) document.body.style.overflow = "";
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      lockScroll();
      document.addEventListener("keydown", onKeydown);
    } else {
      document.removeEventListener("keydown", onKeydown);
      unlockScroll();
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  unlockScroll();
  if (copyTimer !== null) clearTimeout(copyTimer);
});

async function copy() {
  try {
    await navigator.clipboard.writeText(props.url);
    copied.value = true;
    if (copyTimer !== null) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    /* 剪贴板被拒时什么都不做，与上游一致 */
  }
}

function confirm() {
  emit("confirm");
  emit("close");
}
</script>

<template>
  <div
    v-if="props.open"
    class="bg-background/50 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
    data-streamdown="link-safety-modal"
    role="button"
    :tabindex="0"
    @click="emit('close')"
    @keydown.escape="emit('close')"
  >
    <div
      class="bg-background relative mx-4 flex w-full max-w-md flex-col gap-4 rounded-xl border p-6 shadow-lg"
      role="presentation"
      @click.stop
      @keydown.stop
    >
      <button
        class="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-4 right-4 rounded-md p-1 transition-all"
        :title="$i18n.t.value.primitives.close"
        type="button"
        @click="emit('close')"
      >
        <MarkdownIcon name="XIcon" :size="16" />
      </button>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2 text-lg font-semibold">
          <MarkdownIcon name="ExternalLinkIcon" :size="20" />
          <span>{{ $i18n.t.value.markdown.openExternalLink }}</span>
        </div>
        <p class="text-muted-foreground text-sm">
          {{ $i18n.t.value.markdown.externalLinkWarning }}
        </p>
      </div>
      <div
        :class="
          cn(
            'bg-muted rounded-md p-3 font-mono text-sm break-all',
            props.url.length > 100 && 'max-h-32 overflow-y-auto',
          )
        "
      >
        {{ props.url }}
      </div>
      <div class="flex gap-2">
        <button
          class="bg-background hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all"
          type="button"
          @click="copy"
        >
          <MarkdownIcon :name="copied ? 'CheckIcon' : 'CopyIcon'" :size="14" />
          <span>{{
            copied
              ? $i18n.t.value.markdown.copied
              : $i18n.t.value.markdown.copyLink
          }}</span>
        </button>
        <button
          class="bg-primary text-primary-foreground hover:bg-primary/90 flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all"
          type="button"
          @click="confirm"
        >
          <MarkdownIcon name="ExternalLinkIcon" :size="14" />
          <span>{{ $i18n.t.value.markdown.openLink }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
