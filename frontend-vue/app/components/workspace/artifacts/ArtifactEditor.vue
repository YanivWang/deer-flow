<script setup lang="ts">
/*
  【文件职责】     编辑已经完整加载且可按 revision 保存的 UTF-8 output artifact。
  【对应 frontend/】 frontend/src/components/workspace/code-editor.tsx
  【架构位置】     L3
  【主要导出】     默认 ArtifactEditor 组件
  【依赖关系】     ArtifactPanel · useArtifactDraft
  【边界与注意】   本组件无加载/保存状态；父层未证明 full + revision 时不得挂载。
*/
defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [content: string] }>();
</script>

<template>
  <textarea
    data-testid="artifact-editor"
    :value="modelValue"
    class="size-full resize-none bg-transparent p-4 font-mono text-xs outline-none"
    spellcheck="false"
    @input="
      emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
    "
  />
</template>
