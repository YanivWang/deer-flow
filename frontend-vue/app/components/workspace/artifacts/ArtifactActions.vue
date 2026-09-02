<script setup lang="ts">
/*
  【文件职责】     展示 artifact 的编辑、复制、打开、下载和 skill install 动作。
  【架构位置】     L3
  【主要导出】     默认 ArtifactActions 组件
  【依赖关系】     ArtifactPanel
  【边界与注意】   只表达已判定的能力；HTTP、权限、revision 与 stale 仍由父层 owner 处理。
                   名字用通用词典键（common.* / clipboard.* / artifactEditing.*），不是
                   artifact 专有的一套。React 的 ArtifactAction 把 tooltip 原样写进
                   sr-only，而它传的就是这些通用键
                   （frontend/src/components/workspace/artifacts/artifact-file-detail.tsx），
                   所以这里念出来的是 "Copy to clipboard" 而不是 "Copy artifact"。
                   同一个动作在两个应用里必须叫同一个名字，否则一份共用的读屏脚本
                   在其中一边找不到控件。
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
  copyDisabled: boolean;
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
    :aria-label="$i18n.t.value.common.edit"
    class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
    @click="emit('edit')"
  >
    <Edit3 :size="15" />
  </button>
  <template v-if="editing">
    <!--
      保存键**禁用时要说得出为什么**。上游 artifact-file-detail.tsx:493 把 tooltip
      在三句之间切（跑起来了 / 冲突 / 保存），而 ArtifactAction 把 tooltip 原样写进
      sr-only——也就是说上游这颗按钮的**可访问名**会跟着状态变。本仓此前恒为
      "Save"：按钮灰着、读屏器只念得出「保存」，用户无从知道为什么点不动。
    -->
    <button
      type="button"
      :aria-label="
        streaming
          ? $i18n.t.value.artifactEditing.runInProgress
          : conflict
            ? $i18n.t.value.artifactEditing.conflict
            : $i18n.t.value.common.save
      "
      class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
      :disabled="streaming || saving || !dirty || conflict"
      @click="emit('save')"
    >
      <Save :size="15" />
    </button>
    <!-- 放弃在编辑态**恒显**，不看 dirty：React 的三颗（保存/退出/放弃）是一组。 -->
    <button
      type="button"
      :aria-label="$i18n.t.value.artifactEditing.discard"
      class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
      @click="emit('discard')"
    >
      <RotateCcw :size="15" />
    </button>
    <button
      type="button"
      :aria-label="$i18n.t.value.artifactEditing.exit"
      class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
      @click="emit('exit')"
    >
      <X :size="15" />
    </button>
  </template>
  <!--
    复制在截断或空内容时是**禁用**，不是消失——React 渲染它并传 disabled
    （artifact-file-detail.tsx 的 `disabled={!content || truncated}`）。控件时有时无，
    读屏器每次都要重新数一遍这排按钮。编辑态下这几颗则整体不渲染（React 的 `!isEditing`）。
  -->
  <button
    v-if="canCopy && !editing"
    type="button"
    :disabled="copyDisabled"
    :aria-label="$i18n.t.value.clipboard.copyToClipboard"
    class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
    @click="emit('copy')"
  >
    <Copy :size="15" />
  </button>
  <button
    v-if="canOpen && !editing"
    type="button"
    :aria-label="$i18n.t.value.common.openInNewWindow"
    class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
    @click="emit('open')"
  >
    <ExternalLink :size="15" />
  </button>
  <button
    v-if="canDownload && !editing"
    type="button"
    :aria-label="$i18n.t.value.common.download"
    class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
    @click="emit('download')"
  >
    <Download :size="15" />
  </button>
  <!--
    安装键外面上游还套了一层 `<Tooltip content={t.toolCalls.skillInstallTooltip}>`
    （artifact-file-detail.tsx:532），说的是「这颗按钮会做什么」，与按钮自己的名字
    （`common.install`）是两句话。本仓这一排动作用 aria-label 代替上游的 tooltip
    机制（见文件头），所以这句说明落到 `title` 上：hover 时能看见，
    读屏器把它当描述念（已经有 aria-label 顶着名字那一格）。
  -->
  <button
    v-if="canInstall && !editing"
    type="button"
    :aria-label="$i18n.t.value.common.install"
    :title="$i18n.t.value.toolCalls.skillInstallTooltip"
    class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
    :disabled="installing"
    @click="emit('install')"
  >
    <Package :size="15" />
  </button>
</template>
