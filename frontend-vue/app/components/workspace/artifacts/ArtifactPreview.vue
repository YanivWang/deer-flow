<script setup lang="ts">
/*
  【文件职责】     按显式 ArtifactPolicy 渲染 media/document/text/download-only 内容。
  【架构位置】     L3 extension reference
  【主要导出】     默认 ArtifactPreview 组件
  【依赖关系】     ArtifactPolicy · StreamMarkdown · HTML URL rewrite
  【边界与注意】   HTML iframe 只消费父层已通过 full + D3 的内容；本组件不自行提升能力。
*/
import { computed } from "vue";
import type { PluggableList } from "unified";

import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import { richContentComponents } from "@/components/markdown/components";
import type { ArtifactPolicy } from "@/core/artifacts/policy";
import { rewriteHtmlPreviewResourceUrls } from "@/core/artifacts/preview";
import {
  rawHtmlRehypePlugins,
  rehypeHeadingSlugs,
  appRemarkPlugins,
} from "@/core/markdown/plugins";

const props = defineProps<{
  policy: ArtifactPolicy;
  filename: string;
  content: string;
  url?: string;
  contentUrl?: string;
  viewMode: "code" | "preview";
  htmlPreviewAllowed: boolean;
}>();

const artifactRehypePlugins: PluggableList = [
  ...rawHtmlRehypePlugins.slice(0, 1),
  rehypeHeadingSlugs,
  ...rawHtmlRehypePlugins.slice(1),
];
const html = computed(() =>
  rewriteHtmlPreviewResourceUrls(props.content, props.contentUrl),
);
</script>

<template>
  <template v-if="policy.kind === 'browser-media'">
    <img
      v-if="policy.previewKind === 'image'"
      :src="url"
      :alt="filename"
      class="size-full object-contain"
    />
    <audio
      v-else-if="policy.previewKind === 'audio'"
      :src="url"
      :aria-label="filename"
      controls
      class="m-auto w-4/5"
    />
    <video
      v-else
      :src="url"
      :aria-label="filename"
      controls
      playsinline
      class="size-full bg-black object-contain"
    />
  </template>
  <iframe
    v-else-if="policy.kind === 'safe-document'"
    :src="url"
    class="size-full"
    sandbox=""
  />
  <p
    v-else-if="policy.kind === 'download-only'"
    class="text-muted-foreground p-4 text-sm"
  >
    {{ $i18n.t.value.artifacts.downloadOnlyDescription }}
  </p>
  <p
    v-else-if="policy.kind === 'skill-archive'"
    class="text-muted-foreground p-4 text-sm"
  >
    {{ $i18n.t.value.artifacts.skillArchiveDescription }}
  </p>
  <div
    v-else-if="viewMode === 'preview' && policy.language === 'markdown'"
    class="size-full overflow-auto px-4 py-3"
  >
    <StreamMarkdown
      :content="content"
      :components="richContentComponents"
      :remark-plugins="appRemarkPlugins"
      :rehype-plugins="artifactRehypePlugins"
    />
  </div>
  <iframe
    v-else-if="
      viewMode === 'preview' && policy.language === 'html' && htmlPreviewAllowed
    "
    :title="$i18n.t.value.artifacts.previewTitle"
    class="size-full"
    sandbox="allow-scripts allow-forms"
    :srcdoc="html"
  />
  <pre
    v-else
    class="min-h-full overflow-auto p-4 font-mono text-xs leading-5 whitespace-pre-wrap"
    >{{ content }}</pre>
</template>
