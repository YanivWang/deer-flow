<!--
  【文件职责】     Command 的搜索输入：输入时方向键仍然驱动列表高亮。
  【架构位置】     L2
  【主要导出】     CommandInput 组件
  【依赖关系】     Reka ListboxFilter · cn
  【边界与注意】   焦点留在 input 上，选中项通过 aria-activedescendant 宣告——
                   所以调用方不要再把焦点搬到列表项上。

                   **role="combobox" 三件套是写死的**，与上游 cmdk 一致
                   （cmdk 的 Command.Input 恒定渲染 role="combobox"、
                   aria-expanded={true}、aria-autocomplete="list"）。Reka 的
                   ListboxFilter 只给 aria-activedescendant，于是可访问性树里
                   本仓念作 textbox、上游念作 combobox [expanded]——这一行
                   在对照台账里是实测出来的，不是推断。

                   aria-expanded 恒 true 而不是跟着某个开合状态：这个 input 只在
                   命令面板已经展开时才存在，没有"收起"的那一半。

                   可访问名走 `label` prop 渲染出来的**视觉隐藏 <label>**，与
                   cmdk 同构：它恒定渲染一个 <label cmdk-label> 并让 input 的
                   aria-labelledby 指过去。上游两个调用点原来都没给 Command 传
                   label，于是那个 label 是空的、accname 算出空串、placeholder
                   兜底被压掉——搜索框根本没有可访问名。那是上游缺陷，已按
                   "两边同改"补在 frontend/src/components/ai-elements/
                   model-selector.tsx 的 label prop 上。

                   为什么不是简单地给 input 加 aria-label：那样名字是有了，但
                   可访问性树里少一个 `text` 节点——上游那个 <label> 是**可见于
                   a11y 树**的静态文本，对照台账实测报出过这一行。名字与树形要
                   一起对齐，只对齐其中一半就是把差异从一处挪到另一处。

                   不传 label 时整个元素不渲染，对应上游"没传 label"的那一半。
-->

<script setup lang="ts">
import { computed, useId, type HTMLAttributes } from "vue";
import {
  ListboxFilter,
  type ListboxFilterProps,
  useForwardProps,
} from "reka-ui";
import { Search } from "lucide-vue-next";

import { cn } from "@/lib/utils";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    ListboxFilterProps & {
      class?: HTMLAttributes["class"];
      wrapperClass?: HTMLAttributes["class"];
      /** 可访问名。见文件头：它是一个视觉隐藏的真 <label>，不是 aria-label。 */
      label?: string;
    }
  >(),
  {
    autoFocus: true,
    class: undefined,
    wrapperClass: undefined,
    label: undefined,
  },
);
const emits = defineEmits<{ "update:modelValue": [value: string] }>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const {
    class: _class,
    wrapperClass: _wrapperClass,
    label: _label,
    ...rest
  } = forwarded.value;
  void _class;
  void _wrapperClass;
  void _label;
  return rest;
});
const inputId = useId();
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    :class="
      cn(
        'border-border flex items-center gap-2 border-b px-3',
        props.wrapperClass,
      )
    "
  >
    <Search
      :size="16"
      class="text-muted-foreground shrink-0"
      aria-hidden="true"
    />
    <label
      v-if="label"
      :for="inputId"
      data-slot="command-label"
      class="sr-only"
    >
      {{ label }}
    </label>
    <ListboxFilter
      :id="inputId"
      data-slot="command-input"
      v-bind="{ ...delegated, ...$attrs }"
      role="combobox"
      aria-expanded="true"
      aria-autocomplete="list"
      :class="
        cn(
          'h-12 min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )
      "
      @update:model-value="emits('update:modelValue', $event)"
    />
  </div>
</template>
