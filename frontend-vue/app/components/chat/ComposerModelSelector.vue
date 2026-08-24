<script setup lang="ts">
/*
  【文件职责】     统一主聊天与 Sidecar 的模型选择器尺寸、截断和菜单交互。
  【架构位置】     L3
  【主要导出】     默认 ComposerModelSelector 组件
  【依赖关系】     Model 展示契约 · composer controls · ui/dropdown-menu
  【边界与注意】   160px 仅用于窄屏兜底；sm 以上与 React 一致放宽到 224px。
                   菜单开合、方向键、Escape 与焦点归还都属于 primitive，
                   这里只负责选中语义与尺寸合同。
*/
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Model } from "@/core/models/types";

const props = withDefaults(
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

function selectModel(name: string) {
  const model = props.models.find((candidate) => candidate.name === name);
  if (model) emit("select", model);
}
</script>

<template>
  <div v-if="selectedModel" class="min-w-0" :data-testid="testId">
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          class="hover:bg-accent h-8 max-w-40 min-w-0 rounded-md px-2.5 text-xs sm:max-w-56"
          :aria-label="selectedModel.display_name"
        >
          <span class="block truncate">{{ selectedModel.display_name }}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" class="w-56">
        <DropdownMenuRadioGroup
          :model-value="selectedModel.name"
          @update:model-value="selectModel(String($event))"
        >
          <DropdownMenuRadioItem
            v-for="model in models"
            :key="model.id"
            :value="model.name"
            class="text-sm"
          >
            {{ model.display_name }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
