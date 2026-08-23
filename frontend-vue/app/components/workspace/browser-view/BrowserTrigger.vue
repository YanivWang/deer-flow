<script setup lang="ts">
/*
  【文件职责】     按 feature gate 切换 browser-view 面板。
  【对应 frontend/】 src/components/workspace/browser-view/browser-trigger.tsx
  【架构位置】     L3
  【主要导出】     默认 BrowserTrigger 组件
  【依赖关系】     workspace features · BrowserPanel
  【边界与注意】   browser_control 专有入口，不属于 L2。
*/
import { Monitor } from "lucide-vue-next";
defineEmits<{ open: [] }>();
</script>
<template>
  <button
    type="button"
    data-testid="browser-trigger"
    :aria-label="$i18n.t.value.browser.trigger"
    class="text-muted-foreground hover:bg-accent flex size-8 items-center justify-center rounded-md"
    @click="$emit('open')"
  >
    <Monitor :size="16" />
  </button>
</template>
