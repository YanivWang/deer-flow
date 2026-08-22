<script setup lang="ts">
/*
  【文件职责】     展示 artifact 的编辑、复制、打开、下载和 skill install 动作。
  【对应 frontend/】 frontend/src/components/workspace/artifacts/artifact-file-detail.tsx
  【架构位置】     L3
  【主要导出】     默认 ArtifactActions 组件
  【依赖关系】     ArtifactPanel
  【边界与注意】   只表达已判定的能力；HTTP、权限、revision 与 stale 仍由父层 owner 处理。
*/
import {
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Package,
  RotateCcw,
  Save,
  X,
} from "lucide-vue-next";

defineProps<{
  canEdit: boolean;
  editing: boolean;
  dirty: boolean;
  conflict: boolean;
  streaming: boolean;
  saving: boolean;
  canCopy: boolean;
  canOpen: boolean;
  canDownload: boolean;
  canInstall: boolean;
  installing: boolean;
}>();
const emit = defineEmits<{
  edit: [];
  save: [];
  exit: [];
  discard: [];
  copy: [];
  open: [];
  download: [];
  install: [];
}>();
</script>

<template>
  <button
    v-if="canEdit && !editing"
    type="button"
    aria-label="Edit artifact"
    class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
    @click="emit('edit')"
  >
    <Edit3 :size="15" />
  </button>
  <template v-if="editing">
    <button
      type="button"
      aria-label="Save artifact"
      class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
      :disabled="streaming || saving || !dirty || conflict"
      @click="emit('save')"
    >
      <Save :size="15" />
    </button>
    <button
      v-if="dirty"
      type="button"
      aria-label="Discard artifact changes"
      class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
      @click="emit('discard')"
    >
      <RotateCcw :size="15" />
    </button>
    <button
      type="button"
      aria-label="Exit artifact edit"
      class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
      @click="emit('exit')"
    >
      <X :size="15" />
    </button>
  </template>
  <button
    v-if="canCopy"
    type="button"
    aria-label="Copy artifact"
    class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
    @click="emit('copy')"
  >
    <Copy :size="15" />
  </button>
  <button
    v-if="canOpen"
    type="button"
    aria-label="Open artifact"
    class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
    @click="emit('open')"
  >
    <ExternalLink :size="15" />
  </button>
  <button
    v-if="canDownload"
    type="button"
    aria-label="Download artifact"
    class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
    @click="emit('download')"
  >
    <Download :size="15" />
  </button>
  <button
    v-if="canInstall"
    type="button"
    aria-label="Install skill"
    class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
    :disabled="installing"
    @click="emit('install')"
  >
    <Package :size="15" />
  </button>
</template>
