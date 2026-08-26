<script setup lang="ts">
/*
  【文件职责】     切换当前 thread 的 artifact 面板。
  【架构位置】     L3 extension reference
  【主要导出】     默认 ArtifactTrigger 组件
  【依赖关系】     Button L2 · useArtifactsPanel · AgentChat
  【边界与注意】   artifact 专有入口，不属于 L2。
                   尺寸走 Button 的默认档（h-9 / text-sm / 图标 size-4），不是自己写一套：
                   React 的 ArtifactTrigger 用的就是不传 size 的 Button
                   （frontend/src/components/workspace/artifacts/artifact-trigger.tsx）。
                   原来手写的 h-8 / text-xs 让这颗按钮比 React 矮 4px、窄 19.5px，
                   而它右对齐在头部，于是同一行里它左边的每个控件位置都跟着错开。
*/
import { Files } from "lucide-vue-next";

import { Button } from "@/components/ui/button";

defineProps<{ count: number }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <Button
    v-if="count > 0"
    variant="ghost"
    data-testid="artifact-trigger"
    class="text-muted-foreground hover:text-foreground"
    :aria-label="$i18n.t.value.common.showArtifacts"
    @click="emit('open')"
  >
    <Files />
    <span class="hidden sm:inline">{{ $i18n.t.value.common.artifacts }}</span>
  </Button>
</template>
