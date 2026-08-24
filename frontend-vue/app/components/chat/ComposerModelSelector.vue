<script setup lang="ts">
/*
  【文件职责】     统一主聊天与 Sidecar 的模型选择器尺寸、截断和菜单交互。
  【对应 frontend/】 src/components/ai-elements/model-selector.tsx
  【架构位置】     L3
  【主要导出】     默认 ComposerModelSelector 组件
  【依赖关系】     Model 展示契约 · composer controls
  【边界与注意】   160px 仅用于窄屏兜底；sm 以上与 React 一致放宽到 224px。
*/
import { ref } from "vue";

import type { Model } from "@/core/models/types";

withDefaults(
  defineProps<{
    models: readonly Model[];
    selectedModel?: Model;
    testId?: string;
  }>(),
  { selectedModel: undefined, testId: "composer-model-selector" },
);

const emit = defineEmits<{
  select: [model: Model];
}>();

const open = ref(false);

function selectModel(model: Model) {
  emit("select", model);
  open.value = false;
}
</script>

<template>
  <div v-if="selectedModel" class="relative min-w-0" :data-testid="testId">
    <button
      type="button"
      class="hover:bg-accent h-8 max-w-40 min-w-0 rounded-md px-2.5 text-xs sm:max-w-56"
      :aria-label="selectedModel.display_name"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="block truncate">{{ selectedModel.display_name }}</span>
    </button>
    <div
      v-if="open"
      class="bg-background border-border absolute right-0 bottom-full z-30 mb-1 w-56 rounded-md border p-1 shadow"
    >
      <button
        v-for="model in models"
        :key="model.id"
        type="button"
        class="hover:bg-accent block w-full rounded px-2 py-2 text-left text-sm"
        @click="selectModel(model)"
      >
        {{ model.display_name }}
      </button>
    </div>
  </div>
</template>
