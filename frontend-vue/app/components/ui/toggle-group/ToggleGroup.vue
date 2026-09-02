<!--
  【文件职责】     单选/多选的分段控件外框。
  【架构位置】     L2
  【主要导出】     ToggleGroup 组件
  【依赖关系】     Reka ToggleGroupRoot · cn
  【边界与注意】   class 合同抄自 shadcn 的 toggle-group（frontend/src/components/ui/
                   toggle-group.tsx）：`data-slot` / `data-variant` / `data-size` /
                   `data-spacing` 都是选择器合同的一部分，子项靠 `data-spacing=0`
                   把自己拼成一条无缝的分段条。

                   变体不走 provide/inject（上游用的是 React context），因为本仓只有
                   一个调用点、且 L2 不许持有产品状态。调用点把 variant/size 同时传给
                   外框和每个子项即可，两边渲染出来的 data-* 一样。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ToggleGroupRoot,
  type ToggleGroupRootProps,
  useForwardPropsEmits,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<
    ToggleGroupRootProps & {
      class?: HTMLAttributes["class"];
      variant?: "default" | "outline";
      size?: "default" | "sm" | "lg";
      spacing?: number;
    }
  >(),
  { variant: "default", size: "default", spacing: 0 },
);
const emits = defineEmits<{ "update:modelValue": [value: unknown] }>();
const delegated = computed(() => {
  const {
    class: _class,
    variant: _variant,
    size: _size,
    spacing: _spacing,
    ...rest
  } = props;
  void _class;
  void _variant;
  void _size;
  void _spacing;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);
</script>

<template>
  <ToggleGroupRoot
    v-bind="forwarded"
    data-slot="toggle-group"
    :data-variant="props.variant"
    :data-size="props.size"
    :data-spacing="props.spacing"
    :style="{ '--gap': props.spacing }"
    :class="
      cn(
        'group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs',
        props.class,
      )
    "
  >
    <slot />
  </ToggleGroupRoot>
</template>
