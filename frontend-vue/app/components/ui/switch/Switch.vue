<!--
  【文件职责】     开关控件：role="switch" + aria-checked，Space/Enter 切换。
  【架构位置】     L2
  【主要导出】     Switch 组件
  【依赖关系】     Reka SwitchRoot/SwitchThumb · cn
  【边界与注意】   可访问名字由调用方给（aria-label 或关联 label）。Reka 会额外渲染一个
                   隐藏 input 供表单提交，断言时要按 role="switch" 找可见的那个 button。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  SwitchRoot,
  SwitchThumb,
  type SwitchRootEmits,
  type SwitchRootProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  SwitchRootProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<SwitchRootEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <SwitchRoot
    data-slot="switch"
    v-bind="delegated"
    :class="
      cn(
        'focus-visible:ring-ring/50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    @update:model-value="emits('update:modelValue', $event)"
  >
    <SwitchThumb
      data-slot="switch-thumb"
      class="bg-background pointer-events-none block size-4 rounded-full shadow ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
    />
  </SwitchRoot>
</template>
