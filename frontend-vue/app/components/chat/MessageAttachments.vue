<!--
  【文件职责】     渲染持久化 HumanMessage 的图片预览与普通文件下载卡。
  【架构位置】     L3 消息 UI adapter
  【主要导出】     默认 MessageAttachments 组件
  【依赖关系】     core/messages/attachments · core/artifacts
  【边界与注意】   URL 只从 thread artifact endpoint 构造；缺 path 时不生成链接。
-->

<script setup lang="ts">
import { computed } from "vue";
// 上游 message-list-item.tsx:735 画的是 `FileIcon`（素页），不是 `FileTextIcon`
// （带横线的页）——两颗不同字形。本仓另外两处用 FileText 的地方
// （ExportTrigger / ThreadActionsMenu）与上游一致，不动。
import { FileIcon, LoaderCircle } from "lucide-vue-next";

import { resolveArtifactURL } from "@/core/artifacts/utils";
import {
  extractMessageAttachments,
  isImageAttachment,
} from "@/core/messages/attachments";
import type { Message } from "@/core/types/message";

const props = defineProps<{
  message: Message;
  threadId?: string | null;
  isMock?: boolean;
}>();
const files = computed(() => extractMessageAttachments(props.message));
function fileUrl(path: string) {
  return props.threadId
    ? resolveArtifactURL(path, props.threadId, { isMock: props.isMock })
    : null;
}
function formatBytes(bytes: number) {
  if (bytes === 0) return "—";
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <div
    v-if="files.length"
    class="mb-2 flex flex-wrap justify-end gap-2"
    data-testid="message-attachments"
  >
    <template
      v-for="file in files"
      :key="`${file.filename}:${file.path ?? file.status}`"
    >
      <div
        v-if="file.status === 'uploading' || !file.path || !fileUrl(file.path)"
        class="border-border bg-background flex max-w-56 items-center gap-2 rounded-lg border p-3 text-sm"
      >
        <LoaderCircle
          v-if="file.status === 'uploading'"
          :size="16"
          class="animate-spin"
        />
        <FileIcon v-else :size="16" />
        <span class="truncate">{{ file.filename }}</span>
        <!--
          「还在上传」这件事此前只有那颗转圈图标在说，而它没有任何文字替代——
          读屏器念得出文件名，念不出它还没传完。上游 message-list-item.tsx:701
          在同一张卡片上写着 `{t.uploads.uploading}`。
        -->
        <span
          v-if="file.status === 'uploading'"
          class="text-muted-foreground shrink-0 text-[10px]"
        >
          {{ $i18n.t.value.uploads.uploading }}
        </span>
      </div>
      <a
        v-else-if="isImageAttachment(file)"
        :href="fileUrl(file.path!)!"
        target="_blank"
        rel="noopener noreferrer"
        class="border-border block overflow-hidden rounded-lg border"
      >
        <img
          :src="fileUrl(file.path!)!"
          :alt="file.filename"
          loading="lazy"
          decoding="async"
          class="h-32 w-auto max-w-60 object-cover"
        />
      </a>
      <a
        v-else
        :href="fileUrl(file.path!)!"
        target="_blank"
        rel="noopener noreferrer"
        class="border-border bg-background flex max-w-56 items-center gap-2 rounded-lg border p-3 text-sm"
      >
        <FileIcon :size="16" class="shrink-0" />
        <span class="min-w-0">
          <span class="block truncate">{{ file.filename }}</span>
          <span class="text-muted-foreground block text-[10px]">{{
            formatBytes(file.size)
          }}</span>
        </span>
      </a>
    </template>
  </div>
</template>
