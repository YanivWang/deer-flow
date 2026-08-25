<script setup lang="ts">
/*
  【文件职责】     编辑已经完整加载且可按 revision 保存的 UTF-8 output artifact。
  【架构位置】     L3
  【主要导出】     默认 ArtifactEditor 组件
  【依赖关系】     ArtifactPanel · ui/code-editor · $theme
  【边界与注意】   本组件无加载/保存状态；父层未证明 full + revision 时不得挂载。
                   它只做三件事：把 artifact 的语言名和当前主题喂给 L2 编辑器、
                   把文案交给它、把 Mod-S 转成父层已有的 revision 保存路径——
                   保存本身仍然只有 ArtifactPanel 一个 owner。
*/
import { computed } from "vue";

import { CodeEditor } from "@/components/ui/code-editor";

withDefaults(defineProps<{ modelValue: string; language?: string | null }>(), {
  language: undefined,
});
const emit = defineEmits<{
  "update:modelValue": [content: string];
  save: [];
}>();

const { $i18n, $theme } = useNuxtApp();
/* 编辑器只要 resolved 值；theme 的生命周期 owner 仍然只有 app 级 controller。 */
const theme = computed(() => $theme.resolved.value);
</script>

<template>
  <CodeEditor
    :model-value="modelValue"
    :language="language"
    :theme="theme"
    autofocus
    data-testid="artifact-editor"
    :content-label="$i18n.t.value.artifacts.editorLabel"
    @update:model-value="emit('update:modelValue', $event)"
    @save="emit('save')"
  />
</template>
