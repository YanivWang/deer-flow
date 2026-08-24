<script setup lang="ts">
/*
  【文件职责】     展示并切换当前 thread 的 artifact 文件列表。
  【架构位置】     L3
  【主要导出】     默认 ArtifactFileList 组件
  【依赖关系】     ArtifactPanel
  【边界与注意】   只发出选择意图；dirty 决策由上层 useArtifactDraft 唯一处理。
*/
import { ref } from "vue";

defineProps<{ current: string; options: string[] }>();
const emit = defineEmits<{ select: [path: string] }>();
const open = ref(false);

function select(path: string) {
  open.value = false;
  emit("select", path);
}
</script>

<template>
  <div class="relative min-w-0 flex-1">
    <button
      type="button"
      role="combobox"
      :aria-expanded="open"
      :aria-label="$i18n.t.value.artifacts.actions.select"
      class="hover:bg-accent block h-8 w-full truncate rounded px-2 text-left text-sm font-medium"
      @click="open = !open"
    >
      {{ current.split("/").filter(Boolean).at(-1) ?? current }}
    </button>
    <div
      v-if="open"
      role="listbox"
      class="bg-background border-border absolute top-full left-0 z-40 mt-1 max-h-64 min-w-full overflow-auto rounded-md border p-1 shadow-lg"
    >
      <button
        v-for="option in options"
        :key="option"
        type="button"
        role="option"
        :aria-selected="option === current"
        class="hover:bg-accent block w-full rounded px-2 py-1.5 text-left text-sm whitespace-nowrap"
        @click="select(option)"
      >
        {{ option.split("/").filter(Boolean).at(-1) ?? option }}
      </button>
    </div>
  </div>
</template>
