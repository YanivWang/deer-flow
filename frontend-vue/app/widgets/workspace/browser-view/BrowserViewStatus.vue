<script setup lang="ts">
import type { BrowserStreamStatus } from "./use-browser-stream";

const props = defineProps<{
  status: BrowserStreamStatus;
  live: boolean;
  navigating: boolean;
}>();
</script>

<template>
  <span class="workspace-browser-view__status" data-testid="browser-view-status" role="status">
    {{ props.navigating ? "加载中" : props.live && props.status === "open" ? "实时" : props.live ? "连接中" : "静态" }}
  </span>
</template>
