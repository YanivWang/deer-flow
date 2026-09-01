<!--
  【文件职责】     Command 根：搜索 + 列表的命令面板容器。
  【架构位置】     L2
  【主要导出】     Command 组件
  【依赖关系】     Reka ListboxRoot · cn
  【边界与注意】   建在 Listbox 而不是 Combobox 上：命令面板是**内联**列表，
                   不需要 portal、定位或 dismissable layer。多一层 dismissable
                   会先吃掉 Escape，外层 Dialog 就关不掉了。

                   **没有受控 modelValue 时，选中值跟着高亮走。** 这是 cmdk 的
                   语义：它的 `value` 就是当前活动项，于是活动项拿到
                   `aria-selected="true"`。Reka 的 Listbox 走的是另一套——
                   aria-selected 表示"这一项被选中了"，高亮只落在
                   `data-highlighted` 上，于是所有项恒为 aria-selected="false"。
                   两边都对，但对照台账实测出的那一行
                   （`option "…" [selected]` 只在 React 侧）就是它，而且在
                   combobox + aria-activedescendant 的组合下，活动项必须是
                   aria-selected 的那一个，否则读屏器只念得出名字、念不出
                   "第几项/共几项"之外的任何状态。

                   调用方仍然可以自己控 modelValue（`props.modelValue` 优先），
                   这时本组件不插手。两个调用点当前都不控。
-->

<script setup lang="ts">
import { computed, ref, type HTMLAttributes } from "vue";
import {
  ListboxRoot,
  type AcceptableValue,
  type ListboxRootEmits,
  type ListboxRootProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<ListboxRootProps & { class?: HTMLAttributes["class"] }>(),
  {
    highlightOnHover: true,
    selectionBehavior: "replace",
    class: undefined,
  },
);
const emits = defineEmits<ListboxRootEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, modelValue: _modelValue, ...rest } = forwarded.value;
  void _class;
  void _modelValue;
  return rest;
});

/* 高亮项的值。Reka 的 `highlight` 事件带的是集合项（{ ref, value }）。 */
type HighlightPayload =
  { ref: HTMLElement; value: AcceptableValue } | undefined;
const highlighted = ref<AcceptableValue | undefined>();
const activeValue = computed(() =>
  props.modelValue === undefined ? highlighted.value : props.modelValue,
);

function onHighlight(item: HighlightPayload) {
  highlighted.value = item?.value as AcceptableValue | undefined;
  emits("highlight", item);
}
</script>

<template>
  <ListboxRoot
    data-slot="command"
    v-bind="delegated"
    :model-value="activeValue"
    :class="cn('flex w-full flex-col overflow-hidden', props.class)"
    @update:model-value="emits('update:modelValue', $event)"
    @highlight="onHighlight"
    @entry-focus="emits('entryFocus', $event)"
    @leave="emits('leave', $event)"
  >
    <slot />
  </ListboxRoot>
</template>
