<!--
  【文件职责】     Select 单个选项。
  【架构位置】     L2
  【主要导出】     SelectItem 组件
  【依赖关系】     Reka SelectItem/ItemText/ItemIndicator · cn
  【边界与注意】   选项文本必须放进 SelectItemText，否则触发器读不到当前值。
                   字符串 value 会镜像到 data-value：原生 `<option value>` 暴露过这条
                   信息，换成自定义 listbox 后如果不补上，"选中值为 X 的那一项" 就只能
                   靠可见文案去猜，而可见文案是会被翻译的。

                   选中标记在**右边**（`absolute right-2` + `pr-8 pl-2`），与 React 的
                   同名件一致。这里原本是左边（`left-1.5` + `pl-7`），于是同一个下拉在
                   两个应用里勾在两侧、文字起始位置也差一截。图标同样按 React 用
                   `size-4`（16px），不是 14。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  type SelectItemProps,
  useForwardProps,
} from "reka-ui";
import { Check } from "lucide-vue-next";

import { cn } from "@/lib/utils";

const props = defineProps<
  SelectItemProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <SelectItem
    data-slot="select-item"
    :data-value="typeof props.value === 'string' ? props.value : undefined"
    v-bind="delegated"
    :class="
      cn(
        `focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2`,
        props.class,
      )
    "
  >
    <span
      data-slot="select-item-indicator"
      class="absolute right-2 flex size-3.5 items-center justify-center"
    >
      <SelectItemIndicator>
        <Check class="size-4" />
      </SelectItemIndicator>
    </span>
    <SelectItemText><slot /></SelectItemText>
  </SelectItem>
</template>
