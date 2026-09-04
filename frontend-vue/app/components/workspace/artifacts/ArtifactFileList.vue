<script setup lang="ts">
/*
  【文件职责】     展示并切换当前 thread 的 artifact 文件列表。
  【架构位置】     L3
  【主要导出】     默认 ArtifactFileList 组件
  【依赖关系】     ArtifactPanel · ui/select
  【边界与注意】   ① **走 `ui/select`，不是手搓的 combobox + listbox。**
                   上游是 shadcn 的 `<Select>`（artifact-file-detail.tsx:406）。
                   原来这里是一颗 `role="combobox"` 的按钮加一层绝对定位的
                   `role="listbox"`，四样差异都看得见/摸得着：
                   **触发器上没有下拉箭头**（SelectTrigger 自带 `ChevronDown`），
                   用户看不出这是个可展开的控件；**选中项没有对勾**
                   （SelectItem 自带 `SelectItemIndicator`）；
                   列表**不 portal**，被头部的 overflow 裁掉；
                   以及整套键盘行为（上下键、首字母跳转、Escape、
                   打开时焦点落到当前项）一条都没有。

                   ② 触发器**没有** aria-label：可访问名来自里面的 SelectValue，
                   也就是当前选中的文件名（上游同理）。额外挂一个 "Select artifact"
                   会让读屏器先念控件名再念文件名，而上游那边只念文件名。

                   ③ 只发出选择意图；dirty 决策由上层 useArtifactDraft 唯一处理。
                   受控写法（`:model-value` 绑 prop、不 v-model）是这条的前提：
                   用户在确认框里点「取消」时，触发器要退回原来的文件名。

                   ④ 弹层 portal 到 body，所以 e2e 里定位 `role="option"` 不能
                   把 locator 限死在面板容器里——上游用的是同一套 Radix portal。
*/
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

defineProps<{ current: string; options: string[] }>();
const emit = defineEmits<{ select: [path: string] }>();
const { $i18n } = useNuxtApp();

function fileName(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}
</script>

<template>
  <div class="text-foreground min-w-0 flex-1 text-sm font-medium">
    <Select
      :model-value="current"
      @update:model-value="
        (value) => {
          if (typeof value === 'string' && value !== current)
            emit('select', value);
        }
      "
    >
      <SelectTrigger
        class="max-w-full border-none bg-transparent! shadow-none select-none focus:outline-0 active:outline-0"
      >
        <SelectValue :placeholder="$i18n.t.value.primitives.selectAFile" />
      </SelectTrigger>
      <SelectContent class="select-none">
        <SelectGroup>
          <SelectItem v-for="option in options" :key="option" :value="option">
            {{ fileName(option) }}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
</template>
