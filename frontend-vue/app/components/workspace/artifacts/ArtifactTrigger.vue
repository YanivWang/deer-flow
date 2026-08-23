<script setup lang="ts">
/*
  【文件职责】     切换当前 thread 的 artifact 面板。
  【对应 frontend/】 src/components/workspace/artifacts/artifact-trigger.tsx
  【架构位置】     L3 extension reference
  【主要导出】     默认 ArtifactTrigger 组件
  【依赖关系】     useArtifactsPanel · AgentChat
  【边界与注意】   artifact 专有入口，不属于 L2。
*/
import { Files } from "lucide-vue-next";

defineProps<{ count: number }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <button
    v-if="count > 0"
    type="button"
    data-testid="artifact-trigger"
    :aria-label="$i18n.t.value.common.showArtifacts"
    class="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 items-center gap-1.5 rounded-md px-2 text-xs"
    @click="emit('open')"
  >
    <Files :size="15" />
    <span class="hidden sm:inline">{{ $i18n.t.value.common.artifacts }}</span>
  </button>
</template>
