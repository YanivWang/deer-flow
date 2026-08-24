<!--
  【文件职责】     渲染输入区待发送附件，包含图片缩略图、移除入口与悬停详情。
  【对应 frontend/】 src/components/ai-elements/prompt-input.tsx::PromptInputAttachment
  【架构位置】     L3
  【主要导出】     默认 ComposerAttachmentChip 组件
  【依赖关系】     File · object URL · Reka HoverCard
  【边界与注意】   object URL 仅用于本地预览，文件离开组件时必须立即回收。
-->

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Paperclip, X } from "lucide-vue-next";
import {
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger,
} from "reka-ui";

const props = defineProps<{ file: File }>();
const emit = defineEmits<{ remove: [] }>();
const previewUrl = ref<string | null>(null);

function releasePreview() {
  if (previewUrl.value && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = null;
}

function syncPreview(file: File) {
  releasePreview();
  if (
    file.type.startsWith("image/") &&
    typeof URL.createObjectURL === "function"
  ) {
    previewUrl.value = URL.createObjectURL(file);
  }
}

onMounted(() => syncPreview(props.file));
watch(() => props.file, syncPreview);
onBeforeUnmount(releasePreview);
</script>

<template>
  <HoverCardRoot :open-delay="0" :close-delay="0">
    <HoverCardTrigger as-child>
      <div
        data-testid="composer-attachment"
        class="group border-border hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 relative flex h-8 max-w-60 cursor-pointer items-center gap-1.5 rounded-md border px-1.5 text-sm font-medium transition-all select-none"
      >
        <div class="relative size-5 shrink-0">
          <div
            class="bg-background absolute inset-0 flex size-5 items-center justify-center overflow-hidden rounded transition-opacity group-hover:opacity-0"
          >
            <img
              v-if="previewUrl"
              :src="previewUrl"
              :alt="file.name"
              class="size-5 object-cover"
              width="20"
              height="20"
            />
            <Paperclip
              v-else
              :size="12"
              class="text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <button
            type="button"
            :aria-label="$i18n.t.value.artifacts.actions.removeFile(file.name)"
            class="hover:bg-accent absolute inset-0 flex size-5 cursor-pointer items-center justify-center rounded p-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:opacity-100"
            @click.stop="emit('remove')"
          >
            <X :size="10" aria-hidden="true" />
          </button>
        </div>
        <span class="min-w-0 flex-1 truncate">{{ file.name }}</span>
      </div>
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        align="start"
        :side-offset="4"
        class="bg-popover text-popover-foreground z-50 w-auto rounded-md border p-2 shadow-md"
      >
        <div class="w-auto space-y-3">
          <div
            v-if="previewUrl"
            class="flex max-h-96 w-96 items-center justify-center overflow-hidden rounded-md border"
          >
            <img
              :src="previewUrl"
              :alt="file.name"
              class="max-h-full max-w-full object-contain"
              width="448"
              height="384"
            />
          </div>
          <div class="flex items-center gap-2.5">
            <div class="min-w-0 flex-1 space-y-1 px-0.5">
              <h4 class="truncate text-sm leading-none font-semibold">
                {{ file.name }}
              </h4>
              <p
                v-if="file.type"
                class="text-muted-foreground truncate font-mono text-xs"
              >
                {{ file.type }}
              </p>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>
