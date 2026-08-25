<script setup lang="ts">
/*
  【文件职责】     给 agent 模式选择器的触发器加一层「这个模式是干什么的」悬停说明。
  【架构位置】     L3
  【主要导出】     默认 ModeHoverGuide 组件
  【依赖关系】     ui/tooltip · ChatComposer · SidecarPanel
  【边界与注意】   文案由调用方传入，本组件只负责「标题: 说明」的拼装与浮层语义。
                   建在 ui/tooltip 上而不是手搓浮层：延迟、focus 入口、Escape、
                   portal 层级和读屏器投影都属于 primitive 层，散在调用点就会各写一份。
                   tooltip 是**补充**说明——触发器自己必须已经能读出模式名，
                   不能靠它来命名一个没有可访问名字的按钮。

                   **必须放在 DropdownMenuTrigger 里面，不能反过来。** Reka 的
                   tooltip 触发器和下拉触发器各自渲染一个 PopperAnchor，而
                   PopperAnchor 注入的是**最近**的 PopperRoot。把 tooltip 套在外面，
                   下拉的 anchor 就会注册进 tooltip 的 Popper，下拉自己的 Popper
                   一个 anchor 都没有——实测表现是菜单打得开，但整个渲染在视口外
                   （y = -563），一个选项都点不到，而且没有任何报错。

                   本组件的根是 fragment（触发器 + portal 内容），所以必须
                   `inheritAttrs: false` 并把 `$attrs` 显式绑到触发器上；
                   否则 DropdownMenuTrigger 以 as-child 传下来的 onClick/aria-*
                   会被 Vue 静默丢掉，表现是「菜单根本打不开」。
*/
import { computed } from "vue";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ label: string; description: string }>();
const content = computed(() => `${props.label}: ${props.description}`);
</script>

<template>
  <Tooltip>
    <TooltipTrigger v-bind="$attrs">
      <slot />
    </TooltipTrigger>
    <TooltipContent
      side="top"
      class="max-w-72"
      data-testid="mode-hover-guide"
      >{{ content }}</TooltipContent
    >
  </Tooltip>
</template>
