<!--
  【文件职责】     开关控件：role="switch" + aria-checked，Space/Enter 切换。
  【架构位置】     L2
  【主要导出】     Switch 组件
  【依赖关系】     Reka SwitchRoot/SwitchThumb · cn
  【边界与注意】   可访问名字由调用方给（aria-label 或关联 label）。Reka 会额外渲染一个
                   隐藏 input 供表单提交，断言时要按 role="switch" 找可见的那个 button。

                   class 逐字抄 shadcn 的 switch.tsx。本仓原来停在一个更旧的版本上：
                   `h-5 w-9`（20×36）对 `h-[1.15rem] w-8`（18.4×32），对照台账上就是
                   **宽度 Δ4**；滑块的位移也从写死的 `translate-x-4` 换成
                   `translate-x-[calc(100%-2px)]`，否则窄了 4px 之后滑块会滑出边框。
                   另外补回 `peer`、`shadow-xs`、`focus-visible:border-ring` 与两条
                   dark 变体——它们都是选择器/视觉合同的一部分。
                   `cursor-pointer` 是本仓多出来的一条，**保留**：上游那颗开关没有它，
                   鼠标停上去还是箭头，而它明明可点。
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
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    @update:model-value="emits('update:modelValue', $event)"
  >
    <SwitchThumb
      data-slot="switch-thumb"
      class="bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
    />
  </SwitchRoot>
</template>
